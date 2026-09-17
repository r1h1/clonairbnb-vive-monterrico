import { Router } from 'express';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { asyncH, esFecha, ErrorApp } from '../services/util.js';
import { dashboard, calendario, proximosCheckins } from '../services/dueno.js';
import * as Analitica from '../services/analitica.js';
import { reporte } from '../services/reservas.js';
import { generarReporteReservas } from '../services/reportePdf.js';

const router = Router();

router.get('/dashboard', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  res.json(await dashboard(req.usuario.id));
}));

// Calendario del dueno: reservas vivas en un rango de fechas, con sus
// empleados asignados.
router.get('/calendario', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  const { desde, hasta } = req.query;
  res.json(await calendario(req.usuario.id, desde, hasta));
}));

// Check-ins de los proximos N dias (por defecto 7), para avisar al dueno
// cuales todavia no tienen personal notificado.
router.get('/proximos-checkins', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  const dias = req.query.dias ? Number(req.query.dias) : 7;
  res.json(await proximosCheckins(req.usuario.id, dias));
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

router.get('/analitica/metricas', requiereAuth, requiereRol('dueno', 'admin'), asyncH(async (req, res) => {
  const scope = req.usuario.rol === 'admin' ? null : req.usuario.id;
  res.json(await Analitica.metricas(scope));
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