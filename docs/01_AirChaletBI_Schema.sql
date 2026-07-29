/* ============================================================================
   AirChaletBI - Script 01: Creacion de base de datos y esquema
   ----------------------------------------------------------------------------
   Motor: PostgreSQL 13 o superior.
   Proyecto: Plataforma de gestion de reservas de chalets de playa con
   analitica de oferta y demanda.
   Universidad Mariano Galvez de Guatemala - Ingenieria en Sistemas.

   Este script crea la base de datos "airchaletbi" y sus 6 tablas, con
   llaves foraneas, restricciones de integridad e indices. NO inserta datos:
   el sistema arranca completamente vacio, como corresponde a un despliegue
   real. Las cuentas (cliente, propietario, administrador) se crean desde
   el formulario de registro de la aplicacion o, en el caso del rol admin,
   con una sola instruccion manual documentada al final de este archivo.
   ============================================================================ */

-- Ejecutar esta primera instruccion conectado a la base "postgres" (o
-- cualquiera distinta de "airchaletbi"), NO dentro de una transaccion junto
-- con el resto del script: CREATE DATABASE no puede ir dentro de BEGIN/COMMIT
-- ni dentro de un bloque con otras sentencias en la misma ejecucion.

CREATE DATABASE airchaletbi
  WITH ENCODING = 'UTF8';

-- Cambia la conexion activa a la base recien creada. Este comando (\connect)
-- es exclusivo del cliente psql; si usa otra herramienta (DBeaver, Azure
-- Data Studio, pgAdmin) simplemente reconectese manualmente a "airchaletbi"
-- despues de la linea CREATE DATABASE y continue ejecutando el resto.
\connect airchaletbi

