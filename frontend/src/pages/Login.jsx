import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const PANEL_POR_ROL = { cliente: '/cliente', dueno: '/dueno', admin: '/admin' };

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const { guardar } = useAuth();
  const navigate = useNavigate();

  async function entrar() {
    try {
      const { usuario, token } = await API.post('/auth/login', { email, password });
      guardar(usuario, token);
      navigate(PANEL_POR_ROL[usuario.rol] || '/');
    } catch (e) {
      setMsg(e.message);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') entrar();
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="text-center mb-4">
            <h2 className="fw-bold mb-2">Bienvenido a ViveMonterrico</h2>
            <p className="text-muted mb-0">Inicia sesion para administrar tus reservas y disfrutar de nuestros chalets.</p>
          </div>

          <div className="card border-0 shadow rounded-4">
            <div className="card-body p-4">
              <h4 className="fw-bold mb-4">Iniciar sesion</h4>
              {msg && <div className="alert alert-danger py-2">{msg}</div>}

              <div className="mb-3">
                <label className="form-label">Correo electronico</label>
                <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="mb-4">
                <label className="form-label">Contrasena</label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>

              <button className="btn btn-acb w-100 py-2" onClick={entrar}>Iniciar sesion</button>

              <hr />

              <div className="text-center">
                <small className="text-muted">¿Aun no tienes una cuenta?</small>
                <br />
                <Link to="/registro" className="text-decoration-none fw-semibold">Crear una cuenta</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
