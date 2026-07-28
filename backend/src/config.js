import dotenv from 'dotenv';
dotenv.config();

// Configuracion central. Valores por defecto pensados para correr localmente
// con una instancia de PostgreSQL en el equipo (usuario/clave "postgres").
export const config = {
  puerto: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'cambia-esta-clave-en-produccion',
  // Duracion del token en segundos (24h por defecto).
  jwtExpiraSeg: parseInt(process.env.JWT_EXPIRA_SEG || '86400', 10),
  rondasBcrypt: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // --- PostgreSQL ---
  // Si defines DATABASE_URL (Neon, Supabase, Render, etc.) esa cadena manda.
  // Si no, se arma la conexion con las variables PG* (uso local).
  databaseUrl: process.env.DATABASE_URL || null,
  pgHost: process.env.PGHOST || 'localhost',
  pgPort: parseInt(process.env.PGPORT || '5432', 10),
  pgDatabase: process.env.PGDATABASE || 'airchaletbi',
  pgUser: process.env.PGUSER || 'postgres',
  pgPassword: process.env.PGPASSWORD || 'postgres',
  // Los proveedores en la nube casi siempre exigen SSL.
  pgSsl: process.env.PGSSL === 'true',

  // URL publica del backend, usada para armar las URL de las imagenes.
  urlBase: process.env.URL_BASE || 'http://localhost:4000',
  // Origen permitido para CORS ('*' en el prototipo).
  corsOrigen: process.env.CORS_ORIGEN || '*',
  maxFotosChalet: 5,
};