export default function StatCard({ numero, etiqueta }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card stat-card">
        <div className="card-body text-center">
          <div className="num">{numero}</div>
          <div className="small text-muted">{etiqueta}</div>
        </div>
      </div>
    </div>
  );
}
