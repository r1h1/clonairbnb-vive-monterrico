import { Router } from 'express';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { subirFotosChalet } from '../middleware/subida.js';
import { asyncH } from '../services/util.js';
import * as Chalets from '../services/chalets.js';
import * as Dueno from '../services/dueno.js';
import { config } from '../config.js';

const router = Router();

// Middleware suave: si hay token lo decodifica, si no, sigue como anonimo.
// Sirve para revelar datos sensibles solo a quien tenga reserva aceptada.
function authOpcional(req, res, next) {
  if (req.headers.authorization) return requiereAuth(req, res, next);
  next();
}

// --- Publico ---
router.get('/', asyncH(async (req, res) => {
  const { playa, huespedes, entrada, salida } = req.query;
  res.json(await Chalets.listarPublico({ playa, huespedes, entrada, salida }));
}));

// Chalets del dueno autenticado (debe ir antes de '/:id').
router.get('/mios', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await Chalets.listarPorDueno(req.usuario.id));
}));

router.get('/:id', authOpcional, asyncH(async (req, res) => {
  res.json(await Chalets.detalle(Number(req.params.id), req.usuario || null));
}));

router.get('/:id/comentarios', asyncH(async (req, res) => {
  res.json(await Dueno.listarComentarios(Number(req.params.id)));
}));

// --- Dueno ---
router.post('/', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.status(201).json(await Chalets.crear(req.usuario.id, req.body));
}));

router.put('/:id', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await Chalets.actualizar(Number(req.params.id), req.usuario, req.body));
}));

router.delete('/:id', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  await Chalets.eliminar(Number(req.params.id), req.usuario);
  res.json({ ok: true });
}));

router.post(
  '/:id/fotos',
  requiereAuth,
  requiereRol('dueno', 'admin'),
  subirFotosChalet.array('fotos', config.maxFotosChalet),
  asyncH(async (req, res) => {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No se recibieron imagenes' });
    res.json(await Chalets.agregarFotos(Number(req.params.id), req.usuario, req.files));
  })
);

router.post('/:id/reglas', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await Chalets.agregarRegla(Number(req.params.id), req.usuario, req.body));
}));

router.delete('/reglas/:reglaId', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  await Chalets.eliminarRegla(Number(req.params.reglaId), req.usuario);
  res.json({ ok: true });
}));

router.post('/:id/comentarios', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.status(201).json(await Dueno.crearComentario(Number(req.params.id), req.usuario, req.body.mensaje));
}));

router.delete('/comentarios/:comentarioId', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  await Dueno.eliminarComentario(Number(req.params.comentarioId), req.usuario);
  res.json({ ok: true });
}));

export default router;