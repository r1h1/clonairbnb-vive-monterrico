import { Router } from 'express';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { asyncH } from '../services/util.js';
import * as Empleados from '../services/empleados.js';

const router = Router();

// Todo lo de empleados exige rol dueno o admin (el personal no inicia
// sesion en la plataforma, es solo un contacto del dueno).
router.use(requiereAuth, requiereRol('dueno', 'admin'));

router.get('/', asyncH(async (req, res) => {
  res.json(await Empleados.listar(req.usuario.id));
}));

router.post('/', asyncH(async (req, res) => {
  res.status(201).json(await Empleados.crear(req.usuario.id, req.body));
}));

router.put('/:id', asyncH(async (req, res) => {
  res.json(await Empleados.actualizar(Number(req.params.id), req.usuario, req.body));
}));

router.delete('/:id', asyncH(async (req, res) => {
  await Empleados.eliminar(Number(req.params.id), req.usuario);
  res.json({ ok: true });
}));

router.get('/reservas/:reservaId', asyncH(async (req, res) => {
  res.json(await Empleados.listarAsignaciones(Number(req.params.reservaId), req.usuario));
}));

router.post('/reservas/:reservaId/asignar', asyncH(async (req, res) => {
  res.json(await Empleados.asignar(Number(req.params.reservaId), req.usuario, req.body.empleado_ids));
}));

router.delete('/reservas/:reservaId/empleados/:empleadoId', asyncH(async (req, res) => {
  await Empleados.desasignar(Number(req.params.reservaId), Number(req.params.empleadoId), req.usuario);
  res.json({ ok: true });
}));

router.put('/reservas/:reservaId/empleados/:empleadoId/notificado', asyncH(async (req, res) => {
  res.json(await Empleados.marcarNotificado(Number(req.params.reservaId), Number(req.params.empleadoId), req.usuario));
}));

export default router;
