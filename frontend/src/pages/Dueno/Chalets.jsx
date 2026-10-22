import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { API } from '../../api/client.js';
import { q } from '../../utils/moneda.js';
import { Foto } from '../../components/FotoPlaceholder.jsx';

function ChaletCard({ chalet, onCambio, onMsg, onEditar }) {
  const [archivos, setArchivos] = useState(null);
  const [mostrarRegla, setMostrarRegla] = useState(false);
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [reglaForm, setReglaForm] = useState({ inicio: '', fin: '', porcentaje: '' });
  const [avisoTexto, setAvisoTexto] = useState('');

  async function subirFotos() {
    if (!archivos || !archivos.length) return;
    const fd = new FormData();
    [...archivos].forEach((f) => fd.append('fotos', f));
    try { await API.upload(`/chalets/${chalet.id}/fotos`, fd); onCambio(); } catch (e) { onMsg(e.message); }
  }

  async function borrarChalet() {
    if (!confirm('Eliminar este chalet y sus reservas?')) return;
    try { await API.del(`/chalets/${chalet.id}`); onCambio(); } catch (e) { onMsg(e.message); }
  }

  async function agregarRegla() {
    try {
      await API.post(`/chalets/${chalet.id}/reglas`, {
        fecha_inicio: reglaForm.inicio, fecha_fin: reglaForm.fin, porcentaje: Number(reglaForm.porcentaje),
      });
      setReglaForm({ inicio: '', fin: '', porcentaje: '' });
      onCambio();
    } catch (e) { onMsg(e.message); }
  }

  async function borrarRegla(id) {
    try { await API.del(`/chalets/reglas/${id}`); onCambio(); } catch (e) { onMsg(e.message); }
  }

  async function cargarAvisos() {
    setAvisos(await API.get(`/chalets/${chalet.id}/comentarios`));
  }

  function toggleAviso() {
    const abrir = !mostrarAviso;
    setMostrarAviso(abrir);
    if (abrir) cargarAvisos();
  }

  async function agregarAviso() {
    try {
      await API.post(`/chalets/${chalet.id}/comentarios`, { mensaje: avisoTexto });
      setAvisoTexto('');
      cargarAvisos();
    } catch (e) { onMsg(e.message); }
  }

  async function borrarAviso(id) {
    try { await API.del(`/chalets/comentarios/${id}`); cargarAvisos(); } catch (e) { onMsg(e.message); }
  }

  return (
    <div className="col-md-6">
      <div className="card stat-card h-100"><div className="card-body">
        <div className="d-flex justify-content-between">
          <h6 className="mb-1">{chalet.nombre}</h6>
          <span className="precio">{q(chalet.precio_noche)}</span>
        </div>
        <div className="small text-muted mb-2">
          📍 {chalet.playa} · cap. {chalet.capacidad} · {chalet.fotos.length}/5 fotos {!chalet.activo && <span className="text-danger">· inactivo</span>}
        </div>
        <div className="d-flex gap-1 mb-2 overflow-auto">
          {chalet.fotos.length
            ? chalet.fotos.map((f) => <img key={f} src={f} alt="" style={{ height: 56, borderRadius: 6 }} />)
            : <Foto url={null} alto={56} ancho="80px" redondeo={6} />}
        </div>
        <div className="mb-2">
          <label className="small">Subir fotos (max 5)</label>
          <div className="input-group input-group-sm">
            <input type="file" accept="image/*" multiple className="form-control" onChange={(e) => setArchivos(e.target.files)} />
            <button className="btn btn-outline-acb" onClick={subirFotos}>Subir</button>
          </div>
        </div>
        {chalet.reglas_precio.length > 0 && (
          <ul className="mb-2">
            {chalet.reglas_precio.map((r) => (
              <li className="small" key={r.id}>
                +{r.porcentaje}% {r.fecha_inicio} a {r.fecha_fin}{' '}
                <a href="#" className="text-danger" onClick={(e) => { e.preventDefault(); borrarRegla(r.id); }}>quitar</a>
              </li>
            ))}
          </ul>
        )}
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-acb btn-sm" onClick={() => onEditar(chalet)}>Editar</button>
          <button className="btn btn-outline-acb btn-sm" onClick={() => setMostrarRegla((v) => !v)}>Regla precio</button>
          <button className="btn btn-outline-acb btn-sm" onClick={toggleAviso}>Aviso</button>
          <button className="btn btn-outline-danger btn-sm" onClick={borrarChalet}>Eliminar</button>
        </div>
        {mostrarRegla && (
          <div className="mt-2">
            <div className="row g-1">
              <div className="col"><input type="date" className="form-control form-control-sm" value={reglaForm.inicio} onChange={(e) => setReglaForm((f) => ({ ...f, inicio: e.target.value }))} /></div>
              <div className="col"><input type="date" className="form-control form-control-sm" value={reglaForm.fin} onChange={(e) => setReglaForm((f) => ({ ...f, fin: e.target.value }))} /></div>
              <div className="col-3"><input type="number" className="form-control form-control-sm" placeholder="%" value={reglaForm.porcentaje} onChange={(e) => setReglaForm((f) => ({ ...f, porcentaje: e.target.value }))} /></div>
              <div className="col-auto"><button className="btn btn-acb btn-sm" onClick={agregarRegla}>+</button></div>
            </div>
          </div>
        )}
        {mostrarAviso && (
          <div className="mt-2">
            <div className="input-group input-group-sm">
              <input className="form-control" placeholder="Ej: de 7 a 13h no habra luz por mantenimiento" value={avisoTexto} onChange={(e) => setAvisoTexto(e.target.value)} />
              <button className="btn btn-acb" onClick={agregarAviso}>Publicar aviso</button>
            </div>
            <div className="mt-1">
              {avisos.map((x) => (
                <div className="aviso p-1 px-2 small mt-1" key={x.id}>
                  {x.mensaje} <a href="#" className="text-danger" onClick={(e) => { e.preventDefault(); borrarAviso(x.id); }}>x</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div></div>
    </div>
  );
}

const FORM_VACIO = { nombre: '', playa: '', precio_noche: '', capacidad: '', activo: true, descripcion: '', direccion_completa: '', instrucciones_checkin: '' };

export default function Chalets() {
  const [chalets, setChalets] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editId, setEditId] = useState(0);
  const [form, setForm] = useState(FORM_VACIO);
  const [msgForm, setMsgForm] = useState(null);

  async function cargarChalets() {
    setChalets(await API.get('/chalets/mios'));
    setCargado(true);
  }

  useEffect(() => { cargarChalets(); }, []);

  function nuevo() {
    setEditId(0);
    setForm(FORM_VACIO);
    setMsgForm(null);
    setModalAbierto(true);
  }

  function editar(c) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre, playa: c.playa, precio_noche: c.precio_noche, capacidad: c.capacidad,
      activo: c.activo, descripcion: c.descripcion || '', direccion_completa: c.direccion_completa || '',
      instrucciones_checkin: c.instrucciones_checkin || '',
    });
    setMsgForm(null);
    setModalAbierto(true);
  }

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: campo === 'activo' ? e.target.checked : e.target.value }));
  }

  async function guardar() {
    const body = {
      nombre: form.nombre, playa: form.playa, descripcion: form.descripcion,
      precio_noche: Number(form.precio_noche), capacidad: Number(form.capacidad),
      direccion_completa: form.direccion_completa, instrucciones_checkin: form.instrucciones_checkin,
    };
    if (editId) body.activo = form.activo;
    try {
      if (editId) await API.put('/chalets/' + editId, body); else await API.post('/chalets', body);
      setModalAbierto(false);
      setMsg({ tipo: 'success', texto: 'Chalet guardado' });
      cargarChalets();
    } catch (e) {
      setMsgForm(e.message);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Mis chalets</h6>
        <button className="btn btn-acb btn-sm" onClick={nuevo}>+ Nuevo chalet</button>
      </div>
      {msg && <div className={`alert alert-${msg.tipo} py-2`}>{msg.texto}</div>}

      <div className="row g-3">
        {chalets.map((c) => (
          <ChaletCard key={c.id} chalet={c} onCambio={cargarChalets} onMsg={(t) => setMsg({ tipo: 'danger', texto: t })} onEditar={editar} />
        ))}
      </div>
      {cargado && chalets.length === 0 && <p className="text-muted">Aun no tienes chalets. Crea el primero.</p>}

      <Modal show={modalAbierto} onHide={() => setModalAbierto(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? 'Editar' : 'Nuevo'} chalet</Modal.Title></Modal.Header>
        <Modal.Body>
          {msgForm && <div className="alert alert-danger py-2">{msgForm}</div>}
          <div className="row g-2">
            <div className="col-md-6"><label className="form-label small">Nombre</label><input className="form-control" value={form.nombre} onChange={set('nombre')} /></div>
            <div className="col-md-6"><label className="form-label small">Playa</label><input className="form-control" value={form.playa} onChange={set('playa')} /></div>
            <div className="col-md-4"><label className="form-label small">Precio/noche (Q)</label><input type="number" className="form-control" value={form.precio_noche} onChange={set('precio_noche')} /></div>
            <div className="col-md-4"><label className="form-label small">Capacidad</label><input type="number" className="form-control" value={form.capacidad} onChange={set('capacidad')} /></div>
            <div className="col-md-4 d-flex align-items-end">
              {editId ? (
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="c_activo" checked={form.activo} onChange={set('activo')} />
                  <label className="form-check-label small" htmlFor="c_activo">Activo</label>
                </div>
              ) : null}
            </div>
            <div className="col-12"><label className="form-label small">Descripcion</label><textarea className="form-control" rows={2} value={form.descripcion} onChange={set('descripcion')} /></div>
            <div className="col-md-6"><label className="form-label small">Direccion completa (privada)</label><input className="form-control" value={form.direccion_completa} onChange={set('direccion_completa')} /></div>
            <div className="col-md-6"><label className="form-label small">Instrucciones check-in (privadas)</label><input className="form-control" value={form.instrucciones_checkin} onChange={set('instrucciones_checkin')} /></div>
          </div>
          <p className="small text-muted mt-2">La direccion e instrucciones solo se muestran al cliente cuando aceptas su reserva.</p>
        </Modal.Body>
        <Modal.Footer><button className="btn btn-acb" onClick={guardar}>Guardar</button></Modal.Footer>
      </Modal>
    </div>
  );
}
