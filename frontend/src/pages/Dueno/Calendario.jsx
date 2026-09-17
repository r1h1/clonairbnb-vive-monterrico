import { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { API } from '../../api/client.js';
import { linkWhatsApp, mensajeCheckin } from '../../utils/whatsapp.js';
import EstadoBadge from '../../components/EstadoBadge.jsx';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fmt(d) { return d.toISOString().slice(0, 10); }

export default function Calendario() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [reservas, setReservas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [seleccionEmpleado, setSeleccionEmpleado] = useState({});

  const { celdas, desde, hasta } = useMemo(() => {
    const primerDiaMes = new Date(cursor);
    const offset = primerDiaMes.getDay();
    const inicioGrid = new Date(primerDiaMes);
    inicioGrid.setDate(inicioGrid.getDate() - offset);
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicioGrid);
      d.setDate(d.getDate() + i);
      dias.push(d);
    }
    return { celdas: dias, desde: fmt(dias[0]), hasta: fmt(dias[41]) };
  }, [cursor]);

  async function cargar() {
    setReservas(await API.get(`/dueno/calendario?desde=${desde}&hasta=${hasta}`));
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [desde, hasta]);
  useEffect(() => { API.get('/empleados').then(setEmpleados); }, []);

  function eventosDelDia(fechaStr) {
    return reservas.filter((r) => r.fecha_entrada === fechaStr || r.fecha_salida === fechaStr);
  }

  const hoyStr = fmt(new Date());
  const reservasDelDia = diaSeleccionado ? reservas.filter((r) => r.fecha_entrada === diaSeleccionado) : [];

  async function asignar(reservaId) {
    const empleadoId = seleccionEmpleado[reservaId];
    if (!empleadoId) return;
    await API.post(`/empleados/reservas/${reservaId}/asignar`, { empleado_ids: [Number(empleadoId)] });
    setSeleccionEmpleado((s) => ({ ...s, [reservaId]: '' }));
    cargar();
  }

  async function quitar(reservaId, empleadoId) {
    await API.del(`/empleados/reservas/${reservaId}/empleados/${empleadoId}`);
    cargar();
  }

  async function marcarNotificado(reservaId, empleadoId) {
    await API.put(`/empleados/reservas/${reservaId}/empleados/${empleadoId}/notificado`);
    cargar();
  }

  function mesAnterior() { setCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d; }); }
  function mesSiguiente() { setCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d; }); }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-outline-acb btn-sm" onClick={mesAnterior}>← Anterior</button>
        <h6 className="mb-0">{MESES[cursor.getMonth()]} {cursor.getFullYear()}</h6>
        <button className="btn btn-outline-acb btn-sm" onClick={mesSiguiente}>Siguiente →</button>
      </div>

      <div className="calendario-grid mb-1">
        {DIAS_SEMANA.map((d) => <div className="calendario-dia-nombre" key={d}>{d}</div>)}
      </div>
      <div className="calendario-grid">
        {celdas.map((d) => {
          const fechaStr = fmt(d);
          const fueraDeMes = d.getMonth() !== cursor.getMonth();
          const eventos = eventosDelDia(fechaStr);
          const tieneEntrada = eventos.some((r) => r.fecha_entrada === fechaStr);
          return (
            <div
              key={fechaStr}
              className={'calendario-celda' + (fueraDeMes ? ' fuera-de-mes' : '') + (fechaStr === hoyStr ? ' hoy' : '')}
              onClick={() => tieneEntrada && setDiaSeleccionado(fechaStr)}
            >
              <div className="numero">{d.getDate()}</div>
              {eventos.map((r) => {
                const esEntrada = r.fecha_entrada === fechaStr;
                const pendiente = esEntrada && (r.empleados.length === 0 || r.empleados.some((e) => !e.notificado));
                return (
                  <div key={r.id + (esEntrada ? '-e' : '-s')} className={`calendario-evento estado-${r.estado}${pendiente ? ' pendiente-notificar' : ''}`}>
                    {esEntrada ? 'Entra' : 'Sale'}: {r.chalet_nombre}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="small text-muted mt-2 mb-0">Los dias con borde naranja tienen un check-in sin todo su personal avisado. Haz clic en un dia con check-in para asignar empleados y enviarles el aviso por WhatsApp.</p>

      <Modal show={!!diaSeleccionado} onHide={() => setDiaSeleccionado(null)} size="lg">
        <Modal.Header closeButton><Modal.Title>Check-ins del {diaSeleccionado}</Modal.Title></Modal.Header>
        <Modal.Body>
          {reservasDelDia.map((r) => (
            <div className="card mb-3" key={r.id}>
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <h6 className="mb-1">{r.chalet_nombre}</h6>
                  <EstadoBadge estado={r.estado} />
                </div>
                <div className="small text-muted mb-2">
                  {r.cliente_nombre} · {r.cliente_telefono} · {r.huespedes} huesped(es) · {r.fecha_entrada} → {r.fecha_salida}
                </div>

                <div className="mb-2">
                  <strong className="small">Personal asignado</strong>
                  {r.empleados.length === 0 && <div className="small text-muted">Ninguno todavia.</div>}
                  <div className="d-flex flex-wrap gap-2 mt-1">
                    {r.empleados.map((e) => (
                      <span key={e.empleado_id} className="badge bg-light text-dark border d-flex align-items-center gap-1">
                        {e.nombre} ({e.tipo})
                        {e.notificado ? (
                          <span className="badge bg-success">avisado</span>
                        ) : (
                          <a
                            href={linkWhatsApp(e.telefono, mensajeCheckin(r))}
                            target="_blank"
                            rel="noreferrer"
                            className="text-decoration-none"
                            onClick={() => marcarNotificado(r.id, e.empleado_id)}
                          >
                            WhatsApp
                          </a>
                        )}
                        <a href="#" className="text-danger" onClick={(ev) => { ev.preventDefault(); quitar(r.id, e.empleado_id); }}>x</a>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="input-group input-group-sm">
                  <select
                    className="form-select"
                    value={seleccionEmpleado[r.id] || ''}
                    onChange={(e) => setSeleccionEmpleado((s) => ({ ...s, [r.id]: e.target.value }))}
                  >
                    <option value="">Asignar empleado...</option>
                    {empleados.filter((e) => e.activo && !r.empleados.some((a) => a.empleado_id === e.id)).map((e) => (
                      <option key={e.id} value={e.id}>{e.nombre} ({e.tipo})</option>
                    ))}
                  </select>
                  <button className="btn btn-acb" onClick={() => asignar(r.id)}>Asignar</button>
                </div>
              </div>
            </div>
          ))}
          {empleados.length === 0 && (
            <div className="alert alert-info small mb-0">Aun no tienes empleados registrados. Agrega uno en la pestana Empleados.</div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
