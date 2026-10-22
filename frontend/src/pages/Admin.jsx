import { useEffect, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../utils/chartSetup.js';
import { API } from '../api/client.js';
import { q } from '../utils/moneda.js';
import EstadoBadge from '../components/EstadoBadge.jsx';

const COLORES_DOUGHNUT = ['#0f9b8e', '#16a34a', '#f59e0b', '#6366f1', '#ec4899'];

export default function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [chalets, setChalets] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [demanda, setDemanda] = useState(null);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState('usuarios');

  async function cargarUsuarios() { setUsuarios(await API.get('/admin/usuarios')); }
  async function cargarChalets() { setChalets(await API.get('/admin/chalets')); }
  async function cargarReservas() { setReservas(await API.get('/admin/reservas')); }
  async function cargarAnalitica() { setDemanda(await API.get('/dueno/analitica/demanda')); }

  useEffect(() => {
    cargarUsuarios();
    cargarChalets();
    cargarReservas();
  }, []);

  async function borrarUsuario(id) {
    if (!confirm('Eliminar usuario y todos sus datos asociados?')) return;
    try {
      await API.del('/admin/usuarios/' + id);
      setMsg({ tipo: 'success', texto: 'Usuario eliminado' });
      cargarUsuarios(); cargarChalets(); cargarReservas();
    } catch (e) {
      setMsg({ tipo: 'danger', texto: e.message });
    }
  }

  return (
    <div className="container">
      <h4 className="mb-3">Administracion</h4>
      {msg && <div className={`alert alert-${msg.tipo} py-2`}>{msg.texto}</div>}

      <Tabs activeKey={tab} onSelect={(k) => { setTab(k); if (k === 'analitica' && !demanda) cargarAnalitica(); }} className="mb-3">
        <Tab eventKey="usuarios" title="Usuarios">
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>#</th><th>Nombre</th><th>Email</th><th>Telefono</th><th>Rol</th><th></th></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td><td>{u.nombre}</td><td>{u.email}</td><td>{u.telefono}</td>
                    <td><span className="badge bg-light text-dark border">{u.rol}</span></td>
                    <td>{u.rol !== 'admin' && <button className="btn btn-outline-danger btn-sm" onClick={() => borrarUsuario(u.id)}>Eliminar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tab>

        <Tab eventKey="chalets" title="Chalets">
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>#</th><th>Nombre</th><th>Playa</th><th>Dueno</th><th>Precio</th><th>Cap.</th></tr></thead>
              <tbody>
                {chalets.map((c) => (
                  <tr key={c.id}><td>{c.id}</td><td>{c.nombre}</td><td>{c.playa}</td><td>{c.dueno}</td><td>{q(c.precio_noche)}</td><td>{c.capacidad}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tab>

        <Tab eventKey="reservas" title="Reservas">
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>#</th><th>Chalet</th><th>Cliente</th><th>Fechas</th><th>Estado</th><th>Monto</th></tr></thead>
              <tbody>
                {reservas.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td><td>{r.chalet_nombre}</td><td>{r.cliente_nombre}</td>
                    <td className="small">{r.fecha_entrada} → {r.fecha_salida}</td>
                    <td><EstadoBadge estado={r.estado} /></td><td>{q(r.monto_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tab>

        <Tab eventKey="analitica" title="Analitica global">
          {demanda && (
            <div className="row g-4">
              <div className="col-lg-6"><div className="card stat-card"><div className="card-body">
                <h6>Noches por mes (global)</h6>
                <Bar data={{ labels: demanda.por_mes.map((m) => m.mes), datasets: [{ data: demanda.por_mes.map((m) => m.noches), backgroundColor: '#0f9b8e' }] }} options={{ plugins: { legend: { display: false } } }} />
              </div></div></div>
              <div className="col-lg-6"><div className="card stat-card"><div className="card-body">
                <h6>Chalets mas reservados</h6>
                <Doughnut data={{ labels: demanda.chalets_top.map((x) => x.nombre), datasets: [{ data: demanda.chalets_top.map((x) => x.reservas), backgroundColor: COLORES_DOUGHNUT }] }} />
              </div></div></div>
            </div>
          )}
        </Tab>
      </Tabs>
    </div>
  );
}