-- =====================================================================
-- EXTENSION: btree_gist
-- Necesaria para el constraint de no-solape de reservas (ver mas abajo),
-- que combina en una misma restriccion una columna entera (chalet_id)
-- y un rango de fechas (rango_fechas) usando un indice GiST.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =====================================================================
-- TABLA: usuarios
-- Almacena clientes, propietarios y administradores en una sola tabla.
-- El campo "rol" determina los permisos que aplica el backend: cada
-- endpoint valida el rol antes de ejecutar cualquier operacion.
-- =====================================================================
CREATE TABLE usuarios (
    id           SERIAL PRIMARY KEY,
    nombre       TEXT NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    password     TEXT NOT NULL,                 -- hash bcrypt (10 rondas), nunca texto plano
    telefono     TEXT NOT NULL,
    rol          TEXT NOT NULL CHECK (rol IN ('cliente','dueno','admin')),
    creado       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: chalets
-- Cada chalet pertenece a un unico propietario (dueno_id). El campo
-- "activo" permite retirar un chalet de circulacion sin borrar su
-- historial de reservas. direccion_completa e instrucciones_checkin son
-- datos sensibles: el backend solo los revela al cliente cuando su
-- reserva para ese chalet fue aceptada (services/chalets.js -> detalle()).
-- =====================================================================
CREATE TABLE chalets (
    id                    SERIAL PRIMARY KEY,
    dueno_id              INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre                TEXT NOT NULL,
    playa                 TEXT NOT NULL,
    descripcion           TEXT,
    precio_noche          NUMERIC(10,2) NOT NULL CHECK (precio_noche > 0),
    capacidad             INTEGER NOT NULL CHECK (capacidad > 0),
    direccion_completa    TEXT,
    instrucciones_checkin TEXT,
    activo                BOOLEAN NOT NULL DEFAULT true,
    creado                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: chalet_fotos
-- Hasta 5 fotografias por chalet. El limite se valida en el backend
-- (services/chalets.js -> agregarFotos), no en la base de datos, porque
-- depende de contar filas existentes al momento de subir, no de una
-- restriccion estatica de esquema.
-- =====================================================================
CREATE TABLE chalet_fotos (
    id         SERIAL PRIMARY KEY,
    chalet_id  INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    url        TEXT NOT NULL
);

-- =====================================================================
-- TABLA: reglas_precio
-- Recargos porcentuales por temporada alta sobre un rango de fechas.
-- Ejemplo real de la tesis: +5% de precio del 12 al 16 de septiembre
-- (asueto de Independencia). fecha_inicio/fecha_fin se guardan como TEXT
-- en formato 'YYYY-MM-DD' de forma deliberada (ver nota en la tabla
-- reservas mas abajo, aplica el mismo razonamiento).
-- =====================================================================
CREATE TABLE reglas_precio (
    id           SERIAL PRIMARY KEY,
    chalet_id    INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    fecha_inicio TEXT NOT NULL,
    fecha_fin    TEXT NOT NULL,
    porcentaje   NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0)
);

-- =====================================================================
-- TABLA: reservas
-- Estado del ciclo de vida de una reserva:
--   pendiente -> aceptada   (el dueno confirma tras ver el comprobante)
--   pendiente -> declinada  (el dueno rechaza, con motivo obligatorio)
--   pendiente -> cancelada  (el propio cliente cancela)
-- monto_total lo calcula siempre el backend a partir del precio del
-- chalet y las reglas de precio vigentes; nunca se confia en un total
-- enviado por el cliente.
--
-- NOTA DE DISENO - fechas como TEXT en lugar de DATE:
-- fecha_entrada y fecha_salida se guardan como TEXT ('YYYY-MM-DD') y no
-- como DATE nativo. Es una decision deliberada: el driver de PostgreSQL
-- para Node.js (node-postgres) convierte las columnas DATE a objetos
-- Date de JavaScript en la zona horaria del proceso, lo que puede
-- desplazar la fecha en un dia segun el huso horario del servidor. Al
-- guardar el mismo string que el cliente envia y que el backend siempre
-- compara como texto, se elimina esa clase de error por completo. La
-- columna generada "rango_fechas" (ver mas abajo) reconstruye la fecha
-- real unicamente para el motor de base de datos, sin afectar como la
-- aplicacion lee o escribe estos campos.
-- =====================================================================
CREATE TABLE reservas (
    id             SERIAL PRIMARY KEY,
    chalet_id      INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    cliente_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_entrada  TEXT NOT NULL,
    fecha_salida   TEXT NOT NULL,
    huespedes      INTEGER NOT NULL CHECK (huespedes > 0),
    monto_total    NUMERIC(10,2) NOT NULL CHECK (monto_total > 0),
    comprobante    TEXT,                          -- nombre del archivo de la transferencia subida
    estado         TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','aceptada','declinada','cancelada')),
    motivo_rechazo TEXT,
    creado         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Columna generada (no se escribe directamente): reconstruye un rango
    -- de fechas [entrada, salida) real a partir de los dos TEXT de arriba,
    -- usando unicamente funciones inmutables (make_date + substring), que
    -- es requisito de PostgreSQL para columnas GENERATED ... STORED. Un
    -- simple cast ::date no es aceptado aqui porque su resultado depende
    -- de la configuracion regional (DateStyle) de la sesion.
    rango_fechas   daterange GENERATED ALWAYS AS (
                     daterange(
                       make_date(substring(fecha_entrada,1,4)::int, substring(fecha_entrada,6,2)::int, substring(fecha_entrada,9,2)::int),
                       make_date(substring(fecha_salida,1,4)::int, substring(fecha_salida,6,2)::int, substring(fecha_salida,9,2)::int),
                       '[)'
                     )
                   ) STORED
);

-- =====================================================================
-- RESTRICCION: ux_reservas_no_solape
-- Impide que dos reservas del mismo chalet, ambas en estado pendiente o
-- aceptada, tengan rangos de fechas que se traslapen. Es la garantia
-- real contra la doble reserva: el backend ya valida disponibilidad en
-- services/chalets.js (estaDisponible) antes de insertar, pero esa
-- validacion por si sola deja abierta una ventana de concurrencia si dos
-- solicitudes llegan casi al mismo tiempo para el mismo chalet. Este
-- EXCLUDE constraint hace que el propio motor de base de datos rechace
-- la segunda insercion, sin importar que la aplicacion la haya validado
-- o no. El filtro WHERE permite que una reserva declinada o cancelada
-- libere el rango de fechas para que otra pueda ocuparlo.
-- =====================================================================
ALTER TABLE reservas
  ADD CONSTRAINT ux_reservas_no_solape
  EXCLUDE USING gist (
    chalet_id WITH =,
    rango_fechas WITH &&
  )
  WHERE (estado IN ('pendiente','aceptada'));

-- =====================================================================
-- TABLA: comentarios_dueno
-- Avisos que el propietario publica en un chalet (por ejemplo: "de 7 a
-- 13h no habra luz por mantenimiento"). Es informativo y unidireccional,
-- no un sistema de mensajeria: la comunicacion bidireccional ocurre por
-- WhatsApp, fuera de la plataforma.
-- =====================================================================
CREATE TABLE comentarios_dueno (
    id         SERIAL PRIMARY KEY,
    chalet_id  INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    mensaje    TEXT NOT NULL,
    creado     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- INDICES
-- Aceleran las consultas mas frecuentes de la aplicacion: chalets de un
-- propietario, y reservas filtradas por chalet o por cliente.
-- =====================================================================
CREATE INDEX idx_chalets_dueno   ON chalets(dueno_id);
CREATE INDEX idx_reservas_chalet ON reservas(chalet_id);
CREATE INDEX idx_reservas_cli    ON reservas(cliente_id);

-- =====================================================================
-- Fin del esquema. La base de datos queda lista, vacia, para que el
-- backend (Node.js / Express) inserte y consulte datos a traves de la
-- API REST.
-- =====================================================================

/* ----------------------------------------------------------------------
   CREACION MANUAL DE LA CUENTA ADMINISTRADOR (opcional, solo si se
   necesita antes de tener alguna cuenta creada desde la aplicacion)

   El registro publico (POST /api/auth/registro) solo permite crear
   cuentas con rol 'cliente' o 'dueno'; el rol 'admin' nunca se expone
   por esa via, para evitar que cualquier persona se autoasigne permisos
   de administrador. Para obtener la primera cuenta admin hay dos rutas:

   Opcion A (recomendada): registrar una cuenta normal desde la
   aplicacion (rol dueno o cliente) y luego promoverla:

       UPDATE usuarios SET rol = 'admin' WHERE email = 'correo@ejemplo.com';

   Opcion B: insertarla directamente con una contrasena ya hasheada con
   bcrypt (10 rondas). El siguiente hash de ejemplo corresponde a la
   contrasena "CambiaEstaClave123" y se entrega solo como referencia del
   formato esperado; genere el suyo propio antes de usarlo en un entorno
   real (puede hacerlo desde Node con:
   `node -e "console.log(require('bcryptjs').hashSync('su_clave', 10))"`).

       INSERT INTO usuarios (nombre, email, password, telefono, rol)
       VALUES (
         'Administrador',
         'admin@airchaletbi.com',
         '$2a$10$8K1p/a0dURXAf9NnpKC5Y.4T97VwYaOSjyq2SAAn0FQtEcU6X15gK',
         '00000000',
         'admin'
       );

   No se incluye esta insercion activa en el script porque el proyecto
   no debe entregarse con ninguna cuenta ni contrasena predefinida.
------------------------------------------------------------------------- */
