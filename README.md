# ViveMonterrico — Plataforma de gestión de reservas de chalets de playa

Prototipo funcional desarrollado para la tesis *Desarrollo de una plataforma de analítica de datos para la gestión de reservas y predicción de tendencias de preferencias y demanda en chalets de playa*, aplicado a la operación de renta de chalets en las playas de Guatemala.

Universidad Mariano Gálvez de Guatemala — Ingeniería en Sistemas de Información.

---

## 1. Qué resuelve el sistema

La gestión de chalets de playa entre varios propietarios independientes suele hacerse por WhatsApp y hojas de cálculo sueltas. Eso genera varios problemas concretos que este prototipo ataca:

| Problema | Cómo lo resuelve el sistema |
|---|---|
| Cada propietario lleva su disponibilidad por separado, con riesgo de doble reserva | Calendario centralizado por chalet, con bloqueo de fechas a nivel de base de datos |
| No hay forma de saber qué meses o fechas concentran más demanda | Panel de analítica: ocupación, ingresos confirmados, ticket promedio, clientes recurrentes, noches por mes/día de la semana, chalets más solicitados y fechas festivas |
| El precio de temporada alta se ajusta a mano y de forma inconsistente | Reglas de precio por rango de fechas, calculadas siempre por el servidor |
| Avisar al personal (piscina, limpieza) de cada check-in es manual y se olvida | Calendario del propietario con los check-ins próximos resaltados, asignación de empleados por reserva y aviso por WhatsApp con un clic |

---

## 2. Estructura del proyecto

```
vivemonterrico/
├── docs/                     Documentacion y script SQL de creación del esquema
│   └── 01_ViveMonterrico_Schema.sql
├── backend/                  API REST en Node.js 18+ / Express
│   └── src/
│       ├── routes/           Endpoints HTTP por recurso (incluye empleados.routes.js)
│       ├── services/         Reglas de negocio (chalets, reservas, empleados, analítica, reporte PDF)
│       ├── middleware/       Autenticación JWT, roles, subida de archivos
│       ├── db.js             Conexión a PostgreSQL y creación del esquema
│       └── server.js         Arranque del servidor
├── frontend/                 Panel web en React 18 + Vite (Bootstrap 5 y Chart.js via npm)
│   └── src/
│       ├── api/               Cliente HTTP (fetch) hacia la API
│       ├── context/           Sesion (AuthContext), equivalente al Sesion.* anterior
│       ├── components/        Nav, badges, tarjetas y el grid del calendario
│       ├── pages/              Home, Login, Registro, Cliente, Admin, Dueno/* (incluye Empleados y Calendario)
│       └── utils/              Moneda, enlaces de WhatsApp, registro de Chart.js
└── frontend-legacy/          Version anterior (HTML/CSS/JS vanilla), conservada como referencia
```

---

## 3. Requisitos

| Componente | Versión mínima | Notas |
|---|---|---|
| Node.js | 18 | Incluye npm |
| PostgreSQL | 13 | Se usa la extensión `btree_gist`, incluida en la instalación estándar |
| Navegador | Chrome, Edge o Firefox actual | El frontend ahora requiere compilación (Vite) |
| Editor | VS Code | Opcional |

No se usa Docker. El frontend usa Vite como bundler; Bootstrap, Chart.js y react-router se instalan como dependencias npm (ya no se cargan desde CDN).

---

## 4. Puesta en marcha local

### 4.1 Base de datos

1. Cree la base de datos ejecutando `docs/01_ViveMonterrico_Schema.sql` con `psql`, DBeaver, Azure Data Studio o pgAdmin.
2. El script crea la base `vivemonterrico`, sus 6 tablas, restricciones e índices. **No inserta ningún dato.**

```powershell
psql -U postgres -f docs/01_ViveMonterrico_Schema.sql
```

El sistema arranca completamente vacío: no hay chalets, usuarios ni reservas de muestra. Es un despliegue limpio, sin datos ficticios que retirar antes de la entrega.

### 4.2 Backend

1. Copie `backend/.env.example` como `backend/.env` y ajuste los datos de conexión a su PostgreSQL.
2. Desde `backend/`:

```bash
npm install
npm start
```

3. La API queda disponible en `http://localhost:4000`.

El backend también puede crear el esquema por sí mismo al arrancar (es idempotente, usa `CREATE TABLE IF NOT EXISTS`), pero el script SQL es la referencia formal para la defensa y para desplegar sin depender de que la aplicación arranque primero.

### 4.3 Panel web

El frontend es una aplicacion React construida con Vite.

