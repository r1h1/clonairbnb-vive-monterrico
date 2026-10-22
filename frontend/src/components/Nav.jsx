import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const PANEL_POR_ROL = { cliente: '/cliente', dueno: '/dueno', admin: '/admin' };
const ETIQUETA_POR_ROL = { cliente: 'Mis reservas', dueno: 'Mi panel', admin: 'Administracion' };

export default function Nav() {
  const { usuario, cerrar } = useAuth();
  const navigate = useNavigate();

  function salir() {
    cerrar();
    navigate('/');
  }

  return (
    <nav className="navbar navbar-expand-lg bg-white shadow-sm mb-4">
      <div className="container">
        <Link className="navbar-brand" to="/">Vive<span>Monterrico</span></Link>
        <div className="ms-auto d-flex align-items-center flex-wrap">
          {!usuario ? (
            <>
              <Link className="btn btn-outline-acb btn-sm me-2" to="/login">Iniciar sesion</Link>
              <Link className="btn btn-acb btn-sm" to="/registro">Crear cuenta</Link>
            </>
          ) : (
            <>
              <Link className="btn btn-outline-acb btn-sm me-2" to={PANEL_POR_ROL[usuario.rol]}>
                {ETIQUETA_POR_ROL[usuario.rol]}
              </Link>
              <span className="me-3 small text-muted">{usuario.nombre} ({usuario.rol})</span>
              <button className="btn btn-acb btn-sm" onClick={salir}>Salir</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
