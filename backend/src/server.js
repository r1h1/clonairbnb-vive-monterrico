import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { inicializarEsquema } from './db.js';
import { ErrorApp } from './services/util.js';

import authRoutes from './routes/auth.routes.js';
import chaletsRoutes from './routes/chalets.routes.js';
import reservasRoutes from './routes/reservas.routes.js';
import duenoRoutes from './routes/dueno.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: config.corsOrigen }));
app.use(express.json());

// Archivos subidos (imagenes de chalets y comprobantes).
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/salud', (req, res) => res.json({ ok: true, servicio: 'ViveMonterrico API' }));

app.use('/api/auth', authRoutes);
app.use('/api/chalets', chaletsRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/dueno', duenoRoutes);
app.use('/api/admin', adminRoutes);

// 404 para rutas de API no encontradas.
app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

// Manejo central de errores. Los errores de negocio (ErrorApp) llevan codigo;
// el resto se reporta como 500 sin filtrar detalles internos.
app.use((err, req, res, next) => {
  if (err instanceof ErrorApp) return res.status(err.codigo).json({ error: err.message });
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'La imagen supera el limite de 4 MB' });
  if (err && err.message && /imagenes/.test(err.message)) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

inicializarEsquema()
  .then(() => {
    app.listen(config.puerto, () => {
      console.log(`ViveMonterrico API escuchando en ${config.urlBase} (puerto ${config.puerto})`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a PostgreSQL:', err.message);
    console.error('Verifica DATABASE_URL o las variables PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD en tu .env');
    process.exit(1);
  });