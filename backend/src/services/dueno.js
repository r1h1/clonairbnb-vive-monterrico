import { query, queryUna } from '../db.js';
import { ErrorApp, esFecha } from './util.js';
import { verificarDueno } from './chalets.js';

// Sub-select reutilizado: empleados asignados a una reserva, con su estado
// de notificacion, como arreglo JSON (vacio si no hay ninguno asignado).
const SUBSELECT_EMPLEADOS = `
  COALESCE(
    (SELECT json_agg(json_build_object(
       'empleado_id', e.id, 'nombre', e.nombre, 'telefono', e.telefono,
       'tipo', e.tipo, 'notificado', re.notificado
     ) ORDER BY e.nombre)
     FROM reserva_empleados re JOIN empleados e ON e.id = re.empleado_id
     WHERE re.reserva_id = r.id),
    '[]'::json
  ) AS empleados
`;

// Resumen para la pantalla principal del dueno.
export async function dashboard(duenoId) {
  const { c: total } = await queryUna('SELECT COUNT(*)::int c FROM chalets WHERE dueno_id = $1', [duenoId]);

  // Chalets con al menos una reserva viva (pendiente o aceptada).
  const { c: conReserva } = await queryUna(
    `SELECT COUNT(DISTINCT c.id)::int c FROM chalets c
     JOIN reservas r ON r.chalet_id = c.id
     WHERE c.dueno_id = $1 AND r.estado IN ('pendiente','aceptada')`,
    [duenoId]
  );

  const { c: pendientes } = await queryUna(
    `SELECT COUNT(*)::int c FROM reservas r JOIN chalets c ON c.id = r.chalet_id
     WHERE c.dueno_id = $1 AND r.estado = 'pendiente'`,
    [duenoId]
  );

  // Tabla: quien reservo, telefono y chalet (accesos rapidos para el dueno).
  const reservantes = (await query(
    `SELECT r.id, u.nombre AS cliente, u.telefono, c.nombre AS chalet,
            r.fecha_entrada, r.fecha_salida, r.estado, r.monto_total
     FROM reservas r
     JOIN chalets c ON c.id = r.chalet_id
     JOIN usuarios u ON u.id = r.cliente_id
     WHERE c.dueno_id = $1 AND r.estado IN ('pendiente','aceptada')
     ORDER BY r.creado DESC`,
    [duenoId]
  )).map((r) => ({ ...r, monto_total: Number(r.monto_total) }));

  return {
    chalets_creados: total,
    chalets_reservados: conReserva,
    chalets_disponibles: total - conReserva,
    reservas_pendientes: pendientes,
    reservantes,
  };
}

// Reservas vivas (pendiente/aceptada) de todos los chalets del dueno que
// caen dentro de un rango de fechas, con sus empleados asignados. Alimenta
// la vista de calendario del panel del dueno.
export async function calendario(duenoId, desde, hasta) {
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) {
    throw new ErrorApp('Indica un rango de fechas valido (desde y hasta)');
  }
  return query(
    `SELECT r.id, r.fecha_entrada, r.fecha_salida, r.estado, r.huespedes,
            c.id AS chalet_id, c.nombre AS chalet_nombre,
            u.nombre AS cliente_nombre, u.telefono AS cliente_telefono,
            ${SUBSELECT_EMPLEADOS}
     FROM reservas r
     JOIN chalets c ON c.id = r.chalet_id
     JOIN usuarios u ON u.id = r.cliente_id
     WHERE c.dueno_id = $1 AND r.estado IN ('pendiente','aceptada')
       AND r.fecha_entrada <= $3 AND r.fecha_salida >= $2
     ORDER BY r.fecha_entrada`,
    [duenoId, desde, hasta]
  );
}

// Reservas aceptadas cuyo check-in cae dentro de los proximos `dias`.
// `pendiente_notificar` marca las que todavia no tienen todo su personal
// asignado avisado por WhatsApp (o que ni siquiera tienen personal
// asignado) — es la base del aviso visual en el panel del dueno.
export async function proximosCheckins(duenoId, dias = 7) {
  const hoy = new Date().toISOString().slice(0, 10);
  const limiteDate = new Date();
  limiteDate.setDate(limiteDate.getDate() + Number(dias));
  const limite = limiteDate.toISOString().slice(0, 10);

  const filas = await query(
    `SELECT r.id, r.fecha_entrada, r.fecha_salida, r.huespedes,
            c.id AS chalet_id, c.nombre AS chalet_nombre,
            u.nombre AS cliente_nombre, u.telefono AS cliente_telefono,
            ${SUBSELECT_EMPLEADOS}
     FROM reservas r
     JOIN chalets c ON c.id = r.chalet_id
     JOIN usuarios u ON u.id = r.cliente_id
     WHERE c.dueno_id = $1 AND r.estado = 'aceptada'
       AND r.fecha_entrada >= $2 AND r.fecha_entrada <= $3
     ORDER BY r.fecha_entrada`,
    [duenoId, hoy, limite]
  );
  return filas.map((f) => ({
    ...f,
    pendiente_notificar: f.empleados.length === 0 || f.empleados.some((e) => !e.notificado),
  }));
}

export async function listarComentarios(chaletId) {
  return query(
    'SELECT id, mensaje, creado FROM comentarios_dueno WHERE chalet_id = $1 ORDER BY creado DESC',
    [chaletId]
  );
}

export async function crearComentario(chaletId, usuario, mensaje) {
  await verificarDueno(chaletId, usuario);
  if (!mensaje || !mensaje.trim()) throw new ErrorApp('El aviso no puede estar vacio');
  return queryUna(
    'INSERT INTO comentarios_dueno (chalet_id, mensaje) VALUES ($1, $2) RETURNING id, mensaje, creado',
    [chaletId, mensaje.trim()]
  );
}

export async function eliminarComentario(comentarioId, usuario) {
  const com = await queryUna('SELECT * FROM comentarios_dueno WHERE id = $1', [comentarioId]);
  if (!com) throw new ErrorApp('Aviso no encontrado', 404);
  await verificarDueno(com.chalet_id, usuario);
  await query('DELETE FROM comentarios_dueno WHERE id = $1', [comentarioId]);
}