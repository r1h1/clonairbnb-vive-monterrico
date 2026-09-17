-- =====================================================================
-- ViveMonterrico - Script de creacion de base de datos
-- Motor: PostgreSQL 18
-- Proyecto: Plataforma de gestion de reservas de chalets de playa
-- =====================================================================
-- Este script crea la base de datos y todas las tablas necesarias.
-- El backend (Node.js/Express) tambien puede crear este esquema de
-- forma automatica al iniciar; este archivo se entrega como respaldo
-- =====================================================================

CREATE DATABASE vivemonterrico
  WITH ENCODING = 'UTF8';

-- A partir de aqui, conectarse a la base "vivemonterrico" recien creada
-- (en psql: \c vivemonterrico) y ejecutar el resto del script.

-- =====================================================================
-- TABLA: usuarios
-- Almacena clientes, propietarios y administradores. El rol determina
-- los permisos en el backend (aislamiento por rol).
-- =====================================================================
CREATE TABLE usuarios (
    id           SERIAL PRIMARY KEY,
    nombre       TEXT NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    password     TEXT NOT NULL,                 -- hash bcrypt, nunca texto plano
    telefono     TEXT NOT NULL,
    rol          TEXT NOT NULL CHECK (rol IN ('cliente','dueno','admin')),
    creado       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: chalets
-- Cada chalet pertenece a un unico propietario (dueno_id).
-- direccion_completa e instrucciones_checkin son datos sensibles que
-- el backend solo revela al cliente cuando su reserva fue aceptada.
-- =====================================================================
CREATE TABLE chalets (
    id                    SERIAL PRIMARY KEY,
    dueno_id              INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre                TEXT NOT NULL,
    playa                 TEXT NOT NULL,
    descripcion           TEXT,
    precio_noche          NUMERIC(10,2) NOT NULL,
    capacidad             INTEGER NOT NULL,
    direccion_completa    TEXT,
    instrucciones_checkin TEXT,
    activo                BOOLEAN NOT NULL DEFAULT true,
    creado                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: chalet_fotos
-- Hasta 5 fotos por chalet (limite validado en el backend, no en la BD).
-- =====================================================================
CREATE TABLE chalet_fotos (
    id         SERIAL PRIMARY KEY,
    chalet_id  INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    url        TEXT NOT NULL
);

-- =====================================================================
-- TABLA: reglas_precio
-- Recargos por temporada alta sobre un rango de fechas.
-- Ejemplo: +5% del 12 al 16 de septiembre (Independencia).
-- fecha_inicio/fecha_fin se guardan como TEXT ('YYYY-MM-DD') a proposito,
-- para que el backend compare siempre el mismo formato de cadena que
-- envia el cliente, sin conversiones de zona horaria.
-- =====================================================================
CREATE TABLE reglas_precio (
    id           SERIAL PRIMARY KEY,
    chalet_id    INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    fecha_inicio TEXT NOT NULL,
    fecha_fin    TEXT NOT NULL,
    porcentaje   NUMERIC(5,2) NOT NULL
);

-- =====================================================================
-- TABLA: reservas
-- Estado del ciclo de vida de una reserva: pendiente -> aceptada/declinada,
-- o pendiente -> cancelada. monto_total lo calcula siempre el backend
-- (nunca se confia en un total enviado por el cliente).
-- =====================================================================
CREATE TABLE reservas (
    id             SERIAL PRIMARY KEY,
    chalet_id      INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    cliente_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_entrada  TEXT NOT NULL,
    fecha_salida   TEXT NOT NULL,
    huespedes      INTEGER NOT NULL,
    monto_total    NUMERIC(10,2) NOT NULL,
    comprobante    TEXT,                          -- nombre del archivo subido (comprobante de pago)
    estado         TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','aceptada','declinada','cancelada')),
    motivo_rechazo TEXT,
    creado         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: comentarios_dueno
-- Avisos publicados por el propietario, visibles para quien ve el
-- chalet (no es un sistema de chat, es informativo/unidireccional).
-- =====================================================================
CREATE TABLE comentarios_dueno (
    id         SERIAL PRIMARY KEY,
    chalet_id  INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
    mensaje    TEXT NOT NULL,
    creado     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: empleados
-- Personal del dueno (quien limpia la piscina, quien limpia la casa,
-- etc.). No inician sesion en la plataforma: son contactos a los que el
-- dueno avisa por WhatsApp, por eso no llevan usuario/rol propio.
-- =====================================================================
CREATE TABLE empleados (
    id        SERIAL PRIMARY KEY,
    dueno_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre    TEXT NOT NULL,
    telefono  TEXT NOT NULL,
    tipo      TEXT NOT NULL,                       -- texto libre: "Piscina", "Limpieza", etc.
    activo    BOOLEAN NOT NULL DEFAULT true,
    creado    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TABLA: reserva_empleados
-- Empleados asignados a una reserva, para avisarles la fecha de
-- check-in. "notificado" es un registro de mejor esfuerzo que el propio
-- dueno marca al enviar el aviso por WhatsApp, no una confirmacion real
-- de entrega del mensaje.
-- =====================================================================
CREATE TABLE reserva_empleados (
    id            SERIAL PRIMARY KEY,
    reserva_id    INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    empleado_id   INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    notificado    BOOLEAN NOT NULL DEFAULT false,
    notificado_en TIMESTAMPTZ,
    creado        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (reserva_id, empleado_id)
);

-- =====================================================================
-- INDICES
-- Aceleran las consultas mas frecuentes: chalets de un dueno, reservas
-- por chalet o por cliente, empleados de un dueno y sus asignaciones.
-- =====================================================================
CREATE INDEX idx_chalets_dueno         ON chalets(dueno_id);
CREATE INDEX idx_reservas_chalet       ON reservas(chalet_id);
CREATE INDEX idx_reservas_cli          ON reservas(cliente_id);
CREATE INDEX idx_empleados_dueno       ON empleados(dueno_id);
CREATE INDEX idx_reserva_empleados_res ON reserva_empleados(reserva_id);

-- =====================================================================
-- Fin del script
-- =====================================================================