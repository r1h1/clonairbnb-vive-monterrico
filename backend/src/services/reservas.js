import { query, queryUna } from '../db.js';
import { config } from '../config.js';
import { ErrorApp, esFecha, calcularTotal } from './util.js';
import { obtenerCrudo, estaDisponible, verificarDueno } from './chalets.js';

const urlComprobante = (n) => (n ? `${config.urlBase}/uploads/comprobantes/${n}` : null);

// Arma la respuesta de una reserva. Los datos sensibles del chalet solo se
// adjuntan cuando la reserva esta aceptada.
async function componer(r) {
  const chalet = await obtenerCrudo(r.chalet_id);
  const cliente = await queryUna('SELECT nombre, telefono, email FROM usuarios WHERE id = $1', [r.cliente_id]);
  const aceptada = r.estado === 'aceptada';
  return {
    id: r.id,
    chalet_id: r.chalet_id,
    chalet_nombre: chalet?.nombre,
    playa: chalet?.playa,
    cliente_id: r.cliente_id,
    cliente_nombre: cliente?.nombre,
    cliente_telefono: cliente?.telefono,
    fecha_entrada: r.fecha_entrada,
    fecha_salida: r.fecha_salida,
    huespedes: r.huespedes,
    monto_total: Number(r.monto_total),
    estado: r.estado,
    motivo_rechazo: r.motivo_rechazo,
    comprobante: urlComprobante(r.comprobante),
    creado: r.creado,
    // Datos que solo se liberan al aceptar la reserva.
    direccion_completa: aceptada ? chalet?.direccion_completa : null,
    instrucciones_checkin: aceptada ? chalet?.instrucciones_checkin : null,
  };
}

export async function obtenerCrudoReserva(id) {
  return queryUna('SELECT * FROM reservas WHERE id = $1', [id]);
}

