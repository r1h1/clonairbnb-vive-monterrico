import PDFDocument from 'pdfkit';

const TEAL = '#0f9b8e';
const TEAL_OSC = '#0b7d72';
const INK = '#1f2d3d';
const MUTED = '#6b7a8d';
const FONDO = '#f6f8fa';

const COLORES_ESTADO = {
  pendiente: '#92600a',
  aceptada: '#166534',
  declinada: '#991b1b',
  cancelada: '#374151',
};

function formatoQ(n) {
  return 'Q ' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Genera y transmite (streaming) un PDF con el reporte de reservas de un
// rango de fechas. `filas` viene de services/reservas.js -> reporte().
export function generarReporteReservas(res, filas, { desde, hasta, usuario }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-ViveMonterrico-${desde}-a-${hasta}.pdf"`);
  doc.pipe(res);

  const anchoPagina = doc.page.width;

  // --- Encabezado con marca ---
  doc.rect(0, 0, anchoPagina, 86).fill(TEAL);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('ViveMonterrico', 40, 24);
  doc.font('Helvetica').fontSize(11).text('Reporte de reservas', 40, 52);
  doc.font('Helvetica').fontSize(8).fillColor('#d7f3ef')
    .text(`Generado el ${new Date().toLocaleString('es-GT')}`, 40, 68);

  let y = 106;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12)
    .text(`Periodo del reporte: ${desde} al ${hasta}`, 40, y);
  y += 16;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(`Generado por: ${usuario.nombre}  ·  Rol: ${usuario.rol}`, 40, y);
  y += 24;

  // --- Tarjetas de resumen ---
  const aceptadas = filas.filter((r) => r.estado === 'aceptada');
  const pendientes = filas.filter((r) => r.estado === 'pendiente');
  const ingresosConfirmados = aceptadas.reduce((s, r) => s + r.monto_total, 0);
  const ingresosPotenciales = pendientes.reduce((s, r) => s + r.monto_total, 0);

  const tarjetas = [
    ['Reservas en el periodo', String(filas.length)],
    ['Confirmadas', String(aceptadas.length)],
    ['Pendientes', String(pendientes.length)],
    ['Ingresos confirmados', formatoQ(ingresosConfirmados)],
    ['Ingresos potenciales', formatoQ(ingresosPotenciales)],
  ];
  const altoTarjetas = 76;
  doc.roundedRect(40, y, anchoPagina - 80, altoTarjetas, 8).fill(FONDO);
  const colW = (anchoPagina - 100) / 3;
  tarjetas.forEach((item, i) => {
    const cx = 50 + (i % 3) * colW;
    const cy = y + 12 + Math.floor(i / 3) * 34;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(item[0], cx, cy, { width: colW - 10 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(TEAL_OSC).text(item[1], cx, cy + 12, { width: colW - 10 });
  });
  y += altoTarjetas + 20;

  // --- Tabla de reservas ---
  const columnas = [
    { titulo: 'Chalet', ancho: 100, campo: 'chalet_nombre' },
    { titulo: 'Cliente', ancho: 90, campo: 'cliente_nombre' },
    { titulo: 'Entrada', ancho: 58, campo: 'fecha_entrada' },
    { titulo: 'Salida', ancho: 58, campo: 'fecha_salida' },
    { titulo: 'Hues.', ancho: 32, campo: 'huespedes' },
    { titulo: 'Estado', ancho: 62, campo: 'estado' },
    { titulo: 'Monto', ancho: 65, campo: 'monto_total' },
  ];
  const anchoTabla = columnas.reduce((s, c) => s + c.ancho, 0);
  const xTabla = (anchoPagina - anchoTabla) / 2;

  function dibujarEncabezado(yPos) {
    doc.rect(xTabla, yPos, anchoTabla, 20).fill(TEAL);
    let x = xTabla;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    for (const c of columnas) {
      doc.text(c.titulo, x + 4, yPos + 6, { width: c.ancho - 8 });
      x += c.ancho;
    }
    return yPos + 20;
  }

  y = dibujarEncabezado(y);

  if (!filas.length) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('No hay reservas registradas en este periodo.', xTabla, y + 10, { width: anchoTabla });
  }

  filas.forEach((r, i) => {
    if (y > doc.page.height - 90) {
      doc.addPage();
      y = 40;
      y = dibujarEncabezado(y);
    }
    if (i % 2 === 0) doc.rect(xTabla, y, anchoTabla, 18).fill(FONDO);
    let x = xTabla;
    const valores = [
      r.chalet_nombre, r.cliente_nombre, r.fecha_entrada, r.fecha_salida,
      String(r.huespedes), r.estado, formatoQ(r.monto_total),
    ];
    doc.font('Helvetica').fontSize(8);
    valores.forEach((val, idx) => {
      doc.fillColor(idx === 5 ? (COLORES_ESTADO[r.estado] || INK) : INK);
      doc.text(val, x + 4, y + 5, { width: columnas[idx].ancho - 8, ellipsis: true });
      x += columnas[idx].ancho;
    });
    y += 18;
  });

  // --- Pie de pagina con numeracion ---
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
      `ViveMonterrico - Reporte de reservas - Pagina ${i + 1} de ${rango.count}`,
      40,
      doc.page.height - 30,
      { width: anchoPagina - 80, align: 'center' }
    );
  }

  doc.end();
}