import { useEffect, useState } from 'react';
import { API } from '../../api/client.js';
import { linkWhatsApp, mensajeContactoEmpleado } from '../../utils/whatsapp.js';

const TIPOS_SUGERIDOS = ['Piscina', 'Limpieza', 'Mantenimiento', 'Jardineria', 'Seguridad'];
const FORM_VACIO = { nombre: '', telefono: '', tipo: '' };

export default function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [msg, setMsg] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [proximaPorEmpleado, setProximaPorEmpleado] = useState({});

  async function cargar() {
    setEmpleados(await API.get('/empleados'));
    setCargado(true);
  }

  // Reserva aceptada mas proxima (dentro de 6 meses) en la que cada
  // empleado esta asignado, para incluir las fechas en el mensaje de
  // WhatsApp. Si no hay ninguna, el mensaje se manda sin fechas.
  async function cargarProximas() {
    const checkins = await API.get('/dueno/proximos-checkins?dias=180');
    const mapa = {};
    for (const r of checkins) {
      for (const e of r.empleados) {
        if (!mapa[e.empleado_id] || r.fecha_entrada < mapa[e.empleado_id].fecha_entrada) {
          mapa[e.empleado_id] = r;
        }
      }
    }
    setProximaPorEmpleado(mapa);
  }

  useEffect(() => { cargar(); cargarProximas(); }, []);

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  }

  function editar(e) {
    setEditandoId(e.id);
    setForm({ nombre: e.nombre, telefono: e.telefono, tipo: e.tipo });
    setMsg(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
  }

  async function guardar() {
    try {
      if (editandoId) {
        await API.put('/empleados/' + editandoId, form);
      } else {
        await API.post('/empleados', form);
      }
      setForm(FORM_VACIO);
      setEditandoId(null);
      cargar();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function toggleActivo(empleado) {
    try { await API.put('/empleados/' + empleado.id, { activo: !empleado.activo }); cargar(); } catch (e) { setMsg(e.message); }
  }

  async function eliminar(id) {
    if (!confirm('Eliminar este empleado? Tambien se quitara de las reservas donde este asignado.')) return;
    try { await API.del('/empleados/' + id); cargar(); } catch (e) { setMsg(e.message); }
  }

  return (
    <div>
      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card stat-card">
            <div className="card-body">
              <h6 className="mb-3">{editandoId ? 'Editar empleado' : 'Nuevo empleado'}</h6>
              {msg && <div className="alert alert-danger py-2">{msg}</div>}
              <div className="mb-2">
                <label className="form-label small">Nombre</label>
                <input className="form-control" value={form.nombre} onChange={set('nombre')} />
              </div>
              <div className="mb-2">
                <label className="form-label small">Telefono (WhatsApp)</label>
                <input className="form-control" value={form.telefono} onChange={set('telefono')} placeholder="XXXXXXXX" />
              </div>
              <div className="mb-3">
                <label className="form-label small">Tipo de trabajo</label>
                <input className="form-control" list="tipos-empleado" value={form.tipo} onChange={set('tipo')} placeholder="Piscina, Limpieza..." />
                <datalist id="tipos-empleado">
                  {TIPOS_SUGERIDOS.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-acb btn-sm" onClick={guardar}>{editandoId ? 'Guardar cambios' : 'Agregar empleado'}</button>
                {editandoId && <button className="btn btn-outline-acb btn-sm" onClick={cancelarEdicion}>Cancelar</button>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <h6 className="mb-3">Mi personal</h6>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>Nombre</th><th>Telefono</th><th>Tipo</th><th>Activo</th><th></th></tr></thead>
              <tbody>
                {empleados.map((e) => (
                  <tr key={e.id}>
                    <td>{e.nombre}</td>
                    <td>{e.telefono}</td>
                    <td>{e.tipo}</td>
                    <td>
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" checked={e.activo} onChange={() => toggleActivo(e)} />
                      </div>
                    </td>
                    <td className="text-end">
                      <a
                        className="btn btn-outline-acb btn-sm me-1"
                        href={linkWhatsApp(e.telefono, mensajeContactoEmpleado(e, proximaPorEmpleado[e.id]))}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                      <button className="btn btn-outline-acb btn-sm me-1" onClick={() => editar(e)}>Editar</button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => eliminar(e.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cargado && empleados.length === 0 && <p className="text-muted">Aun no tienes empleados registrados.</p>}
        </div>
      </div>
    </div>
  );
}
