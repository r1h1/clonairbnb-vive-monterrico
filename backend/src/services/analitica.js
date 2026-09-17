import { query, queryUna } from '../db.js';
import { nochesEntre } from './util.js';

// Feriados nacionales de Guatemala con fecha fija (mes-dia). La Semana Santa
// es movil cada anio, por eso no se detecta automaticamente; se deja anotado.
const FERIADOS = {
  '01-01': 'Ano Nuevo',
  '05-01': 'Dia del Trabajo',
  '06-30': 'Dia del Ejercito',
  '09-15': 'Independencia',
  '10-20': 'Revolucion de 1944',
  '11-01': 'Dia de Todos los Santos',
  '12-24': 'Nochebuena',
  '12-25': 'Navidad',
  '12-31': 'Fin de Ano',
};
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

// Reservas que cuentan como demanda real (no canceladas ni declinadas),
// filtradas por dueno cuando corresponde.
async function reservasDemanda(duenoId) {
  let sql = `SELECT r.fecha_entrada, r.fecha_salida, r.estado, r.monto_total, c.nombre AS chalet_nombre
             FROM reservas r
             JOIN chalets c ON c.id = r.chalet_id
             WHERE r.estado IN ('pendiente','aceptada')`;
  const params = [];
  if (duenoId) {
    params.push(duenoId);
    sql += ` AND c.dueno_id = $${params.length}`;
  }
  const filas = await query(sql, params);
  return filas.map((r) => ({ ...r, monto_total: Number(r.monto_total) }));
}

export async function demanda(duenoId = null) {
  const reservas = await reservasDemanda(duenoId);

  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: MESES[i], reservas: 0, noches: 0, ingresos: 0 }));
  const porDia = Array.from({ length: 7 }, (_, i) => ({ dia: DIAS[i], noches: 0 }));
  const porChalet = {};
  const festivas = {};

  for (const r of reservas) {
    const noches = nochesEntre(r.fecha_entrada, r.fecha_salida);
    for (const n of noches) {
      const d = new Date(n + 'T00:00:00');
      porMes[d.getMonth()].noches += 1;
      porDia[d.getDay()].noches += 1;
      const md = n.slice(5);
      if (FERIADOS[md]) festivas[FERIADOS[md]] = (festivas[FERIADOS[md]] || 0) + 1;
    }
    const mesEntrada = new Date(r.fecha_entrada + 'T00:00:00').getMonth();
    porMes[mesEntrada].reservas += 1;
    if (r.estado === 'aceptada') porMes[mesEntrada].ingresos += r.monto_total;
    porChalet[r.chalet_nombre] = (porChalet[r.chalet_nombre] || 0) + 1;
  }

  const chaletsTop = Object.entries(porChalet)
    .map(([nombre, reservas]) => ({ nombre, reservas }))
    .sort((a, b) => b.reservas - a.reservas);

  const festivos = Object.entries(festivas)
    .map(([nombre, noches]) => ({ nombre, noches }))
    .sort((a, b) => b.noches - a.noches);

  return {
    total_reservas: reservas.length,
    por_mes: porMes,
    por_dia_semana: porDia,
    chalets_top: chaletsTop,
    festivos,
    nota_semana_santa: 'La Semana Santa es movil y no se incluye en el conteo automatico de feriados.',
  };
}

