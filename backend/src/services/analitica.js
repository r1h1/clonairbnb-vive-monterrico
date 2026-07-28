import { query } from '../db.js';
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