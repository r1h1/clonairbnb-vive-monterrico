import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api/client.js';
import { q } from '../utils/moneda.js';
import EstadoBadge from '../components/EstadoBadge.jsx';

export default function Cliente() {
  const [reservas, setReservas] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [msg, setMsg] = useState(null);
  const [archivos, setArchivos] = useState({});

  async function cargar() {
    const rs = await API.get('/reservas/mias');
    setReservas(rs);
    setCargado(true);
  }

  useEffect(() => { cargar(); }, []);

  async function subir(id) {
    const archivo = archivos[id];
    if (!archivo) return setMsg({ tipo: 'danger', texto: 'Selecciona una imagen del comprobante' });
    const fd = new FormData();
    fd.append('comprobante', archivo);
    try {
      await API.upload('/reservas/' + id + '/comprobante', fd);
      setMsg({ tipo: 'success', texto: 'Comprobante enviado' });
      cargar();
    } catch (e) {
      setMsg({ tipo: 'danger', texto: e.message });
    }
  }

  async function cancelar(id) {
    if (!confirm('Cancelar esta reserva?')) return;
    try {
      await API.put('/reservas/' + id + '/cancelar');
      cargar();
    } catch (e) {
      setMsg({ tipo: 'danger', texto: e.message });
    }
  }

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">Mis reservas</h3>
          <small className="text-muted">Administra tus reservas y el estado de cada una.</small>
        </div>
        <Link to="/" className="btn btn-acb">Buscar chalets</Link>
      </div>

      {msg && <div className={`alert alert-${msg.tipo} py-2`}>{msg.texto}</div>}

      <div className="row g-3">
        {reservas.map((r) => (
          <div className="col-md-6 col-lg-4" key={r.id}>
            <div className="card shadow-sm border-0 rounded-4 h-100">
              <div className="card-body d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h5 className="mb-1">{r.chalet_nombre}</h5>
                    <div className="small text-muted">{r.playa}</div>
                  </div>
                  <EstadoBadge estado={r.estado} />
                </div>
                <hr />
                <div className="row small">
                  <div className="col-6 mb-2"><strong>Entrada</strong><br />{r.fecha_entrada}</div>
                  <div className="col-6 mb-2"><strong>Salida</strong><br />{r.fecha_salida}</div>
                  <div className="col-6"><strong>Huespedes</strong><br />{r.huespedes}</div>
                  <div className="col-6"><strong>Total</strong><br /><span className="precio fs-5">{q(r.monto_total)}</span></div>
                </div>

                {r.estado === 'pendiente' && (
                  <>
                    <hr />
                    <label className="form-label small">Comprobante de pago</label>
                    <div className="input-group">
                      <input type="file" accept="image/*" className="form-control" onChange={(e) => setArchivos((a) => ({ ...a, [r.id]: e.target.files[0] }))} />
                      <button className="btn btn-outline-acb" onClick={() => subir(r.id)}>Enviar</button>
                    </div>
                    <small className="text-muted d-block mt-2">
                      {r.comprobante ? 'Comprobante enviado. Esperando confirmacion del propietario.' : 'Sube el comprobante para continuar con la reserva.'}
                    </small>
                    <button className="btn btn-link text-danger p-0 mt-3" onClick={() => cancelar(r.id)}>Cancelar reserva</button>
                  </>
                )}

                {r.estado === 'aceptada' && (
                  <>
                    <hr />
                    <div className="alert alert-success mb-0">
                      <strong>Reserva confirmada</strong>
                      <div className="mt-2"><strong>Direccion</strong><br />{r.direccion_completa || '-'}</div>
                      <div className="mt-2"><strong>Check-in</strong><br />{r.instrucciones_checkin || '-'}</div>
                    </div>
                  </>
                )}

                {r.estado === 'declinada' && (
                  <>
                    <hr />
                    <div className="alert alert-danger mb-0">
                      <strong>Reserva rechazada</strong><br />
                      {r.motivo_rechazo || 'Sin motivo'}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {cargado && reservas.length === 0 && (
        <div className="text-center text-muted py-5">
          <h4 className="mb-3">No tienes reservas todavia</h4>
          <p>Explora nuestros chalets y encuentra el lugar ideal para tus vacaciones.</p>
          <Link to="/" className="btn btn-acb">Explorar chalets</Link>
        </div>
      )}

      <footer className="text-center text-muted small py-5">ViveMonterrico · Panel del cliente</footer>
    </div>
  );
}
