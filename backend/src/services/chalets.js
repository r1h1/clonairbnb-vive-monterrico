import { query, queryUna } from '../db.js';
import { config } from '../config.js';
import { ErrorApp, esFecha, seSolapan, nochesEntre } from './util.js';

const urlFoto = (nombre) => `${config.urlBase}/uploads/chalets/${nombre}`;

// Adjunta fotos, reglas y avisos a un chalet. incluirSensible controla si se
// devuelven direccion e instrucciones de check-in.
async function componer(chalet, incluirSensible) {
  if (!chalet) return null;
  const fotos = (await query('SELECT url FROM chalet_fotos WHERE chalet_id = $1 ORDER BY id', [chalet.id]))
    .map((f) => urlFoto(f.url));
  const reglas = (await query(
    'SELECT id, fecha_inicio, fecha_fin, porcentaje FROM reglas_precio WHERE chalet_id = $1 ORDER BY fecha_inicio',
    [chalet.id]
  )).map((r) => ({ ...r, porcentaje: Number(r.porcentaje) }));

  const salida = {
    id: chalet.id,
    dueno_id: chalet.dueno_id,
    nombre: chalet.nombre,
    playa: chalet.playa,
    descripcion: chalet.descripcion,
    precio_noche: Number(chalet.precio_noche),
    capacidad: chalet.capacidad,
    activo: !!chalet.activo,
    fotos,
    reglas_precio: reglas,
  };
  if (incluirSensible) {
    salida.direccion_completa = chalet.direccion_completa;
    salida.instrucciones_checkin = chalet.instrucciones_checkin;
  }
  return salida;
}

export async function obtenerCrudo(id) {
  return queryUna('SELECT * FROM chalets WHERE id = $1', [id]);
}

// Verifica que el chalet exista y que el usuario sea su dueno (o admin).
export async function verificarDueno(id, usuario) {
  const chalet = await obtenerCrudo(id);
  if (!chalet) throw new ErrorApp('Chalet no encontrado', 404);
  if (usuario.rol !== 'admin' && chalet.dueno_id !== usuario.id) {
    throw new ErrorApp('Este chalet no te pertenece', 403);
  }
  return chalet;
}

// Fechas (noches) ya ocupadas por reservas pendientes o aceptadas.
export async function nochesOcupadas(chaletId) {
  const reservas = await query(
    `SELECT fecha_entrada, fecha_salida FROM reservas
     WHERE chalet_id = $1 AND estado IN ('pendiente','aceptada')`,
    [chaletId]
  );
  const set = new Set();
  for (const r of reservas) {
    for (const n of nochesEntre(r.fecha_entrada, r.fecha_salida)) set.add(n);
  }
  return [...set].sort();
}

// Un chalet esta disponible en un rango si ninguna reserva viva se solapa.
export async function estaDisponible(chaletId, entrada, salida) {
  const reservas = await query(
    `SELECT fecha_entrada, fecha_salida FROM reservas
     WHERE chalet_id = $1 AND estado IN ('pendiente','aceptada')`,
    [chaletId]
  );
  return !reservas.some((r) => seSolapan(entrada, salida, r.fecha_entrada, r.fecha_salida));
}

// Listado publico. Oculta datos sensibles. Si vienen fechas, filtra por
// disponibilidad; si viene playa o huespedes, tambien filtra.
export async function listarPublico({ playa, huespedes, entrada, salida } = {}) {
  let sql = 'SELECT * FROM chalets WHERE activo = true';
  const params = [];
  if (playa) {
    params.push(playa);
    sql += ` AND playa = $${params.length}`;
  }
  if (huespedes) {
    params.push(Number(huespedes));
    sql += ` AND capacidad >= $${params.length}`;
  }
  let filas = await query(sql + ' ORDER BY id', params);

  if (entrada && salida) {
    if (!esFecha(entrada) || !esFecha(salida) || entrada >= salida) {
      throw new ErrorApp('Rango de fechas invalido');
    }
    const disponibles = [];
    for (const c of filas) {
      if (await estaDisponible(c.id, entrada, salida)) disponibles.push(c);
    }
    filas = disponibles;
  }
  return Promise.all(filas.map((c) => componer(c, false)));
}

export async function listarPorDueno(duenoId) {
  const filas = await query('SELECT * FROM chalets WHERE dueno_id = $1 ORDER BY id', [duenoId]);
  return Promise.all(filas.map((c) => componer(c, true)));
}

