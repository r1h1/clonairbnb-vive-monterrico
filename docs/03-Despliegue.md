# Guía de despliegue

Todo lo descrito aquí se sostiene con planes gratuitos, suficiente para los meses que dura la evaluación del proyecto.

| Componente | Servicio sugerido | Costo |
|---|---|---|
| Base de datos | PostgreSQL administrado (Neon o Supabase) | Plan gratuito |
| API | Render (o Railway) | Plan gratuito |
| Frontend | Netlify, Vercel o GitHub Pages | Gratuito |

---

## 1. Base de datos en la nube

1. Cree una cuenta en [Neon](https://neon.tech) o [Supabase](https://supabase.com) y un nuevo proyecto de PostgreSQL.
2. Copie la cadena de conexión que le entregan (formato `postgresql://usuario:clave@host/basededatos`).
3. Conéctese con `psql`, DBeaver o la consola web del proveedor, y ejecute `database/01_AirChaletBI_Schema.sql`.
4. Verifique el resultado:

```sql
\dt
-- Debe listar: usuarios, chalets, chalet_fotos, reglas_precio, reservas, comentarios_dueno

SELECT count(*) FROM usuarios;  -- 0, el sistema arranca vacio
```

Si el proveedor no permite ejecutar `CREATE DATABASE` (algunos entregan la base ya creada), omita esa primera línea del script y ejecute el resto directamente conectado a la base que le asignaron.

---

## 2. Preparar la API

### 2.1 Variables de entorno

En el panel del proveedor de hosting (Render, Railway), defina las variables del archivo `backend/.env.example`:

```
PORT=4000
JWT_SECRET=GENERE_UNA_CLAVE_LARGA_Y_ALEATORIA_AQUI
JWT_EXPIRA_SEG=86400
BCRYPT_ROUNDS=10

DATABASE_URL=postgresql://usuario:clave@host/basededatos
PGSSL=true

URL_BASE=https://SU_API.onrender.com
CORS_ORIGEN=https://SU_FRONTEND.netlify.app
```

`DATABASE_URL` reemplaza a las variables `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` sueltas que se usan en desarrollo local; cuando está definida, tiene prioridad. `PGSSL=true` es obligatorio en casi todos los proveedores administrados.

### 2.2 Clave de firma del token

`JWT_SECRET` debe ser una cadena aleatoria larga, distinta de cualquier valor usado en desarrollo. Puede generar una con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2.3 CORS

`CORS_ORIGEN` debe apuntar exactamente al dominio donde quede publicado el frontend. Si se omite o queda mal escrito, el panel cargará pero ninguna llamada a la API funcionará, y el navegador mostrará un error de origen cruzado (CORS).

### 2.4 Publicar

1. En Render (o Railway), cree un nuevo servicio web apuntando al repositorio de `backend/`.
2. Comando de build: `npm install`.
3. Comando de arranque: `npm start`.
4. Runtime: Node 18 o superior.

El backend crea el esquema automáticamente al iniciar (es idempotente), pero si ya lo creó manualmente con el script SQL no hay conflicto: usa `CREATE TABLE IF NOT EXISTS`.

### 2.5 Comprobar

Abra `https://SU_API.onrender.com/api/salud`. Debe responder `{ "ok": true, "servicio": "AirChaletBI API" }`.

Si la respuesta es un error 500 al primer arranque, revise `DATABASE_URL` y `PGSSL`: casi siempre el problema está ahí.

---

## 3. Frontend en Netlify (o similar)

1. Antes de subir, edite `frontend/js/config.js`:

```javascript
window.API_BASE = 'https://SU_API.onrender.com/api';
```

2. Suba el contenido de la carpeta `frontend/` como sitio estático (arrastrar y soltar en Netlify, o conectar el repositorio).
3. El sitio queda publicado en una URL tipo `https://su-proyecto.netlify.app`.

### Advertencia sobre contenido mixto

Si el frontend se sirve por HTTPS (lo hacen todos estos proveedores por defecto) y la API quedó en HTTP, el navegador bloqueará las llamadas por contenido mixto. Confirme que `API_BASE` use `https://`.

---

## 4. Imágenes y comprobantes en producción

El backend guarda las fotos de chalets y los comprobantes de pago en disco (`backend/uploads/`). En un plan gratuito con **disco efímero** (Render free, por ejemplo), esos archivos se pierden cada vez que el servicio se reinicia o se vuelve a desplegar.

Para persistencia real, la subida de archivos está aislada en `backend/src/middleware/subida.js`, lo que facilita migrarla a un almacenamiento externo (Cloudinary, Supabase Storage, S3) sin tocar el resto del backend: solo cambia dónde se guarda el archivo y qué URL se construye para servirlo.

Para la defensa de la tesis, el disco efímero es una limitación aceptable y documentada, no un defecto del diseño — un despliegue comercial real sí requeriría resolverlo antes de salir a producción.

---

## 5. Primera cuenta administrador en producción

Como el sistema no trae ninguna cuenta predefinida (ver `00-README.md`, sección 6), después de desplegar:

1. Regístrese normalmente desde el frontend con rol propietario.
2. Conéctese a la base de datos en la nube y promueva esa cuenta:

```sql
UPDATE usuarios SET rol = 'admin' WHERE email = 'su_correo@ejemplo.com';
```

No deje esta instrucción documentada con un correo real en ningún repositorio público.

---

## 6. Lista de verificación antes de la entrega

- [ ] El script SQL se ejecutó completo y sin errores, y las tablas quedaron vacías
- [ ] `JWT_SECRET` fue reemplazado por una clave propia, distinta de la de desarrollo
- [ ] `CORS_ORIGEN` apunta exactamente al dominio del frontend publicado
- [ ] `API_BASE` en `frontend/js/config.js` apunta a la API publicada
- [ ] `GET /api/salud` responde correctamente en la URL pública
- [ ] El registro y el inicio de sesión funcionan desde el sitio publicado
- [ ] Se creó y promovió al menos una cuenta administrador
- [ ] Se creó al menos un chalet de prueba y se completó una reserva de punta a punta
- [ ] El reporte PDF se descarga correctamente desde el panel del propietario
- [ ] Ninguna contraseña ni cadena de conexión real quedó escrita en el código fuente subido a un repositorio
