import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, query, queryUna, inicializarEsquema } from './db.js';
import { config } from './config.js';
import { calcularTotal } from './services/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hash = (p) => bcrypt.hashSync(p, config.rondasBcrypt);

async function crearUsuario(nombre, email, password, telefono, rol) {
  const u = await queryUna(
    'INSERT INTO usuarios (nombre, email, password, telefono, rol) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [nombre, email, hash(password), telefono, rol]
  );
  return u.id;
}

async function crearChalet(duenoId, nombre, playa, descripcion, precio, capacidad, direccion, checkin) {
  const c = await queryUna(
    `INSERT INTO chalets (dueno_id, nombre, playa, descripcion, precio_noche, capacidad, direccion_completa, instrucciones_checkin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [duenoId, nombre, playa, descripcion, precio, capacidad, direccion, checkin]
  );
  return c.id;
}

async function main() {
  // Carga datos de ejemplo para poder probar y ver la analitica de inmediato.
  // Ejecutar con: npm run seed  (borra y regenera los datos).
  // No ejecutar este script contra una base de datos de produccion.
  await inicializarEsquema();

  console.log('Limpiando datos previos...');
  await query('TRUNCATE TABLE comentarios_dueno, reglas_precio, chalet_fotos, reservas, chalets, usuarios RESTART IDENTITY CASCADE');

  const credenciales = [
    ['Administrador', 'admin@airchaletbi.com', 'admin123', '50200000000', 'admin'],
    ['Jennifer Vasquez', 'jenny@airchaletbi.com', 'dueno123', '50255551111', 'dueno'],
    ['Carlos Lopez', 'carlos@airchaletbi.com', 'dueno123', '50255552222', 'dueno'],
    ['Juan Perez', 'juan@correo.com', 'cliente123', '50255553333', 'cliente'],
    ['Maria Gomez', 'maria@correo.com', 'cliente123', '50255554444', 'cliente'],
  ];
  const ids = {};
  for (const [nombre, email, password, telefono, rol] of credenciales) {
    ids[email] = await crearUsuario(nombre, email, password, telefono, rol);
  }
  const dueno1Id = ids['jenny@airchaletbi.com'];
  const dueno2Id = ids['carlos@airchaletbi.com'];
  const cli1Id = ids['juan@correo.com'];
  const cli2Id = ids['maria@correo.com'];

  const chaletIds = [];
  chaletIds.push(await crearChalet(dueno1Id, 'Chalet Vista al Mar', 'Monterrico', 'Frente al mar, 4 habitaciones, piscina.', 1200, 8, 'Calle del Mar 1, Monterrico', 'Check-in 3pm. Recoger llaves en caseta azul.'));
  chaletIds.push(await crearChalet(dueno1Id, 'Chalet La Tortuga', 'Monterrico', '3 habitaciones, piscina privada.', 950, 6, 'Av. Tortugario 5, Monterrico', 'Check-in 2pm. Timbre A.'));
  chaletIds.push(await crearChalet(dueno1Id, 'Chalet Sunset', 'Monterrico', '4 habitaciones, piscina y terraza.', 1400, 10, 'Playa Sunset 8, Monterrico', 'Check-in 3pm. Codigo porton 4821.'));
  chaletIds.push(await crearChalet(dueno2Id, 'Chalet El Paraiso', 'Iztapa', '2 habitaciones, jardin privado.', 850, 4, 'Barrio El Paraiso 3, Iztapa', 'Check-in 1pm. Llamar al llegar.'));
  chaletIds.push(await crearChalet(dueno2Id, 'Chalet Brisa', 'Iztapa', 'Economico, cerca de la playa.', 650, 4, 'Calle Brisa 2, Iztapa', 'Check-in 2pm.'));

  // Regla de temporada alta: +5% del 12 al 16 de septiembre (Independencia).
  const anio = new Date().getFullYear();
  await query(
    'INSERT INTO reglas_precio (chalet_id, fecha_inicio, fecha_fin, porcentaje) VALUES ($1,$2,$3,$4)',
    [chaletIds[0], `${anio}-09-12`, `${anio}-09-16`, 5]
  );

  // Reservas repartidas en el anio para que la analitica muestre datos.
  const f = (m, d) => `${anio}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const muestras = [
    [chaletIds[0], cli1Id, f(9, 14), f(9, 16), 6, 'aceptada'],
    [chaletIds[0], cli2Id, f(12, 24), f(12, 26), 8, 'aceptada'],
    [chaletIds[1], cli1Id, f(3, 28), f(3, 30), 4, 'aceptada'],
    [chaletIds[1], cli2Id, f(7, 20), f(7, 23), 5, 'pendiente'],
    [chaletIds[2], cli1Id, f(11, 1), f(11, 3), 7, 'aceptada'],
    [chaletIds[3], cli2Id, f(1, 1), f(1, 3), 4, 'aceptada'],
    [chaletIds[4], cli1Id, f(6, 30), f(7, 2), 3, 'aceptada'],
  ];
  for (const [chaletId, cliId, entrada, salida, huespedes, estado] of muestras) {
    const ch = await queryUna('SELECT precio_noche FROM chalets WHERE id = $1', [chaletId]);
    const reglas = (await query('SELECT * FROM reglas_precio WHERE chalet_id = $1', [chaletId]))
      .map((r) => ({ ...r, porcentaje: Number(r.porcentaje) }));
    const { total } = calcularTotal(Number(ch.precio_noche), reglas, entrada, salida);
    await query(
      `INSERT INTO reservas (chalet_id, cliente_id, fecha_entrada, fecha_salida, huespedes, monto_total, comprobante, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [chaletId, cliId, entrada, salida, huespedes, total, 'demo.png', estado]
    );
  }

  await query(
    'INSERT INTO comentarios_dueno (chalet_id, mensaje) VALUES ($1, $2)',
    [chaletIds[0], 'Aviso: de 7:00 a 13:00 no habra luz por mantenimiento de la municipalidad.']
  );

  // Los accesos de prueba se guardan en un archivo LOCAL que no se sube a git
  // (ver .gitignore) para no exponer credenciales en el entregable ni en la UI.
  const contenido = `# Accesos de prueba (solo entorno local de desarrollo)

Generado por \`npm run seed\` el ${new Date().toLocaleString('es-GT')}.
Este archivo no se incluye en el control de versiones y no debe usarse
ni mostrarse en un entorno de produccion.

| Rol      | Email                     | Contrasena  |
|----------|---------------------------|-------------|
| Admin    | admin@airchaletbi.com     | admin123    |
| Dueno    | jenny@airchaletbi.com     | dueno123    |
| Dueno    | carlos@airchaletbi.com    | dueno123    |
| Cliente  | juan@correo.com           | cliente123  |
| Cliente  | maria@correo.com          | cliente123  |
`;
  fs.writeFileSync(path.join(__dirname, '..', 'SEED-LOCAL.md'), contenido);

  console.log('\nDatos de ejemplo cargados para desarrollo y pruebas locales.');
  console.log('Los accesos de prueba quedaron en backend/SEED-LOCAL.md (no se sube a git).');

  await pool.end();
}

main().catch((err) => {
  console.error('Error al cargar los datos de ejemplo:', err.message);
  process.exit(1);
});