// Utilidades compartidas: validacion basica, manejo de fechas y calculo de precio.

export class ErrorApp extends Error {
  constructor(mensaje, codigo = 400) {
    super(mensaje);
    this.codigo = codigo;
  }
}

// Valida formato YYYY-MM-DD.
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
export function esFecha(v) {
  return typeof v === 'string' && RE_FECHA.test(v) && !isNaN(Date.parse(v));
}

// Lista de fechas (YYYY-MM-DD) entre entrada (incluida) y salida (excluida).
// Se cobra por noche: entrada 10, salida 12 => noches del 10 y 11.
export function nochesEntre(entrada, salida) {
  const dias = [];
  const d = new Date(entrada + 'T00:00:00');
  const fin = new Date(salida + 'T00:00:00');
  while (d < fin) {
    dias.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

// Dos rangos se solapan si entradaA < salidaB y entradaB < salidaA.
export function seSolapan(entradaA, salidaA, entradaB, salidaB) {
  return entradaA < salidaB && entradaB < salidaA;
}

// Calcula el total aplicando las reglas de precio noche por noche.
// Devuelve tambien el desglose para mostrarlo al cliente.
export function calcularTotal(precioBase, reglas, entrada, salida) {
  const noches = nochesEntre(entrada, salida);
  let total = 0;
  const desglose = [];
  for (const noche of noches) {
    const regla = reglas.find((r) => noche >= r.fecha_inicio && noche <= r.fecha_fin);
    const pct = regla ? regla.porcentaje : 0;
    const monto = precioBase * (1 + pct / 100);
    total += monto;
    desglose.push({ fecha: noche, precio: Math.round(monto * 100) / 100, recargo: pct });
  }
  return { total: Math.round(total * 100) / 100, noches: noches.length, desglose };
}

// Envuelve un handler async y manda los errores al middleware de errores.
export function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
