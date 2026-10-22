import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import '../../utils/chartSetup.js';
import { API } from '../../api/client.js';
import { q } from '../../utils/moneda.js';

const COLOR_PRIMARIO = '#0f9b8e';
const COLOR_ACENTO = '#16a34a';
const COLORES_DOUGHNUT = ['#0f9b8e', '#16a34a', '#f59e0b', '#6366f1', '#ec4899'];

export default function Analitica() {
  const [demanda, setDemanda] = useState(null);
  const [proyeccion, setProyeccion] = useState(null);
  const [metricas, setMetricas] = useState(null);

  useEffect(() => {
    API.get('/dueno/analitica/demanda').then(setDemanda);
    API.get('/dueno/analitica/proyeccion').then(setProyeccion);
    API.get('/dueno/analitica/metricas').then(setMetricas);
  }, []);

  return (
    <div>
      {metricas && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-2"><div className="card stat-card"><div className="card-body text-center"><div className="num">{metricas.ocupacion_pct}%</div><div className="small text-muted">Ocupacion</div></div></div></div>
          <div className="col-6 col-lg-2"><div className="card stat-card"><div className="card-body text-center"><div className="num" style={{ fontSize: '1.3rem' }}>{q(metricas.ingreso_confirmado)}</div><div className="small text-muted">Ingreso confirmado</div></div></div></div>
          <div className="col-6 col-lg-2"><div className="card stat-card"><div className="card-body text-center"><div className="num" style={{ fontSize: '1.3rem' }}>{q(metricas.ticket_promedio)}</div><div className="small text-muted">Ticket promedio</div></div></div></div>
          <div className="col-6 col-lg-2"><div className="card stat-card"><div className="card-body text-center"><div className="num">{metricas.clientes_recurrentes}</div><div className="small text-muted">Clientes recurrentes</div></div></div></div>
          <div className="col-6 col-lg-2"><div className="card stat-card"><div className="card-body text-center"><div className="num">{metricas.tasa_aceptacion_pct}%</div><div className="small text-muted">Tasa de aceptacion</div></div></div></div>
          <div className="col-6 col-lg-2"><div className="card stat-card"><div className="card-body text-center"><div className="num">{metricas.chalets_activos}</div><div className="small text-muted">Chalets activos</div></div></div></div>
        </div>
      )}

      <div className="row g-4">
        <div className="col-lg-6"><div className="card stat-card"><div className="card-body">
          <h6>Noches reservadas por mes</h6>
          {demanda && <Bar data={{ labels: demanda.por_mes.map((m) => m.mes), datasets: [{ label: 'Noches', data: demanda.por_mes.map((m) => m.noches), backgroundColor: COLOR_PRIMARIO }] }} options={{ plugins: { legend: { display: false } } }} />}
        </div></div></div>

        <div className="col-lg-6"><div className="card stat-card"><div className="card-body">
          <h6>Noches por dia de la semana</h6>
          {demanda && <Bar data={{ labels: demanda.por_dia_semana.map((x) => x.dia), datasets: [{ label: 'Noches', data: demanda.por_dia_semana.map((x) => x.noches), backgroundColor: COLOR_ACENTO }] }} options={{ plugins: { legend: { display: false } } }} />}
        </div></div></div>

        <div className="col-lg-6"><div className="card stat-card"><div className="card-body">
          <h6>Chalets mas reservados</h6>
          {demanda && <Doughnut data={{ labels: demanda.chalets_top.map((x) => x.nombre), datasets: [{ data: demanda.chalets_top.map((x) => x.reservas), backgroundColor: COLORES_DOUGHNUT }] }} />}
        </div></div></div>

        <div className="col-lg-6"><div className="card stat-card"><div className="card-body">
          <h6>Proyeccion de demanda (estimado)</h6>
          {proyeccion && (
            <>
              <Line data={{
                labels: proyeccion.proyeccion.map((x) => x.mes),
                datasets: [
                  { label: 'Historico', data: proyeccion.proyeccion.map((x) => x.historico), borderColor: COLOR_PRIMARIO, tension: 0.3 },
                  { label: 'Estimado', data: proyeccion.proyeccion.map((x) => x.estimado), borderColor: '#f59e0b', borderDash: [5, 5], tension: 0.3 },
                ],
              }} />
              <p className="small text-muted mt-2 mb-0">{proyeccion.metodo}{proyeccion.mes_pico ? ' · Mes pico: ' + proyeccion.mes_pico : ''}</p>
            </>
          )}
        </div></div></div>

        <div className="col-12"><div className="card stat-card"><div className="card-body">
          <h6>Demanda en fechas festivas</h6>
          {demanda && (demanda.festivos.length ? (
            <>
              {demanda.festivos.map((f) => <span className="badge bg-light text-dark border me-1 mb-1" key={f.nombre}>{f.nombre}: {f.noches} noche(s)</span>)}
              <p className="small text-muted mt-2 mb-0">{demanda.nota_semana_santa}</p>
            </>
          ) : <span className="text-muted small">Sin reservas en fechas festivas.</span>)}
        </div></div></div>
      </div>
    </div>
  );
}
