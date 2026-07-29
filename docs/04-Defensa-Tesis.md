# Guía de defensa

Documento de apoyo para sustentar el prototipo ante el catedrático o el jurado.

---

## 1. Trazabilidad: objetivos de la tesis frente a lo implementado

| Objetivo planteado | Dónde se cumple | Cómo se demuestra |
|---|---|---|
| Centralizar la gestión de reservas de varios propietarios en una sola plataforma | Modelo de datos con aislamiento por `dueno_id`, validado en cada endpoint de escritura | Iniciar sesión con dos cuentas propietario distintas y mostrar que cada una solo ve sus propios chalets y reservas |
| Evitar la doble reserva de un mismo chalet | Validación en `services/chalets.js` + restricción `EXCLUDE` en la base de datos | Intentar reservar dos veces las mismas fechas desde la API; luego mostrar la restricción a nivel SQL con `\d reservas` |
| Calcular precios de temporada alta de forma consistente | `reglas_precio` + `services/util.js -> calcularTotal` | Crear una regla de +5% y reservar en esas fechas; el monto se calcula en el servidor, no en el navegador |
| Medir la demanda por mes, día de semana y temporada | `services/analitica.js`, pestaña Analítica del panel del propietario | Mostrar las gráficas con datos reales de reservas cargadas durante la demostración |
| Proyectar tendencias de demanda | `services/analitica.js -> proyeccion` | Mostrar la gráfica de proyección y explicar la heurística usada |
| Entregar reportes descargables de la operación | `services/reportePdf.js`, endpoint `GET /api/dueno/reporte.pdf` | Descargar el PDF de un rango de fechas frente al jurado |
| Proteger los datos de contacto y ubicación del chalet hasta confirmar el pago | `services/chalets.js -> detalle()`, `services/reservas.js -> componer()` | Mostrar que la dirección viaja como `null` en una reserva pendiente y aparece al aceptarla |

---

## 2. Preguntas previsibles del catedrático

### ¿Cómo evita que dos clientes reserven el mismo chalet en las mismas fechas?

Con dos capas, igual que se exige en un diseño defendible de base de datos. La primera es una validación en `services/reservas.js` antes de insertar (`estaDisponible()`), que recorre las reservas vigentes del chalet y verifica si el rango solicitado se traslapa con alguna. La segunda, y la que realmente garantiza la integridad ante condiciones de carrera, es una restricción `EXCLUDE USING gist` en PostgreSQL sobre `(chalet_id, rango_fechas)`, filtrada a reservas en estado `pendiente` o `aceptada`.

Si dos solicitudes llegan casi al mismo tiempo para el mismo chalet, la validación de la aplicación podría dejar pasar ambas —revisan la base en instantes muy cercanos, antes de que la primera termine de escribirse—, pero el motor de base de datos rechaza la segunda inserción de forma física, sin depender de que el código de la aplicación lo haya contemplado. Esto se puede demostrar insertando directamente por SQL, sin pasar por la API, para mostrar que la restricción realmente vive en el motor y no solo en el código Node.js.

### ¿Por qué las fechas se guardan como texto y no como tipo DATE?

Es una decisión deliberada, no un descuido. El driver de PostgreSQL para Node.js (`pg`) convierte las columnas `DATE` en objetos `Date` de JavaScript interpretados en la zona horaria del proceso que corre el backend. Eso puede desplazar la fecha mostrada en un día, dependiendo de dónde esté desplegado el servidor respecto a la zona horaria de Guatemala. Guardando el mismo string `'YYYY-MM-DD'` que el cliente envía —y comparándolo siempre como texto en el backend— se elimina esa categoría entera de error.

Esto no impide aprovechar las capacidades de fecha de PostgreSQL donde realmente se necesitan: la columna generada `rango_fechas` reconstruye la fecha real internamente, solo para que la restricción `EXCLUDE` pueda operar con tipos de rango nativos (`daterange`). Es un ejemplo de usar el tipo de dato correcto en cada capa según lo que esa capa necesita, no un mismo tipo de dato "por defecto" en todos lados.

### ¿Dónde se guardan los horarios o fechas disponibles de cada chalet?

En ningún lado, de la misma forma en que no se almacenan cupos disponibles en un sistema de citas médicas. La disponibilidad se calcula en el momento: se recorren las reservas vigentes del chalet y se determina si el rango solicitado se traslapa con alguna. Al cancelar o declinar una reserva, el rango de fechas vuelve a estar disponible automáticamente, sin ninguna tabla adicional que mantener sincronizada y que pudiera quedar desactualizada.

### ¿Cómo se protegen las contraseñas?

Con bcrypt (10 rondas de costo), vía la librería `bcryptjs`. Nunca se almacena la contraseña en texto plano ni con un algoritmo de hash simple como SHA-256 sin costo ajustable, que sería vulnerable a ataques de fuerza bruta con hardware moderno. bcrypt incorpora un salt aleatorio por contraseña de forma automática, evitando ataques de tabla precalculada (rainbow tables).

### ¿Por qué no hay una tabla separada de roles o de estados de reserva?

Porque son catálogos fijos y pequeños (tres roles, cuatro estados) sin atributos adicionales que ameriten su propia tabla — a diferencia, por ejemplo, de un catálogo de especialidades médicas, que sí necesita nombre, descripción y poder crecer con el tiempo. Se implementan como restricciones `CHECK` sobre una columna `TEXT`, lo que además evita la necesidad de un script de datos iniciales solo para poblar catálogos: el esquema por sí solo deja el sistema listo para operar, sin ninguna fila precargada.

### ¿Por qué el precio de la reserva no lo calcula el navegador?