1. Copie `frontend/.env.example` como `frontend/.env` y ajuste `VITE_API_BASE` si la API no corre en `http://localhost:4000/api`.
2. Desde `frontend/`:

```bash
npm install
npm run dev
```

3. El panel queda disponible en `http://localhost:5173` (o el puerto que indique Vite). Para generar el build de produccion: `npm run build` (salida en `frontend/dist/`, para servir con cualquier hosting estatico).

### 4.4 Primer ingreso

No existe ninguna cuenta predefinida. El registro público (`/registro`) permite crear cuentas de **cliente** o **propietario**. La cuenta de **administrador** se crea manualmente por seguridad — ver la sección final de `docs/01_ViveMonterrico_Schema.sql` para las dos formas de obtenerla (promover una cuenta existente o insertarla directamente con una contraseña ya cifrada).

---

## 5. Secuencia sugerida para la primera prueba

1. **Registro** → cree una cuenta con rol propietario.
2. **Mis chalets** → cree al menos un chalet, con precio por noche y capacidad.
3. **Reglas de precio** (opcional) → agregue un recargo de temporada alta sobre un rango de fechas.
4. **Cuenta cliente** → registre una segunda cuenta, esta vez como cliente.
5. **Reservar** → desde el listado público, busque el chalet y solicite una reserva; observe que el precio ya incluye el recargo si la fecha cae en la regla.
6. **Comprobante** → en "Mis reservas", suba una imagen simulando el comprobante de transferencia.
7. **Aceptar** → vuelva a la cuenta propietario, en la pestaña Reservas acepte la solicitud, y confirme que la dirección e instrucciones de check-in ahora aparecen del lado del cliente.
8. **Empleados y calendario** → en la pestaña Empleados registre a su personal (piscina, limpieza, etc.); en Calendario, abra el dia de check-in de la reserva aceptada, asignele un empleado y use el botón "Enviar WhatsApp" (abre un enlace `wa.me` con el mensaje precargado; el envío lo confirma usted manualmente).
9. **Analítica y reporte** → en el panel del propietario, revise la pestaña Analítica (incluye ocupación, ingresos, ticket promedio y clientes recurrentes) y descargue el reporte PDF de un rango de fechas.

---

## 6. Modo de datos

El sistema **no incluye ni requiere datos semilla**. A diferencia de catálogos como roles o estados, que en otros proyectos necesitan filas iniciales por ser referenciados desde llaves foráneas, aquí los roles (`cliente`, `dueno`, `admin`) y los estados de reserva (`pendiente`, `aceptada`, `declinada`, `cancelada`) se implementan como restricciones `CHECK` sobre una columna de texto, no como tablas de catálogo aparte. Por eso no existe ni es necesario un segundo script de "datos iniciales": el esquema por sí solo deja el sistema listo para operar.

Los **empleados** (personal del propietario: piscina, limpieza, etc.) no inician sesión ni tienen rol propio — son contactos que el propietario registra desde la pestaña Empleados del panel, y a los que se avisa por WhatsApp desde el Calendario cuando se acerca la fecha de entrada de una reserva.

---

## 7. Documentación adicional

| Archivo | Contenido |
|---|---|
| `01-Arquitectura.md` | Capas, patrones, modelo de datos y diagrama entidad-relación |
| `02-API-Endpoints.md` | Catálogo completo de endpoints REST |
| `03-Despliegue.md` | Publicación de la API, la base de datos y el frontend |
| `04-Defensa-Tesis.md` | Trazabilidad de objetivos y respuestas a preguntas del jurado |

---

## 8. Advertencia sobre alcance

Este es un prototipo funcional desarrollado con fines académicos, aplicado a un caso de uso real de renta de chalets de playa en Guatemala. Administra información de reservas y pagos por transferencia (con comprobante adjunto), no procesa pagos en línea ni almacena datos de tarjetas. Un despliegue comercial real requeriría pasarela de pago certificada, auditoría de seguridad, cifrado en reposo, respaldo automatizado y validación legal del tratamiento de datos personales.

---

## 9. Historial de versiones

| Versión | Contenido |
|---|---|
| `v1.0.0` | Software base: reservas, chalets, reglas de precio, roles, analítica y reporte PDF. |
| `v1.0.1` | Documentos de defensa de tesis y explicación de arquitectura. |
| `v1.1.0` | Frontend reescrito en React + Vite (el HTML/JS vanilla anterior queda en `frontend-legacy/`); módulo de empleados con calendario de check-ins y aviso por WhatsApp; analítica ampliada (ocupación, ingresos, ticket promedio, clientes recurrentes). |

Ver [Releases](../../releases) para el detalle de cada versión.
