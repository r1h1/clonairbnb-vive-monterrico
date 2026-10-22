import { useEffect, useState } from 'react';
import { API } from '../../api/client.js';
import { q } from '../../utils/moneda.js';
import { linkWhatsApp } from '../../utils/whatsapp.js';
import EstadoBadge from '../../components/EstadoBadge.jsx';

export default function Reservas() {
  const [reservas, setReservas] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [msg, setMsg] = useState(null);

  async function cargar() {
    setReservas(await API.get('/reservas/dueno'));
    setCargado(true);
  }

  useEffect(() => { cargar(); }, []);

  async function aceptar(id) {
    try { await API.put(`/reservas/${id}/aceptar`); cargar(); } catch (e) { setMsg(e.message); }
  }

  async function declinar(id) {
    const motivo = prompt('Motivo del rechazo:');
    if (!motivo) return;
    try { await API.put(`/reservas/${id}/declinar`, { motivo }); cargar(); } catch (e) { setMsg(e.message); }
  }

  return (
    <div>
      <h6 className="mb-3">Solicitudes y reservas de mis chalets</h6>
      {msg && <div className="alert alert-danger py-2">{msg}</div>}

      <div className="row g-3">
        {reservas.map((r) => (
          <div className="col-md-6" key={r.id}>
            <div className="card stat-card h-100"><div className="card-body">
              <div className="d-flex justify-content-between">
                <h6 className="mb-1">{r.chalet_nombre}</h6>
                <EstadoBadge estado={r.estado} />
              </div>
              <div className="small text-muted">
                {r.cliente_nombre} · <a href={linkWhatsApp(r.cliente_telefono)} target="_blank" rel="noreferrer">{r.cliente_telefono}</a>
              </div>
              <div className="small">{r.fecha_entrada} → {r.fecha_salida} · {r.huespedes} huespedes · <span className="precio">{q(r.monto_total)}</span></div>
              {r.comprobante ? <a href={r.comprobante} target="_blank" rel="noreferrer" className="small">Ver comprobante</a> : <span className="small text-muted">Sin comprobante aun</span>}
              {r.motivo_rechazo && <div className="small text-danger">Motivo: {r.motivo_rechazo}</div>}
              {r.estado === 'pendiente' && (
                <div className="mt-2 d-flex gap-2 flex-wrap">
                  <button className="btn btn-acb btn-sm" onClick={() => aceptar(r.id)}>Aceptar</button>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => declinar(r.id)}>Declinar</button>
                </div>
              )}
            </div></div>
          </div>
        ))}
      </div>
      {cargado && reservas.length === 0 && <p className="text-muted">Sin reservas.</p>}
    </div>
  );
}
