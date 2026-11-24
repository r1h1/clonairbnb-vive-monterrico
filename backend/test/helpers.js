// Utilidades para las pruebas de integracion: levantan la API real en un
// puerto aparte y la consultan por HTTP contra PostgreSQL.
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { pool, inicializarEsquema } from '../src/db.js';

export const PUERTO = 4100;
export const BASE = `http://localhost:${PUERTO}/api`;
export const SUFIJO = Date.now();

export async function levantarServidor() {
  await inicializarEsquema();
  const proc = spawn('node', ['src/server.js'], {
    env: { ...process.env, PORT: String(PUERTO), URL_BASE: `http://localhost:${PUERTO}` },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/salud`)).ok) return proc; } catch { /* aun no arranca */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error('El servidor de pruebas no arranco');
}

export async function http(metodo, ruta, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + ruta, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
  return { status: res.status, data };
}

// Crea un usuario de prueba y devuelve { id, token }.
export async function crearUsuario(rol, etiqueta) {
  const email = `test-${etiqueta}-${SUFIJO}@prueba.local`;
  const hash = bcrypt.hashSync('prueba123', 4);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, email, password, telefono, rol) VALUES ($1,$2,$3,'55550000',$4) RETURNING id`,
    [`Test ${etiqueta}`, email, hash, rol]
  );
  const { data } = await http('POST', '/auth/login', { body: { email, password: 'prueba123' } });
  return { id: rows[0].id, token: data.token };
}

export async function crearChalet(duenoId) {
  const { rows } = await pool.query(
    `INSERT INTO chalets (dueno_id, nombre, playa, precio_noche, capacidad)
     VALUES ($1,'Chalet de prueba','Monterrico',500,6) RETURNING id`,
    [duenoId]
  );
  return rows[0].id;
}

// Borra todo lo creado por las pruebas (el CASCADE limpia chalets y reservas).
export async function limpiar() {
  await pool.query(`DELETE FROM usuarios WHERE email LIKE $1`, [`test-%-${SUFIJO}@prueba.local`]);
}

export function fechaFutura(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
