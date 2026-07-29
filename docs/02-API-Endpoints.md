# Catálogo de endpoints REST

Base: `/api`. Las respuestas exitosas devuelven directamente el recurso solicitado (objeto o arreglo JSON), sin un sobre adicional. Las respuestas de error tienen esta forma uniforme:

```json
{ "error": "Descripción legible del problema" }
```

## Códigos de estado utilizados

| Código | Cuándo se devuelve |
|---|---|
| 200 | Consulta o actualización correcta |
| 201 | Recurso creado |
| 400 | Datos de entrada inválidos, o regla de negocio incumplida (ej. fechas no disponibles) |
| 401 | Falta el token, expiró, o las credenciales son incorrectas |
| 403 | El rol o la propiedad del recurso no autoriza la operación |
| 404 | El recurso no existe |
| 500 | Error no controlado |

Todas las rutas exigen `Authorization: Bearer {token}` salvo donde se indique **Anónimo** o **Público**.

---

## Autenticación — `/api/auth`

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/registro` | Anónimo | Registro público, solo permite rol `cliente` o `dueno` |
| POST | `/login` | Anónimo | Valida credenciales y devuelve `{ usuario, token }` |
| GET | `/me` | Autenticado | Datos del usuario en sesión |

**POST /auth/login**

```json
{ "email": "correo@ejemplo.com", "password": "..." }
```

Un correo inexistente y una contraseña incorrecta devuelven el mismo mensaje (*Credenciales incorrectas*), de forma deliberada.

---

## Chalets — `/api/chalets`

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/` | Público | Listado con filtros `playa`, `huespedes`, `entrada`, `salida` (estos dos últimos filtran por disponibilidad real) |
| GET | `/mios` | dueno, admin | Chalets del propietario autenticado, con datos sensibles incluidos |
| GET | `/:id` | Público (opcional) | Detalle; incluye dirección e instrucciones de check-in solo si quien pregunta es el dueño, admin, o tiene una reserva aceptada en ese chalet |
| GET | `/:id/comentarios` | Público | Avisos publicados por el propietario para ese chalet |
| POST | `/` | dueno, admin | Crea un chalet |
| PUT | `/:id` | dueno, admin | Actualiza (solo el propietario del chalet, o admin) |
| DELETE | `/:id` | dueno, admin | Elimina el chalet y en cascada sus fotos, reglas, reservas y avisos |
| POST | `/:id/fotos` | dueno, admin | Sube hasta 5 fotos por chalet (multipart/form-data, campo `fotos`) |
| POST | `/:id/reglas` | dueno, admin | Crea una regla de recargo por temporada |
| DELETE | `/reglas/:reglaId` | dueno, admin | Elimina una regla de precio |
| POST | `/:id/comentarios` | dueno, admin | Publica un aviso en el chalet |
| DELETE | `/comentarios/:comentarioId` | dueno, admin | Elimina un aviso |

**GET /chalets/:id** (respuesta de ejemplo, sin datos sensibles)

```json
{
  "id": 1,
  "nombre": "Chalet Vista al Mar",
  "playa": "Monterrico",
  "precio_noche": 1200,
  "capacidad": 8,
  "activo": true,
  "fotos": ["http://localhost:4000/uploads/chalets/foto1.png"],
  "reglas_precio": [{ "id": 1, "fecha_inicio": "2026-09-12", "fecha_fin": "2026-09-16", "porcentaje": 5 }],
  "noches_ocupadas": ["2026-09-14", "2026-09-15"]
}
```

---

## Reservas — `/api/reservas`

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/` | cliente | Crea una reserva (queda `pendiente`); el precio lo calcula el servidor |
| POST | `/:id/comprobante` | cliente | Sube el comprobante de pago (multipart/form-data, campo `comprobante`), solo si la reserva está pendiente y es del propio cliente |
| GET | `/mias` | cliente | Reservas del cliente autenticado |
| GET | `/dueno` | dueno, admin | Reservas de todos los chalets del propietario autenticado |
| GET | `/:id` | Autenticado | Detalle, solo si es el cliente, el dueño del chalet, o admin |
| PUT | `/:id/aceptar` | dueno, admin | Acepta una reserva pendiente; libera dirección e instrucciones al cliente |
| PUT | `/:id/declinar` | dueno, admin | Declina, exige `{ "motivo": "..." }` en el cuerpo |
| PUT | `/:id/cancelar` | cliente, admin | Cancela una reserva propia, mientras no esté ya declinada o cancelada |

**POST /reservas**

```json
{ "chalet_id": 1, "fecha_entrada": "2026-09-12", "fecha_salida": "2026-09-14", "huespedes": 4 }
```

**Reglas validadas al crear una reserva**

1. El chalet debe existir y estar activo.
2. `fecha_salida` debe ser posterior a `fecha_entrada`, y `fecha_entrada` no puede estar en el pasado.
3. `huespedes` no puede exceder la capacidad del chalet.
4. El rango de fechas no puede solaparse con otra reserva viva (`pendiente` o `aceptada`) del mismo chalet — validado en la aplicación y, como respaldo ante condiciones de carrera, por la restricción `EXCLUDE` de la base de datos.
5. El monto se calcula multiplicando el precio por noche por el número de noches, aplicando el recargo de cualquier regla de precio vigente en esas fechas.

---

## Propietario — `/api/dueno`

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/dashboard` | dueno, admin | Chalets creados, con reserva activa, disponibles, reservas pendientes, y tabla de quién reservó (con teléfono) |
| GET | `/analitica/demanda` | dueno, admin | Noches por mes, por día de semana, chalets más reservados y feriados con demanda |
| GET | `/analitica/proyeccion` | dueno, admin | Proyección heurística de demanda por mes |
| GET | `/reporte.pdf` | dueno, admin | Descarga un PDF con el detalle de reservas de un rango de fechas (`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`) |

El administrador ve el agregado de **todos** los propietarios en `analitica` y en `reporte.pdf`; el propietario ve únicamente lo suyo. El parámetro que distingue el alcance (`scope`) nunca lo decide el cliente: lo determina el backend a partir del rol del token.

**GET /dueno/reporte.pdf?desde=2026-01-01&hasta=2026-12-31**

Responde con `Content-Type: application/pdf` y `Content-Disposition: attachment`, listo para descargar desde el navegador.

---

## Administración — `/api/admin`

Todas las rutas de este grupo exigen rol `admin`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/usuarios` | Lista todas las cuentas |
| DELETE | `/usuarios/:id` | Elimina un cliente o propietario (no admins, no la propia cuenta) |
| GET | `/chalets` | Lista todos los chalets de todos los propietarios, con el nombre del dueño |
| GET | `/reservas` | Lista todas las reservas del sistema |

La eliminación de un usuario elimina en cascada (`ON DELETE CASCADE`) sus chalets y reservas asociadas.

---

## Salud del servicio

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/salud` | Anónimo | `{ "ok": true, "servicio": "AirChaletBI API" }`, útil para monitoreo básico |