Porque cualquier cálculo hecho en el cliente puede manipularse antes de enviarse al servidor — por ejemplo, interceptando la petición y cambiando el monto. `services/reservas.js` ignora cualquier precio que llegue en el cuerpo de la petición y recalcula el total desde cero en el servidor, a partir del precio del chalet almacenado en la base de datos y las reglas de precio vigentes en esas fechas. El navegador solo *muestra* una estimación; la fuente de verdad es siempre el backend.

### ¿Qué pasa si el propietario cambia el precio de un chalet después de que ya existen reservas?

Las reservas existentes no se recalculan: `monto_total` se guarda de forma definitiva en el momento en que se crea la reserva, precisamente para que refleje el precio que el cliente aceptó pagar en ese momento, sin quedar sujeto a cambios posteriores del propietario.

### ¿Cómo escalaría el sistema si crece a muchos propietarios y chalets?

Para el volumen de un prototipo académico, o incluso de una operación pequeña real, no hace falta escalar. La arquitectura en capas permite pasos concretos si fuera necesario: los índices ya creados sobre `dueno_id`, `chalet_id` y `cliente_id` aceleran las consultas más frecuentes a medida que crecen las tablas; el backend no guarda estado en memoria entre peticiones (toda la sesión vive en el JWT del cliente), por lo que se pueden ejecutar varias instancias detrás de un balanceador sin coordinación adicional; y la generación del reporte PDF, al transmitirse en flujo sin escribir a disco, no se ve afectada por el número de instancias corriendo en paralelo.

Deliberadamente no se incluyeron microservicios ni una cola de trabajos en segundo plano: introducirlos en un sistema de este tamaño agregaría complejidad operativa sin beneficio medible.

### ¿Qué limitaciones reconoce el prototipo?

Es preferible señalarlas antes de que las pregunten:

- No procesa pagos en línea; el pago es por transferencia bancaria externa, con comprobante subido manualmente y confirmado por el propietario.
- No implementa autenticación de dos factores, por decisión de alcance.
- La proyección de demanda es una heurística de promedio histórico, no un modelo de aprendizaje automático — es honesto sobre eso en la propia respuesta de la API (`metodo`).
- La Semana Santa, por ser una fecha móvil, no se detecta automáticamente en el conteo de feriados.
- Las imágenes se guardan en disco local del servidor; en un hosting con almacenamiento efímero se pierden al reiniciar el servicio (documentado en `03-Despliegue.md`).
- No incluye pruebas automatizadas, que serían exigibles en un producto real.
- No hay cifrado en reposo de la base de datos.
- Un despliegue comercial real requeriría pasarela de pago certificada, auditoría de seguridad y validación legal del tratamiento de datos personales.

---

## 3. Guion sugerido de demostración (10 minutos)

**Minuto 0–1. Contexto.** El problema: varios propietarios administrando su disponibilidad por separado, sin visibilidad de la demanda real ni de qué temporadas conviene subir el precio.

**Minuto 1–2. Registro e ingreso.** Mostrar el registro público (solo cliente o propietario) y explicar por qué el rol administrador se crea aparte.

**Minuto 2–4. Creación del chalet.** Como propietario: crear un chalet, subir sus fotos, y agregar una regla de precio de temporada alta.

**Minuto 4–6. Reserva desde el lado del cliente.** Buscar el chalet, mostrar que la dirección aún no es visible, solicitar la reserva en fechas dentro de la regla de precio y verificar que el monto ya incluye el recargo.

**Minuto 6–7. Doble reserva.** Intentar reservar las mismas fechas con otra cuenta cliente y mostrar el rechazo. Opcionalmente, mostrar la restricción `EXCLUDE` directamente en la base de datos para demostrar que la protección no depende solo del código de la aplicación.

**Minuto 7–8. Confirmación.** Subir el comprobante, volver al panel del propietario, aceptar la reserva, y mostrar que la dirección ahora es visible del lado del cliente.

**Minuto 8–9. Analítica y reporte.** Mostrar las gráficas de demanda por mes y por chalet, y descargar el reporte PDF de un rango de fechas frente al jurado.

**Minuto 9–10. Cierre.** Mencionar brevemente las limitaciones reconocidas (sección 2 de este documento) y las decisiones de diseño más defendibles: precio calculado en servidor, restricción de doble reserva a nivel de base de datos, y datos sensibles ocultos hasta la confirmación del pago.

---

## 4. Justificación de la selección tecnológica

| Decisión | Razón |
|---|---|
| Node.js / Express | Curva de aprendizaje baja para un equipo pequeño, ecosistema maduro, sin licencia |
| PostgreSQL | Motor de código abierto con soporte transaccional completo y tipos avanzados (`daterange`, `EXCLUDE`) que resuelven directamente el problema de doble reserva |
| `pg` (node-postgres) sin ORM | Control total sobre las consultas SQL, sin la curva de aprendizaje ni las capas de abstracción de un ORM completo, adecuado para un esquema de solo 6 tablas |
| JavaScript sin framework de frontend | El proyecto no justifica una capa de compilación; el resultado se despliega como archivos estáticos y es más fácil de mantener y de explicar |
| Bootstrap 5 | Diseño adaptable sin escribir CSS desde cero |
| Chart.js | Librería de gráficas ligera, de licencia abierta, sin dependencias |
| JWT | Estándar sin estado; permite escalar horizontalmente sin sesiones compartidas en el servidor |
| bcrypt | Algoritmo de hash diseñado específicamente para contraseñas, con costo ajustable y salt automático |
| PDFKit | Generación de PDF en el propio proceso Node.js, sin depender de un servicio externo ni de binarios adicionales |
