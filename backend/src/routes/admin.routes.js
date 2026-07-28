import { Router } from 'express';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { asyncH } from '../services/util.js';
import { listarUsuarios, eliminarUsuario } from '../services/usuarios.js';
import { listarTodas } from '../services/reservas.js';
import { query } from '../db.js';

const router = Router();

// Todo lo de admin exige rol admin.
router.use(requiereAuth, requiereRol('admin'));

router.get('/usuarios', asyncH(async (req, res) => {
  res.json(await listarUsuarios());
}));

router.delete('/usuarios/:id', asyncH(async (req, res) => {
  await eliminarUsuario(Number(req.params.id), req.usuario);
  res.json({ ok: true });
}));

// El admin puede ver todos los chalets y todas las reservas.
router.get('/chalets', asyncH(async (req, res) => {
  const filas = await query(
    `SELECT c.*, u.nombre AS dueno FROM chalets c JOIN usuarios u ON u.id = c.dueno_id ORDER BY c.creado DESC`
  );
  res.json(filas.map((c) => ({ ...c, precio_noche: Number(c.precio_noche) })));
}));

router.get('/reservas', asyncH(async (req, res) => {
  res.json(await listarTodas());
}));

export default router;