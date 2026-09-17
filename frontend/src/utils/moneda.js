// Formatea Quetzales (equivalente a q() en frontend-legacy/js/sesion.js).
export function q(n) {
  return 'Q' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0 });
}
