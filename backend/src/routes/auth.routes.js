import { Router } from 'express';
import { registrar, autenticar, porId } from '../services/usuarios.js';
import { firmarToken, requiereAuth } from '../middleware/auth.js';
import { asyncH } from '../services/util.js';

const router = Router();

router.post('/registro', asyncH(async (req, res) => {
  const usuario = await registrar(req.body);
  const token = firmarToken(usuario);
  res.status(201).json({ usuario, token });
}));

router.post('/login', asyncH(async (req, res) => {
  const usuario = await autenticar(req.body);
  const token = firmarToken(usuario);
  res.json({ usuario, token });
}));

router.get('/me', requiereAuth, asyncH(async (req, res) => {
  res.json({ usuario: await porId(req.usuario.id) });
}));

export default router;