import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Equivalente a Sesion.exigir(...roles) en frontend-legacy/js/sesion.js:
// sin sesion -> login; con sesion pero rol no permitido -> inicio.
export default function RequireRole({ roles }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && roles.length && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return <Outlet />;
}
