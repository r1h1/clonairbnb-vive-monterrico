import bcrypt from 'bcryptjs';
import { query, queryUna } from '../db.js';
import { config } from '../config.js';
import { ErrorApp } from './util.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registro publico: solo se permite crear cuentas cliente o dueno.
// El rol admin se crea unicamente por seed para evitar escalada de privilegios.
export async function registrar({ nombre, email, password, telefono, rol }) {
  if (!nombre || !email || !password || !telefono) {
    throw new ErrorApp('Nombre, email, telefono y contrasena son obligatorios');
  }
  if (!RE_EMAIL.test(email)) throw new ErrorApp('El email no tiene un formato valido');
  if (password.length < 6) throw new ErrorApp('La contrasena debe tener al menos 6 caracteres');
  if (!['cliente', 'dueno'].includes(rol)) throw new ErrorApp('Rol invalido');

  const existe = await queryUna('SELECT 1 FROM usuarios WHERE email = $1', [email]);
  // Mensaje generico para no revelar si el email ya esta registrado.
  if (existe) throw new ErrorApp('No se pudo completar el registro con esos datos');

  const hash = bcrypt.hashSync(password, config.rondasBcrypt);
  return queryUna(
    `INSERT INTO usuarios (nombre, email, password, telefono, rol) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, nombre, email, telefono, rol`,
    [nombre, email, hash, telefono, rol]
  );
}

export async function autenticar({ email, password }) {
  const u = await queryUna('SELECT * FROM usuarios WHERE email = $1', [email || '']);
  // Mismo mensaje para email inexistente o contrasena mala.
  if (!u || !bcrypt.compareSync(password || '', u.password)) {
    throw new ErrorApp('Credenciales incorrectas', 401);
  }
  return { id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono, rol: u.rol };
}

export async function porId(id) {
  return queryUna('SELECT id, nombre, email, telefono, rol FROM usuarios WHERE id = $1', [id]);
}

// --- Administracion ---
export async function listarUsuarios() {
  return query('SELECT id, nombre, email, telefono, rol, creado FROM usuarios ORDER BY creado DESC');
}

export async function eliminarUsuario(id, admin) {
  const u = await queryUna('SELECT * FROM usuarios WHERE id = $1', [id]);
  if (!u) throw new ErrorApp('Usuario no encontrado', 404);
  if (u.id === admin.id) throw new ErrorApp('No puedes eliminar tu propia cuenta de administrador');
  if (u.rol === 'admin') throw new ErrorApp('No se permite eliminar cuentas administrador');
  // ON DELETE CASCADE limpia chalets y reservas asociados.
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
}