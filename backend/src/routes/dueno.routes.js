import { Router } from 'express';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { asyncH, esFecha, ErrorApp } from '../services/util.js';
import { dashboard } from '../services/dueno.js';
import * as Analitica from '../services/analitica.js';
import { reporte } from '../services/reservas.js';
import { generarReporteReservas } from '../services/reportePdf.js';

const router = Router();

router.get('/dashboard', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await dashboard(req.usuario.id));
}));

// Analitica: el dueno ve solo sus datos; el admin ve todo (duenoId = null).
router.get('/analitica/demanda', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  const scope = req.usuario.rol === 'admin' ? null : req.usuario.id;
  res.json(await Analitica.demanda(scope));
}));

router.get('/analitica/proyeccion', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  const scope = req.usuario.rol === 'admin' ? null : req.usuario.id;
  res.json(await Analitica.proyeccion(scope));
}));

// Reporte descargable en PDF: reservas del dueno (o de todos si es admin)
// dentro de un rango de fechas, con totales de ingresos confirmados.
router.get('/reporte.pdf', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  const { desde, hasta } = req.query;
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) {
    throw new ErrorApp('Indica un rango de fechas valido (desde y hasta)');
  }
  const scope = req.usuario.rol === 'admin' ? null : req.usuario.id;
  const filas = await reporte(scope, desde, hasta);
  generarReporteReservas(res, filas, { desde, hasta, usuario: req.usuario });
}));

export default router;