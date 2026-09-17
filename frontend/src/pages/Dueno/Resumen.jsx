import { useEffect, useState } from 'react';
import { API, descargarArchivo } from '../../api/client.js';
import { q } from '../../utils/moneda.js';
import { linkWhatsApp, mensajeCheckin } from '../../utils/whatsapp.js';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import StatCard from '../../components/StatCard.jsx';

export default function Resumen() {
  const [dash, setDash] = useState(null);
  const [proximos, setProximos] = useState([]);
  const [repDesde, setRepDesde] = useState('');
  const [repHasta, setRepHasta] = useState('');
  const [msgReporte, setMsgReporte] = useState(null);

  async function cargarDash() { setDash(await API.get('/dueno/dashboard')); }
  async function cargarProximos() { setProximos(await API.get('/dueno/proximos-checkins?dias=7')); }

  useEffect(() => { cargarDash(); cargarProximos(); }, []);

  async function descargarReporte() {
    if (!repDesde || !repHasta) return setMsgReporte({ tipo: 'danger', texto: 'Selecciona el rango de fechas (desde y hasta)' });
    if (repDesde > repHasta) return setMsgReporte({ tipo: 'danger', texto: 'La fecha "desde" no puede ser posterior a "hasta"' });
    try {
      await descargarArchivo(`/dueno/reporte.pdf?desde=${repDesde}&hasta=${repHasta}`, `reporte-ViveMonterrico-${repDesde}-a-${repHasta}.pdf`);
      setMsgReporte(null);
    } catch (e) {
      setMsgReporte({ tipo: 'danger', texto: e.message });
    }
  }

  async function notificar(reservaId, empleadoId) {
    await API.put(`/empleados/reservas/${reservaId}/empleados/${empleadoId}/notificado`);
    cargarProximos();
  }

  if (!dash) return null;

  return (
    <div>
      <div className="row g-3 mb-3">
        <StatCard numero={dash.chalets_creados} etiqueta="Chalets creados" />
        <StatCard numero={dash.chalets_reservados} etiqueta="Con reserva activa" />
        <StatCard numero={dash.chalets_disponibles} etiqueta="Disponibles" />
        <StatCard numero={dash.reservas_pendientes} etiqueta="Reservas pendientes" />
      </div>

      {proximos.length > 0 && (
        <div className="card stat-card mb-4">
          <div className="card-body">
            <h6 className="mb-2">Proximos check-ins (7 dias)</h6>
            <p className="small text-muted mb-2">Avisa a tu personal de limpieza/piscina antes de que lleguen estos inquilinos.</p>
            {proximos.map((p) => (
              <div key={p.id} className={'p-2 mb-2 rounded-3 ' + (p.pendiente_notificar ? 'bg-warning-subtle' : 'bg-light')}>
                <div className="d-flex justify-content-between flex-wrap">
                  <div className="small">
                    <strong>{p.chalet_nombre}</strong> · entra <strong>{p.fecha_entrada}</strong> · {p.cliente_nombre} · {p.huespedes} huesped(es)
                  </div>
                </div>
                {p.empleados.length === 0 ? (
                  <div className="small text-muted mt-1">Sin personal asignado todavia. Asignalo desde Calendario.</div>
                ) : (
                  <div className="d-flex flex-wrap gap-2 mt-1">
                    {p.empleados.map((e) => (
                      <span key={e.empleado_id} className="small">
                        {e.nombre} ({e.tipo}){' '}
                        {e.notificado ? (
                          <span className="badge bg-success">avisado</span>
                        ) : (
                          <a
                            className="btn btn-outline-acb btn-sm py-0"
                            href={linkWhatsApp(e.telefono, mensajeCheckin(p))}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => notificar(p.id, e.empleado_id)}
                          >
                            Enviar WhatsApp
                          </a>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card stat-card mb-4">
        <div className="card-body">
          <h6 className="mb-2">Reporte descargable</h6>
          <p className="small text-muted mb-2">Descarga en PDF el detalle de reservas de un rango de fechas: quien reservo, por cuanto, el estado y los ingresos confirmados.</p>
          {msgReporte && <div className={`alert alert-${msgReporte.tipo} py-2`}>{msgReporte.texto}</div>}
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small mb-1">Desde</label>
              <input type="date" className="form-control form-control-sm" value={repDesde} onChange={(e) => setRepDesde(e.target.value)} />
            </div>
            <div className="col-auto">
              <label className="form-label small mb-1">Hasta</label>
              <input type="date" className="form-control form-control-sm" value={repHasta} onChange={(e) => setRepHasta(e.target.value)} />
            </div>
            <div className="col-auto">
              <button className="btn btn-acb btn-sm" onClick={descargarReporte}>Descargar PDF</button>
            </div>
          </div>
        </div>
      </div>

      <h6>Quien reservo mis chalets</h6>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead><tr><th>Cliente</th><th>Telefono</th><th>Chalet</th><th>Fechas</th><th>Estado</th><th>Monto</th></tr></thead>
          <tbody>
            {dash.reservantes.length === 0 && <tr><td colSpan={6} className="text-muted">Sin reservas todavia.</td></tr>}
            {dash.reservantes.map((r) => (
              <tr key={r.id}>
                <td>{r.cliente}</td>
                <td><a href={linkWhatsApp(r.telefono)} target="_blank" rel="noreferrer">{r.telefono}</a></td>
                <td>{r.chalet}</td>
                <td className="small">{r.fecha_entrada} → {r.fecha_salida}</td>
                <td><EstadoBadge estado={r.estado} /></td>
                <td>{q(r.monto_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
