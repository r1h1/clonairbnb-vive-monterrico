// Arma un enlace de WhatsApp (wa.me). No envia nada automaticamente: el
// dueno hace clic y decide si lo manda, igual que ya hacia el panel actual
// con el telefono del cliente.
export function linkWhatsApp(telefono, mensaje) {
  const numero = (telefono || '').replace(/\D/g, '');
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

// Mensaje precargado para avisarle a un empleado (piscina, limpieza, etc.)
// la fecha en que entran los inquilinos de una reserva.
export function mensajeCheckin(reserva) {
  return (
    `Hola! Te aviso que en ${reserva.chalet_nombre} entran inquilinos el ${reserva.fecha_entrada} ` +
    `(salen el ${reserva.fecha_salida}). Son ${reserva.huespedes} huesped(es). Por favor coordina lo necesario antes de esa fecha.`
  );
}

// Mensaje para contactar a un empleado desde la lista de Empleados. Si tiene
// una reserva proxima asignada, incluye las fechas de check-in/check-out;
// si no, es un contacto generico sobre su servicio.
export function mensajeContactoEmpleado(empleado, reserva) {
  if (!reserva) {
    return `Hola, necesito tu servicio de ${empleado.tipo}. Contactame para coordinar, gracias.`;
  }
  return (
    `Hola, necesito tu servicio de ${empleado.tipo} para el ${reserva.fecha_entrada} (check-in) ` +
    `para mantener limpio en la entrada, y luego saldra el cliente el ${reserva.fecha_salida} (check-out), gracias.`
  );
}
