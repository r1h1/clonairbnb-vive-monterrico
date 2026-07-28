import { query, queryUna } from '../db.js';
import { ErrorApp } from './util.js';
import { verificarDueno } from './chalets.js';

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