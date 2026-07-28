import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

// Conexion a PostgreSQL. Si hay DATABASE_URL (proveedor en la nube) se usa
// esa cadena; si no, se arma con host/usuario/clave para desarrollo local.
export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.pgSsl ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: config.pgHost,
      port: config.pgPort,
      database: config.pgDatabase,
      user: config.pgUser,
      password: config.pgPassword,
    });

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

// Ejecuta una consulta y devuelve todas las filas.
export async function query(texto, params = []) {
  const { rows } = await pool.query(texto, params);
  return rows;
}

// Ejecuta una consulta y devuelve solo la primera fila (o null).
export async function queryUna(texto, params = []) {
  const filas = await query(texto, params);
  return filas[0] || null;
}

// Esquema. Se crea solo si no existe, asi el arranque es idempotente.
// Nota: las fechas de reserva/reglas se guardan como TEXT ('YYYY-MM-DD') en
// lugar de DATE a proposito, para trabajar siempre con el mismo string que
// escribe el cliente y evitar corrimientos de zona horaria al leerlas.
export async function inicializarEsquema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id           SERIAL PRIMARY KEY,
      nombre       TEXT NOT NULL,
      email        TEXT NOT NULL UNIQUE,
      password     TEXT NOT NULL,
      telefono     TEXT NOT NULL,
      rol          TEXT NOT NULL CHECK (rol IN ('cliente','dueno','admin')),
      creado       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chalets (
      id                    SERIAL PRIMARY KEY,
      dueno_id              INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nombre                TEXT NOT NULL,
      playa                 TEXT NOT NULL,
      descripcion           TEXT,
      precio_noche          NUMERIC(10,2) NOT NULL,
      capacidad             INTEGER NOT NULL,
      -- Datos sensibles: solo se revelan cuando una reserva del cliente fue aceptada.
      direccion_completa    TEXT,
      instrucciones_checkin TEXT,
      activo                BOOLEAN NOT NULL DEFAULT true,
      creado                TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chalet_fotos (
      id         SERIAL PRIMARY KEY,
      chalet_id  INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
      url        TEXT NOT NULL
    );

    -- Reglas de precio por rango de fechas (ej. +5% del 12 al 16 de septiembre).
    CREATE TABLE IF NOT EXISTS reglas_precio (
      id           SERIAL PRIMARY KEY,
      chalet_id    INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
      fecha_inicio TEXT NOT NULL,
      fecha_fin    TEXT NOT NULL,
      porcentaje   NUMERIC(5,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id             SERIAL PRIMARY KEY,
      chalet_id      INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
      cliente_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha_entrada  TEXT NOT NULL,
      fecha_salida   TEXT NOT NULL,
      huespedes      INTEGER NOT NULL,
      monto_total    NUMERIC(10,2) NOT NULL,
      comprobante    TEXT,
      estado         TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','aceptada','declinada','cancelada')),
      motivo_rechazo TEXT,
      creado         TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Avisos del dueno visibles para quien mira el chalet (no es un chat).
    CREATE TABLE IF NOT EXISTS comentarios_dueno (
      id         SERIAL PRIMARY KEY,
      chalet_id  INTEGER NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
      mensaje    TEXT NOT NULL,
      creado     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_chalets_dueno   ON chalets(dueno_id);
    CREATE INDEX IF NOT EXISTS idx_reservas_chalet ON reservas(chalet_id);
    CREATE INDEX IF NOT EXISTS idx_reservas_cli    ON reservas(cliente_id);
  `);
}