// Caja "Sin foto todavia" (equivalente a cajaFoto() en frontend-legacy/js/sesion.js
// cuando no hay url), para no depender de imagenes externas.
export default function FotoPlaceholder({ alto = 190, ancho = '100%', redondeo = 0 }) {
  return (
    <div className="foto-placeholder" style={{ height: alto, width: ancho, borderRadius: redondeo }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
        <circle cx="9" cy="10" r="1.6"></circle>
        <path d="M21 15l-5-4-4 3-3-2-6 5"></path>
      </svg>
      <span>Sin foto todavia</span>
    </div>
  );
}

export function Foto({ url, alto = 190, ancho = '100%', redondeo = 0 }) {
  if (!url) return <FotoPlaceholder alto={alto} ancho={ancho} redondeo={redondeo} />;
  return (
    <img
      src={url}
      alt=""
      style={{ height: alto, width: ancho, objectFit: 'cover', borderRadius: redondeo }}
    />
  );
}
