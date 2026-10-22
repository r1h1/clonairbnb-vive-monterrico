import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Genera el token con lo minimo necesario: id y rol del usuario.
export function firmarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
    config.jwtSecret,
    { expiresIn: config.jwtExpiraSeg }
  );
}

// Exige un token valido. Deja el usuario decodificado en req.usuario.
export function requiereAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token de acceso' });
  try {
    req.usuario = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

// Restringe el acceso a ciertos roles. Uso: requiereRol('dueno','admin').
export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta accion' });
    }
    next();
  };
}
