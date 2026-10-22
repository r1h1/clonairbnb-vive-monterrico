import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Registro() {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '', rol: 'cliente' });
  const [msg, setMsg] = useState(null);
  const { guardar } = useAuth();
  const navigate = useNavigate();

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  }

  async function registrar() {
    try {
      const { usuario, token } = await API.post('/auth/registro', form);
      guardar(usuario, token);
      navigate(usuario.rol === 'cliente' ? '/cliente' : '/dueno');
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="container py-2 mb-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-8">
          <div className="text-center mb-4">
            <h2 className="fw-bold mb-2">Unete a ViveMonterrico</h2>
            <p className="text-muted mb-0">Crea tu cuenta para reservar chalets o administrar tus propiedades.</p>
          </div>

          <div className="card border-0 shadow rounded-4">
            <div className="card-body p-4">
              <h4 className="fw-bold mb-4">Crear cuenta</h4>
              {msg && <div className="alert alert-danger py-2">{msg}</div>}

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Nombre completo</label>
                  <input className="form-control" placeholder="Ingresa tu nombre completo" value={form.nombre} onChange={set('nombre')} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Correo electronico</label>
                  <input type="email" className="form-control" placeholder="correo@ejemplo.com" value={form.email} onChange={set('email')} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Telefono (WhatsApp)</label>
                  <input className="form-control" placeholder="XXXXXXXX" value={form.telefono} onChange={set('telefono')} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Contrasena</label>
                  <input type="password" className="form-control" value={form.password} onChange={set('password')} />
                </div>
                <div className="col-12 mb-4">
                  <label className="form-label">Tipo de cuenta</label>
                  <select className="form-select" value={form.rol} onChange={set('rol')}>
                    <option value="cliente">Cliente (Quiero reservar chalets)</option>
                    <option value="dueno">Propietario (Quiero publicar chalets)</option>
                  </select>
                </div>
                <div className="col-12">
                  <button className="btn btn-acb w-100 py-2" onClick={registrar}>Crear cuenta</button>
                </div>
              </div>

              <hr />

              <div className="text-center">
                <small className="text-muted">¿Ya tienes una cuenta?</small>
                <br />
                <Link to="/login" className="text-decoration-none fw-semibold">Iniciar sesion</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
