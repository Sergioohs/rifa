function centsFromMoneyString(v) {
  // Aceita "5", "5,00", "5.00"
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(".", "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function moneyStringFromCents(c) {
  const n = Number(c || 0) / 100;
  return n.toFixed(2).replace(".", ",");
}

function padNumber(n, width) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

module.exports = { centsFromMoneyString, moneyStringFromCents, padNumber };
