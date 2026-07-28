# AirChaletBI

Prototipo funcional de plataforma para la gestion de reservas de chalets de playa, con analitica de demanda. Inspirado en el modelo de Airbnb pero simplificado y con un panel de estadisticas para propietarios. Basado en el proyecto de tesis "Desarrollo de una plataforma de analitica de datos para la gestion de reservas y prediccion de tendencias de preferencias y demanda en chalets de playa, Monterrico".

## Que hace

Tres roles con permisos separados:

- **Cliente**: se registra, busca chalets por fecha/playa/huespedes, reserva, sube el comprobante de pago (transferencia) y ve solo sus reservas. Al aceptarse la reserva se le libera la direccion completa y las instrucciones de check-in.
- **Propietario (dueno)**: crea y administra N chalets (CRUD, hasta 5 fotos por chalet), define reglas de precio por rango de fechas (ej. +5% en temporada alta), acepta o declina reservas con motivo, publica avisos por chalet (no es un chat) y ve un dashboard con estadisticas y analitica de demanda. Solo ve sus chalets y las reservas de sus chalets.
- **Administrador**: ve todo, elimina clientes y propietarios (borrado en cascada) y consulta la analitica global.

Reglas de negocio implementadas: bloqueo de fechas ya reservadas (pendientes o aceptadas), calculo de precio por noche con recargo por temporada, aislamiento de datos por rol, y liberacion de datos sensibles solo tras la aceptacion. La comunicacion directa se hace por WhatsApp (enlace `wa.me` al telefono del cliente); dentro de la plataforma solo existen los avisos del propietario.

## Arquitectura

```
airchaletbi/
├── backend/           API REST en Node.js + Express + SQLite
│   └── src/
│       ├── routes/        endpoints por recurso
│       ├── services/      logica de negocio (chalets, reservas, analitica, usuarios)
│       ├── middleware/    autenticacion JWT, roles y subida de archivos
│       ├── db.js          conexion y esquema SQLite
│       └── server.js      arranque
└── frontend/          HTML + Bootstrap 5 + JavaScript (fetch)
    ├── index.html         listado y reserva (cliente)
    ├── cliente.html       mis reservas
    ├── dueno.html         panel del propietario
    └── admin.html         administracion
```

Capas: **ruta -> servicio -> base de datos**, con validacion en el borde y manejo central de errores. Seguridad: contrasenas con bcrypt, tokens JWT, guardias por rol y verificacion de propiedad en cada operacion.

## Requisitos

- Node.js 18 o superior.

## Como correr en local

**1. Backend**

```bash
cd backend
npm install
npm run seed      # carga datos de ejemplo y cuentas de prueba
npm start         # API en http://localhost:4000
```

En Windows con PowerShell, ejecuta cada linea por separado (PowerShell no usa `&&` como separador en versiones antiguas). Si prefieres una sola linea, usa `;` en vez de `&&`:

```powershell
cd backend; npm install; npm run seed; npm start
```

**2. Frontend**

Sirve la carpeta `frontend/` con cualquier servidor estatico. Por ejemplo:

```bash
cd frontend
python3 -m http.server 5500     # abre http://localhost:5500
```

Si no tienes Python en Windows, sirve con Node (viene con `npx`, no requiere instalacion aparte):

```powershell
cd frontend
npx serve -l 5500
```

No abras los HTML con doble clic (`file://`): las peticiones a la API fallan por CORS. Usa un servidor estatico.

## Cuentas de prueba (tras `npm run seed`)

| Rol      | Email                    | Contrasena  |
|----------|--------------------------|-------------|
| Admin    | admin@airchaletbi.com    | admin123    |
| Dueno    | jenny@airchaletbi.com    | dueno123    |
| Dueno    | carlos@airchaletbi.com   | dueno123    |
| Cliente  | juan@correo.com          | cliente123  |
| Cliente  | maria@correo.com         | cliente123  |

## Endpoints principales

- `POST /api/auth/registro`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/chalets` (publico, filtros `entrada`, `salida`, `huespedes`, `playa`), `GET /api/chalets/:id`
- `POST/PUT/DELETE /api/chalets/:id`, `POST /api/chalets/:id/fotos`, `POST /api/chalets/:id/reglas`, `POST /api/chalets/:id/comentarios`
- `POST /api/reservas`, `POST /api/reservas/:id/comprobante`, `GET /api/reservas/mias`, `GET /api/reservas/dueno`
- `PUT /api/reservas/:id/aceptar`, `PUT /api/reservas/:id/declinar`, `PUT /api/reservas/:id/cancelar`
- `GET /api/dueno/dashboard`, `GET /api/dueno/analitica/demanda`, `GET /api/dueno/analitica/proyeccion`
- `GET /api/admin/usuarios`, `DELETE /api/admin/usuarios/:id`, `GET /api/admin/chalets`, `GET /api/admin/reservas`

## Despliegue gratuito

**Frontend** (estatico, persistente): Netlify, Vercel o GitHub Pages. Sube la carpeta `frontend/`. Antes edita `frontend/js/config.js` y pon la URL publica de tu API.

**Backend**: Render (plan gratuito) o Railway. Comando de build `npm install`, comando de arranque `npm start`. Define las variables de entorno del `.env.example` (sobre todo `JWT_SECRET`, `URL_BASE` y `CORS_ORIGEN` con el dominio del frontend).

Sobre la analitica: la "prediccion" es una heuristica (promedio historico con suavizado y factor de estacionalidad), no un modelo de machine learning. Es suficiente para un prototipo; con mas datos podria sustituirse por una regresion o un modelo de series de tiempo.

## Limitaciones conocidas (por ser prototipo)

- **Persistencia en hosting gratuito**: SQLite y las imagenes se guardan en el disco del servidor. En planes gratuitos con disco efimero (ej. Render free) esos datos se reinician al redeployar. Para persistencia real conviene migrar la base a PostgreSQL (Neon/Supabase, gratis) y las imagenes a un almacenamiento externo (Cloudinary/Supabase Storage). El codigo separa la capa de datos para facilitar ese cambio.
- Seguridad deliberadamente basica (sin verificacion de correo ni 2FA), apropiada para demostrar el flujo.
- La Semana Santa (feriado movil) no se detecta automaticamente en la analitica.
