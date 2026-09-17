import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { q } from '../utils/moneda.js';
import { Foto } from '../components/FotoPlaceholder.jsx';

export default function Home() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [entrada, setEntrada] = useState('');
  const [salida, setSalida] = useState('');
  const [huespedes, setHuespedes] = useState('');
  const [playa, setPlaya] = useState('');
  const [playas, setPlayas] = useState([]);
  const [chalets, setChalets] = useState([]);
  const [cargado, setCargado] = useState(false);

  const [detalle, setDetalle] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [formReserva, setFormReserva] = useState({ entrada: '', salida: '', huespedes: 2 });
  const [msgReserva, setMsgReserva] = useState(null);

  async function buscar() {
    try {
      const p = new URLSearchParams();
      if (entrada && salida) { p.set('entrada', entrada); p.set('salida', salida); }
      if (huespedes) p.set('huespedes', huespedes);
      if (playa) p.set('playa', playa);
      const datos = await API.get(`/chalets${p.toString() ? '?' + p : ''}`);
      setChalets(datos);
      setCargado(true);
      if (playas.length === 0) {
        setPlayas([...new Set(datos.map((c) => c.playa))]);
      }
    } catch (e) {
      alert(e.message);
    }
  }

  useEffect(() => { buscar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function verChalet(id) {
    const c = await API.get('/chalets/' + id);
    let cs = [];
    try { cs = await API.get('/chalets/' + id + '/comentarios'); } catch { /* sin avisos */ }
    setDetalle(c);
    setComentarios(cs);
    setFormReserva({ entrada: '', salida: '', huespedes: 2 });
    setMsgReserva(null);
  }

  function cerrarModal() {
    setDetalle(null);
  }

  async function reservar() {
    try {
      const r = await API.post('/reservas', {
        chalet_id: detalle.id,
        fecha_entrada: formReserva.entrada,
        fecha_salida: formReserva.salida,
        huespedes: Number(formReserva.huespedes),
      });
      setMsgReserva({ tipo: 'success', texto: `Reserva creada por ${q(r.monto_total)}. Continua en "Mis reservas" para subir el comprobante.` });
      setTimeout(() => navigate('/cliente'), 1500);
    } catch (e) {
      setMsgReserva({ tipo: 'danger', texto: e.message });
    }
  }

  return (
    <div className="container">
      <section className="hero mb-4">
        <div className="col-lg-7">
          <h1 className="display-5">Encuentra el chalet perfecto en <span className="brand-word">ViveMonterrico</span></h1>
          <p className="lead mb-0">Reserva chalets frente al hermoso mar. Rapido, organizado y con confirmacion del propietario.</p>
        </div>
      </section>

      <div className="card shadow border-0 rounded-4 mb-5">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small mb-1">Fecha de entrada</label>
              <input type="date" className="form-control" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">Fecha de salida</label>
              <input type="date" className="form-control" value={salida} onChange={(e) => setSalida(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Huespedes</label>
              <input type="number" className="form-control" min="1" placeholder="2" value={huespedes} onChange={(e) => setHuespedes(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Playa</label>
              <select className="form-select" value={playa} onChange={(e) => setPlaya(e.target.value)}>
                <option value="">Todas</option>
                {playas.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-acb w-100" onClick={buscar}>Buscar chalets</button>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Chalets disponibles</h3>
        <h4 className="fw-bold mb-4">{cargado ? `${chalets.length} chalet${chalets.length !== 1 ? 's' : ''}` : ''}</h4>
      </div>

      <div className="row g-4">
        {chalets.map((c) => (
          <div className="col-md-6 col-lg-3 mb-4" key={c.id}>
            <div className="card h-100 border-0 shadow-sm rounded-4" style={{ cursor: 'pointer' }} onClick={() => verChalet(c.id)}>
              <Foto url={c.fotos[0]} alto={210} />
              <div className="card-body d-flex flex-column">
                <h5 className="card-title mb-1">{c.nombre}</h5>
                <p className="text-muted small mb-3">{c.playa}<br />Hasta {c.capacidad} personas</p>
                <div className="mt-auto d-flex justify-content-between align-items-center">
                  <div className="fs-5 fw-bold">{q(c.precio_noche)} <small className="fw-normal text-muted">/ noche</small></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {cargado && chalets.length === 0 && (
        <div className="text-muted py-4">No hay chalets disponibles con esos filtros.</div>
      )}

      <footer className="text-center py-5 small">ViveMonterrico - Reservas de chalets en las playas de Guatemala.</footer>

      <Modal show={!!detalle} onHide={cerrarModal} size="lg" scrollable centered>
        {detalle && (
          <>
            <Modal.Header closeButton>
              <div>
                <h4 className="modal-title mb-1">{detalle.nombre}</h4>
                <small className="text-muted">{detalle.playa}</small>
              </div>
            </Modal.Header>
            <Modal.Body>
              <div className="d-flex gap-2 mb-4 overflow-auto">
                {detalle.fotos.length
                  ? detalle.fotos.map((f) => <img key={f} src={f} alt="" style={{ height: 220, objectFit: 'cover', width: '100%', borderRadius: 12 }} />)
                  : <Foto url={null} alto={160} ancho="250px" redondeo={10} />}
              </div>

              <div className="card mb-3">
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-4"><strong>Playa</strong><br />{detalle.playa}</div>
                    <div className="col-md-4"><strong>Capacidad</strong><br />{detalle.capacidad} personas</div>
                    <div className="col-md-4"><strong>Precio</strong><br /><span className="precio">{q(detalle.precio_noche)}</span> / noche</div>
                  </div>
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-header fw-bold">Descripcion</div>
                <div className="card-body">{detalle.descripcion || <span className="text-muted">Sin descripcion.</span>}</div>
              </div>

              {detalle.reglas_precio.length > 0 && (
                <div className="card mb-3">
                  <div className="card-header fw-bold">Temporadas altas</div>
                  <div className="card-body py-2">
                    <ul className="mb-0">
                      {detalle.reglas_precio.map((r) => (
                        <li key={r.id}>
                          Recargo de <strong>+{r.porcentaje}%</strong> del <span className="text-primary">{r.fecha_inicio}</span> al <span className="text-primary">{r.fecha_fin}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="card mb-3">
                <div className="card-header fw-bold">Avisos del propietario</div>
                <div className="card-body">
                  {comentarios.length
                    ? comentarios.map((x) => <div className="alert alert-warning py-2 px-3 mb-2" key={x.id}>📢 {x.mensaje}</div>)
                    : <div className="text-muted">No hay avisos del propietario.</div>}
                </div>
              </div>

              {detalle.noches_ocupadas.length > 0 ? (
                <div className="card mb-3">
                  <div className="card-header fw-bold">Fechas no disponibles</div>
                  <div className="card-body">
                    <div className="mb-2"><span className="badge bg-danger">{detalle.noches_ocupadas.length} dia(s) ocupado(s)</span></div>
                    <div className="d-flex flex-wrap gap-1">
                      {detalle.noches_ocupadas.map((f) => <span className="badge bg-secondary" key={f}>{f}</span>)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-success">Disponible durante todo el calendario.</div>
              )}

              {!usuario && (
                <div className="alert alert-info">
                  Inicia sesion como cliente para realizar una reserva.<br />
                  <a href="/login" onClick={(e) => { e.preventDefault(); cerrarModal(); navigate('/login'); }}>Ir al inicio de sesion</a>
                </div>
              )}
              {usuario && usuario.rol === 'cliente' && (
                <div className="card">
                  <div className="card-header fw-bold">Solicitar reserva</div>
                  <div className="card-body">
                    {msgReserva && <div className={`alert alert-${msgReserva.tipo} py-2`}>{msgReserva.texto}</div>}
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Fecha de entrada</label>
                        <input type="date" className="form-control" value={formReserva.entrada} onChange={(e) => setFormReserva((f) => ({ ...f, entrada: e.target.value }))} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Fecha de salida</label>
                        <input type="date" className="form-control" value={formReserva.salida} onChange={(e) => setFormReserva((f) => ({ ...f, salida: e.target.value }))} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Huespedes</label>
                        <input type="number" min="1" max={detalle.capacidad} className="form-control" value={formReserva.huespedes} onChange={(e) => setFormReserva((f) => ({ ...f, huespedes: e.target.value }))} />
                      </div>
                      <div className="col-12">
                        <button className="btn btn-acb w-100" onClick={reservar}>Solicitar reserva</button>
                      </div>
                    </div>
                    <hr />
                    <small className="text-muted">
                      El pago se realiza mediante transferencia bancaria. Despues de solicitar la reserva podras subir el comprobante desde la seccion <strong>Mis reservas</strong>.
                    </small>
                  </div>
                </div>
              )}
              {usuario && usuario.rol !== 'cliente' && (
                <div className="alert alert-secondary">
                  Has iniciado sesion como <strong>{usuario.rol}</strong>. Las reservas unicamente pueden ser realizadas por clientes.
                </div>
              )}
            </Modal.Body>
          </>
        )}
      </Modal>
    </div>
  );
}
