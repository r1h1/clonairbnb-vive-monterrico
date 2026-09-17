export default function EstadoBadge({ estado }) {
  return <span className={`badge badge-estado estado-${estado}`}>{estado}</span>;
}