// Metricas de negocio adicionales para el dueno: ocupacion, ingresos,
// ticket promedio, clientes recurrentes y tasa de aceptacion.
export async function metricas(duenoId = null) {
  const paramsChalets = [];
  let sqlChalets = 'SELECT COUNT(*)::int c FROM chalets WHERE activo = true';
  if (duenoId) {
    paramsChalets.push(duenoId);
    sqlChalets += ` AND dueno_id = $${paramsChalets.length}`;
  }
  const { c: chaletsActivos } = await queryUna(sqlChalets, paramsChalets);

  const paramsReservas = [];
  let sqlReservas = `SELECT r.fecha_entrada, r.fecha_salida, r.estado, r.cliente_id, r.monto_total
             FROM reservas r JOIN chalets c ON c.id = r.chalet_id
             WHERE r.estado IN ('aceptada','declinada')`;
  if (duenoId) {
    paramsReservas.push(duenoId);
    sqlReservas += ` AND c.dueno_id = $${paramsReservas.length}`;
  }
  const reservas = (await query(sqlReservas, paramsReservas)).map((r) => ({ ...r, monto_total: Number(r.monto_total) }));

  const aceptadas = reservas.filter((r) => r.estado === 'aceptada');
  const declinadas = reservas.filter((r) => r.estado === 'declinada');

  let nochesReservadas = 0;
  let fechaMinima = null;
  let fechaMaxima = null;
  for (const r of aceptadas) {
    nochesReservadas += nochesEntre(r.fecha_entrada, r.fecha_salida).length;
    if (!fechaMinima || r.fecha_entrada < fechaMinima) fechaMinima = r.fecha_entrada;
    if (!fechaMaxima || r.fecha_salida > fechaMaxima) fechaMaxima = r.fecha_salida;
  }
  let ocupacionPct = 0;
  if (chaletsActivos > 0 && fechaMinima && fechaMaxima) {
    const diasRango = Math.max(1, Math.round((new Date(fechaMaxima) - new Date(fechaMinima)) / 86400000));
    ocupacionPct = Math.min(100, Math.round((nochesReservadas / (chaletsActivos * diasRango)) * 1000) / 10);
  }

  const ingresoConfirmado = aceptadas.reduce((s, r) => s + r.monto_total, 0);
  const ticketPromedio = aceptadas.length ? Math.round((ingresoConfirmado / aceptadas.length) * 100) / 100 : 0;

  const porCliente = {};
  for (const r of aceptadas) porCliente[r.cliente_id] = (porCliente[r.cliente_id] || 0) + 1;
  const clientesRecurrentes = Object.values(porCliente).filter((n) => n > 1).length;

  const resueltas = aceptadas.length + declinadas.length;
  const tasaAceptacion = resueltas ? Math.round((aceptadas.length / resueltas) * 1000) / 10 : 0;

  return {
    chalets_activos: chaletsActivos,
    ocupacion_pct: ocupacionPct,
    ingreso_confirmado: Math.round(ingresoConfirmado * 100) / 100,
    ticket_promedio: ticketPromedio,
    clientes_recurrentes: clientesRecurrentes,
    tasa_aceptacion_pct: tasaAceptacion,
  };
}

// Proyeccion simple: promedio historico de noches por mes ajustado por el
// mes con mayor ocupacion. No es un modelo de ML; es una heuristica adecuada
// para un prototipo con pocos datos.
export async function proyeccion(duenoId = null) {
  const d = await demanda(duenoId);
  const meses = d.por_mes;
  const totalNoches = meses.reduce((s, m) => s + m.noches, 0);
  const promedio = totalNoches / 12;
  const proy = meses.map((m) => {
    // Factor de estacionalidad respecto al promedio (1 = mes promedio).
    const factor = promedio > 0 ? m.noches / promedio : 1;
    // Estimado siguiente periodo: mismo mes historico con leve suavizado.
    const estimado = Math.round((m.noches * 0.7 + promedio * 0.3) * 10) / 10;
    return { mes: m.mes, historico: m.noches, factor: Math.round(factor * 100) / 100, estimado };
  });
  const mesPico = [...meses].sort((a, b) => b.noches - a.noches)[0];
  return {
    metodo: 'Promedio historico con suavizado y factor de estacionalidad',
    promedio_noches_mes: Math.round(promedio * 10) / 10,
    mes_pico: mesPico?.noches > 0 ? mesPico.mes : null,
    proyeccion: proy,
  };
}