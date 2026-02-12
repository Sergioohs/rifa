const PDFDocument = require("pdfkit");
const { moneyStringFromCents, padNumber } = require("./utils");

async function buildRafflePDF({ raffle, tickets }) {
  const doc = new PDFDocument({ margin: 36 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));

  doc.fontSize(18).text(`Rifa: ${raffle.title}`);
  doc.moveDown(0.25);

  doc.fontSize(10);
  if (raffle.organizer_name) doc.text(`Organizador: ${raffle.organizer_name}`);
  if (raffle.responsible_name) doc.text(`Responsável: ${raffle.responsible_name}`);
  doc.text(`Valor: R$ ${moneyStringFromCents(raffle.ticket_price_cents)}`);
  if (raffle.draw_date) doc.text(`Data do sorteio: ${raffle.draw_date}`);
  doc.moveDown(0.75);

  doc.fontSize(12).text("Lista de números");
  doc.moveDown(0.5);

  // Cabeçalho simples
  doc.fontSize(9).text("Nº", 36, doc.y, { width: 35, continued: true })
    .text("Nome", 71, doc.y, { width: 220, continued: true })
    .text("Telefone", 291, doc.y, { width: 120, continued: true })
    .text("Pago", 411, doc.y, { width: 40, continued: true })
    .text("Obs", 451, doc.y, { width: 140 });

  doc.moveDown(0.3);
  doc.moveTo(36, doc.y).lineTo(559, doc.y).stroke();
  doc.moveDown(0.2);

  const width = Math.max(2, String(raffle.max_number || 0).length);
  tickets.forEach(t => {
    const y = doc.y;
    doc.fontSize(9)
      .text(padNumber(t.number_int, width), 36, y, { width: 35, continued: true })
      .text(t.buyer_name || "-", 71, y, { width: 220, continued: true })
      .text(t.buyer_phone || "-", 291, y, { width: 120, continued: true })
      .text(t.paid ? "SIM" : "NÃO", 411, y, { width: 40, continued: true })
      .text(t.note || "-", 451, y, { width: 140 });
    doc.moveDown(0.2);
    if (doc.y > 760) doc.addPage();
  });

  doc.end();

  return await new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { buildRafflePDF };