// Detalle publico. Revela datos sensibles solo si el solicitante tiene una
// reserva aceptada en ese chalet (o es dueno/admin).
export async function detalle(id, usuario) {
  const chalet = await obtenerCrudo(id);
  if (!chalet) throw new ErrorApp('Chalet no encontrado', 404);
  let sensible = false;
  if (usuario) {
    if (usuario.rol === 'admin' || chalet.dueno_id === usuario.id) {
      sensible = true;
    } else {
      const aceptada = await queryUna(
        `SELECT 1 FROM reservas WHERE chalet_id = $1 AND cliente_id = $2 AND estado = 'aceptada' LIMIT 1`,
        [id, usuario.id]
      );
      sensible = !!aceptada;
    }
  }
  const compuesto = await componer(chalet, sensible);
  return { ...compuesto, noches_ocupadas: await nochesOcupadas(id) };
}

export async function crear(duenoId, datos) {
  const { nombre, playa, descripcion, precio_noche, capacidad, direccion_completa, instrucciones_checkin } = datos;
  if (!nombre || !playa) throw new ErrorApp('Nombre y playa son obligatorios');
  if (!(precio_noche > 0)) throw new ErrorApp('El precio por noche debe ser mayor a 0');
  if (!(capacidad > 0)) throw new ErrorApp('La capacidad debe ser mayor a 0');
  const nuevo = await queryUna(
    `INSERT INTO chalets (dueno_id, nombre, playa, descripcion, precio_noche, capacidad, direccion_completa, instrucciones_checkin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [duenoId, nombre, playa, descripcion || '', precio_noche, capacidad, direccion_completa || '', instrucciones_checkin || '']
  );
  return detalle(nuevo.id, { id: duenoId, rol: 'dueno' });
}

export async function actualizar(id, usuario, datos) {
  await verificarDueno(id, usuario);
  const campos = ['nombre', 'playa', 'descripcion', 'precio_noche', 'capacidad', 'direccion_completa', 'instrucciones_checkin', 'activo'];
  const sets = [];
  const params = [];
  for (const c of campos) {
    if (datos[c] !== undefined) {
      params.push(c === 'activo' ? !!datos[c] : datos[c]);
      sets.push(`${c} = $${params.length}`);
    }
  }
  if (!sets.length) throw new ErrorApp('No hay campos para actualizar');
  params.push(id);
  await query(`UPDATE chalets SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return detalle(id, usuario);
}

export async function eliminar(id, usuario) {
  await verificarDueno(id, usuario);
  await query('DELETE FROM chalets WHERE id = $1', [id]);
}

export async function agregarFotos(id, usuario, archivos) {
  await verificarDueno(id, usuario);
  const { c: actuales } = await queryUna('SELECT COUNT(*)::int c FROM chalet_fotos WHERE chalet_id = $1', [id]);
  if (actuales + archivos.length > config.maxFotosChalet) {
    throw new ErrorApp(`Maximo ${config.maxFotosChalet} fotos por chalet (ya tienes ${actuales})`);
  }
  for (const a of archivos) {
    await query('INSERT INTO chalet_fotos (chalet_id, url) VALUES ($1, $2)', [id, a.filename]);
  }
  return detalle(id, usuario);
}

export async function agregarRegla(id, usuario, { fecha_inicio, fecha_fin, porcentaje }) {
  await verificarDueno(id, usuario);
  if (!esFecha(fecha_inicio) || !esFecha(fecha_fin) || fecha_inicio > fecha_fin) {
    throw new ErrorApp('Rango de fechas de la regla invalido');
  }
  if (!(porcentaje > 0)) throw new ErrorApp('El porcentaje debe ser mayor a 0');
  await query(
    'INSERT INTO reglas_precio (chalet_id, fecha_inicio, fecha_fin, porcentaje) VALUES ($1,$2,$3,$4)',
    [id, fecha_inicio, fecha_fin, porcentaje]
  );
  return detalle(id, usuario);
}

export async function eliminarRegla(reglaId, usuario) {
  const regla = await queryUna('SELECT * FROM reglas_precio WHERE id = $1', [reglaId]);
  if (!regla) throw new ErrorApp('Regla no encontrada', 404);
  await verificarDueno(regla.chalet_id, usuario);
  await query('DELETE FROM reglas_precio WHERE id = $1', [reglaId]);
}