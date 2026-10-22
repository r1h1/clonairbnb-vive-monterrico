import { Router } from 'express';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { subirComprobante as multerComprobante } from '../middleware/subida.js';
import { asyncH } from '../services/util.js';
import * as Reservas from '../services/reservas.js';

const router = Router();

// Cliente crea una reserva (queda pendiente).
router.post('/', requiereAuth, requiereRol('cliente'), asyncH(async (req, res) => {
  res.status(201).json(await Reservas.crear(req.usuario.id, req.body));
}));

// Cliente adjunta el comprobante de pago.
router.post(
  '/:id/comprobante',
  requiereAuth,
  requiereRol('cliente'),
  multerComprobante.single('comprobante'),
  asyncH(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibio el comprobante' });
    res.json(await Reservas.subirComprobante(Number(req.params.id), req.usuario.id, req.file));
  })
);

// Listados por rol.
router.get('/mias', requiereAuth, requiereRol('cliente'), asyncH(async (req, res) => {
  res.json(await Reservas.listarDeCliente(req.usuario.id));
}));

router.get('/dueno', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await Reservas.listarDeDueno(req.usuario.id));
}));

router.get('/:id', requiereAuth, asyncH(async (req, res) => {
  res.json(await Reservas.verUna(Number(req.params.id), req.usuario));
}));

// Dueno acepta o declina.
router.put('/:id/aceptar', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await Reservas.decidir(Number(req.params.id), req.usuario, true));
}));

router.put('/:id/declinar', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await Reservas.decidir(Number(req.params.id), req.usuario, false, req.body.motivo));
}));

// Cliente cancela.
router.put('/:id/cancelar', requiereAuth, asyncH(async (req, res) => {
  res.json(await Reservas.cancelar(Number(req.params.id), req.usuario));
}));

export default router;