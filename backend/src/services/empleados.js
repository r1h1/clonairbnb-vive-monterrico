import { query, queryUna } from '../db.js';
import { ErrorApp } from './util.js';
import { verificarDueno } from './chalets.js';
import { obtenerCrudoReserva } from './reservas.js';

function componer(e) {
  return {
    id: e.id,
    dueno_id: e.dueno_id,
    nombre: e.nombre,
    telefono: e.telefono,
    tipo: e.tipo,
    activo: !!e.activo,
    creado: e.creado,
  };
}

// Verifica que el empleado exista y pertenezca al dueno (o admin).
async function verificarDuenoEmpleado(id, usuario) {
  const empleado = await queryUna('SELECT * FROM empleados WHERE id = $1', [id]);
  if (!empleado) throw new ErrorApp('Empleado no encontrado', 404);
  if (usuario.rol !== 'admin' && empleado.dueno_id !== usuario.id) {
    throw new ErrorApp('Este empleado no te pertenece', 403);
  }
  return empleado;
}

export async function listar(duenoId) {
  const filas = await query('SELECT * FROM empleados WHERE dueno_id = $1 ORDER BY nombre', [duenoId]);
  return filas.map(componer);
}

export async function crear(duenoId, { nombre, telefono, tipo }) {
  if (!nombre || !nombre.trim()) throw new ErrorApp('El nombre es obligatorio');
  if (!telefono || !telefono.trim()) throw new ErrorApp('El telefono es obligatorio');
  if (!tipo || !tipo.trim()) throw new ErrorApp('Indica el tipo de trabajo (piscina, limpieza, etc.)');
  const nuevo = await queryUna(
    'INSERT INTO empleados (dueno_id, nombre, telefono, tipo) VALUES ($1,$2,$3,$4) RETURNING *',
    [duenoId, nombre.trim(), telefono.trim(), tipo.trim()]
  );
  return componer(nuevo);
}

export async function actualizar(id, usuario, datos) {
  await verificarDuenoEmpleado(id, usuario);
  const campos = ['nombre', 'telefono', 'tipo', 'activo'];
  const sets = [];
  const params = [];
  for (const c of campos) {
    if (datos[c] !== undefined) {
      params.push(c === 'activo' ? !!datos[c] : String(datos[c]).trim());
      sets.push(`${c} = $${params.length}`);
    }
  }
  if (!sets.length) throw new ErrorApp('No hay campos para actualizar');
  params.push(id);
  const actualizado = await queryUna(
    `UPDATE empleados SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return componer(actualizado);
}

export async function eliminar(id, usuario) {
  await verificarDuenoEmpleado(id, usuario);
  await query('DELETE FROM empleados WHERE id = $1', [id]);
}

// Confirma que la reserva exista y que el usuario sea dueno del chalet al
// que pertenece (o admin). Devuelve la reserva cruda.
async function verificarDuenoDeReserva(reservaId, usuario) {
  const reserva = await obtenerCrudoReserva(reservaId);
  if (!reserva) throw new ErrorApp('Reserva no encontrada', 404);
  await verificarDueno(reserva.chalet_id, usuario);
  return reserva;
}

export async function listarAsignaciones(reservaId, usuario) {
  await verificarDuenoDeReserva(reservaId, usuario);
  const filas = await query(
    `SELECT re.empleado_id, re.notificado, re.notificado_en,
            e.nombre, e.telefono, e.tipo
     FROM reserva_empleados re
     JOIN empleados e ON e.id = re.empleado_id
     WHERE re.reserva_id = $1
     ORDER BY e.nombre`,
    [reservaId]
  );
  return filas;
}

export async function asignar(reservaId, usuario, empleadoIds) {
  await verificarDuenoDeReserva(reservaId, usuario);
  if (!Array.isArray(empleadoIds) || !empleadoIds.length) {
    throw new ErrorApp('Indica al menos un empleado');
  }
  for (const empleadoId of empleadoIds) {
    await verificarDuenoEmpleado(empleadoId, usuario);
    await query(
      `INSERT INTO reserva_empleados (reserva_id, empleado_id)
       VALUES ($1, $2) ON CONFLICT (reserva_id, empleado_id) DO NOTHING`,
      [reservaId, empleadoId]
    );
  }
  return listarAsignaciones(reservaId, usuario);
}

export async function desasignar(reservaId, empleadoId, usuario) {
  await verificarDuenoDeReserva(reservaId, usuario);
  await query('DELETE FROM reserva_empleados WHERE reserva_id = $1 AND empleado_id = $2', [reservaId, empleadoId]);
}

export async function marcarNotificado(reservaId, empleadoId, usuario) {
  await verificarDuenoDeReserva(reservaId, usuario);
  const fila = await queryUna(
    `UPDATE reserva_empleados SET notificado = true, notificado_en = now()
     WHERE reserva_id = $1 AND empleado_id = $2 RETURNING *`,
    [reservaId, empleadoId]
  );
  if (!fila) throw new ErrorApp('Ese empleado no esta asignado a esta reserva', 404);
  return listarAsignaciones(reservaId, usuario);
}