// Crea una reserva en estado pendiente. El precio lo calcula el servidor,
// nunca se confia en un total enviado por el cliente.
export async function crear(clienteId, { chalet_id, fecha_entrada, fecha_salida, huespedes }) {
  const chalet = await obtenerCrudo(chalet_id);
  if (!chalet || !chalet.activo) throw new ErrorApp('Chalet no disponible', 404);
  if (!esFecha(fecha_entrada) || !esFecha(fecha_salida) || fecha_entrada >= fecha_salida) {
    throw new ErrorApp('Fechas invalidas: la salida debe ser posterior a la entrada');
  }
  const hoy = new Date().toISOString().slice(0, 10);
  if (fecha_entrada < hoy) throw new ErrorApp('No se puede reservar en fechas pasadas');
  if (!(huespedes > 0)) throw new ErrorApp('Indica el numero de huespedes');
  if (huespedes > chalet.capacidad) {
    throw new ErrorApp(`El chalet admite maximo ${chalet.capacidad} huespedes`);
  }
  if (!(await estaDisponible(chalet_id, fecha_entrada, fecha_salida))) {
    throw new ErrorApp('Esas fechas ya no estan disponibles');
  }
  const reglas = (await query('SELECT * FROM reglas_precio WHERE chalet_id = $1', [chalet_id]))
    .map((r) => ({ ...r, porcentaje: Number(r.porcentaje) }));
  const { total } = calcularTotal(Number(chalet.precio_noche), reglas, fecha_entrada, fecha_salida);
  const nueva = await queryUna(
    `INSERT INTO reservas (chalet_id, cliente_id, fecha_entrada, fecha_salida, huespedes, monto_total)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [chalet_id, clienteId, fecha_entrada, fecha_salida, huespedes, total]
  );
  return componer(await obtenerCrudoReserva(nueva.id));
}

// Adjunta el comprobante de pago. Solo el dueno de la reserva puede subirlo.
export async function subirComprobante(id, clienteId, archivo) {
  const r = await obtenerCrudoReserva(id);
  if (!r) throw new ErrorApp('Reserva no encontrada', 404);
  if (r.cliente_id !== clienteId) throw new ErrorApp('Esta reserva no es tuya', 403);
  if (r.estado !== 'pendiente') throw new ErrorApp('Solo se adjunta comprobante en reservas pendientes');
  await query('UPDATE reservas SET comprobante = $1 WHERE id = $2', [archivo.filename, id]);
  return componer(await obtenerCrudoReserva(id));
}

export async function listarDeCliente(clienteId) {
  const filas = await query('SELECT * FROM reservas WHERE cliente_id = $1 ORDER BY creado DESC', [clienteId]);
  return Promise.all(filas.map(componer));
}

// Reservas de todos los chalets de un dueno (aislamiento por propietario).
export async function listarDeDueno(duenoId) {
  const filas = await query(
    `SELECT r.* FROM reservas r
     JOIN chalets c ON c.id = r.chalet_id
     WHERE c.dueno_id = $1 ORDER BY r.creado DESC`,
    [duenoId]
  );
  return Promise.all(filas.map(componer));
}

export async function listarTodas() {
  const filas = await query('SELECT * FROM reservas ORDER BY creado DESC');
  return Promise.all(filas.map(componer));
}

// Devuelve una reserva si el usuario tiene derecho a verla.
export async function verUna(id, usuario) {
  const r = await obtenerCrudoReserva(id);
  if (!r) throw new ErrorApp('Reserva no encontrada', 404);
  const chalet = await obtenerCrudo(r.chalet_id);
  const esCliente = r.cliente_id === usuario.id;
  const esDueno = chalet && chalet.dueno_id === usuario.id;
  if (usuario.rol !== 'admin' && !esCliente && !esDueno) {
    throw new ErrorApp('No tienes acceso a esta reserva', 403);
  }
  return componer(r);
}

// El dueno del chalet (o admin) acepta o declina. Al declinar se exige motivo.
export async function decidir(id, usuario, aceptar, motivo) {
  const r = await obtenerCrudoReserva(id);
  if (!r) throw new ErrorApp('Reserva no encontrada', 404);
  await verificarDueno(r.chalet_id, usuario);
  if (r.estado !== 'pendiente') throw new ErrorApp('La reserva ya fue resuelta');
  if (aceptar) {
    await query(`UPDATE reservas SET estado = 'aceptada', motivo_rechazo = NULL WHERE id = $1`, [id]);
  } else {
    if (!motivo || !motivo.trim()) throw new ErrorApp('Indica el motivo del rechazo');
    await query(`UPDATE reservas SET estado = 'declinada', motivo_rechazo = $1 WHERE id = $2`, [motivo.trim(), id]);
  }
  return componer(await obtenerCrudoReserva(id));
}

// El cliente cancela su propia reserva (libera las fechas).
export async function cancelar(id, usuario) {
  const r = await obtenerCrudoReserva(id);
  if (!r) throw new ErrorApp('Reserva no encontrada', 404);
  if (r.cliente_id !== usuario.id && usuario.rol !== 'admin') {
    throw new ErrorApp('Esta reserva no es tuya', 403);
  }
  if (['declinada', 'cancelada'].includes(r.estado)) throw new ErrorApp('La reserva ya no esta activa');
  await query(`UPDATE reservas SET estado = 'cancelada' WHERE id = $1`, [id]);
  return componer(await obtenerCrudoReserva(id));
}

// Filas planas (con joins) para el reporte descargable en PDF. duenoId=null
// trae todas las reservas de todos los duenos (uso exclusivo del admin).
export async function reporte(duenoId, desde, hasta) {
  let sql = `SELECT r.fecha_entrada, r.fecha_salida, r.huespedes, r.monto_total, r.estado, r.creado,
                    c.nombre AS chalet_nombre, c.playa,
                    u.nombre AS cliente_nombre, u.telefono AS cliente_telefono
             FROM reservas r
             JOIN chalets c ON c.id = r.chalet_id
             JOIN usuarios u ON u.id = r.cliente_id
             WHERE r.fecha_entrada >= $1 AND r.fecha_entrada <= $2`;
  const params = [desde, hasta];
  if (duenoId) {
    params.push(duenoId);
    sql += ` AND c.dueno_id = $${params.length}`;
  }
  sql += ' ORDER BY r.fecha_entrada ASC';
  const filas = await query(sql, params);
  return filas.map((r) => ({ ...r, monto_total: Number(r.monto_total) }));
}