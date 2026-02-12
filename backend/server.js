require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("./src/db");
const { ensureSchema } = require("./src/schema");
const { requireAuth } = require("./src/auth");
const { centsFromMoneyString, moneyStringFromCents } = require("./src/utils");
const { buildRafflePDF } = require("./src/pdf");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));

// Static frontends (separados)
app.use("/admin", express.static(path.join(__dirname, "..", "frontend", "admin")));
app.use("/", express.static(path.join(__dirname, "..", "frontend", "public")));

// Health
app.get("/api/health", (_, res) => res.json({ ok: true }));

// Auth
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e password obrigatórios" });

  const [[user]] = await query(process.env, "SELECT id, email, password_hash, role FROM users WHERE email = ? LIMIT 1", [email]);
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const token = jwt.sign({ uid: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
});

// Raffles
app.get("/api/raffles", requireAuth, async (req, res) => {
  const [rows] = await query(process.env, "SELECT * FROM raffles ORDER BY id DESC");
  // add max_number info
  for (const r of rows) {
    const [[mx]] = await query(process.env, "SELECT MAX(number_int) AS max_number, COUNT(*) AS total FROM tickets WHERE raffle_id = ?", [r.id]);
    r.max_number = mx.max_number || 0;
    r.total_tickets = mx.total || 0;
    r.ticket_price = moneyStringFromCents(r.ticket_price_cents);
  }
  res.json(rows);
});

app.post("/api/raffles", requireAuth, async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || "").trim();
  if (!title) return res.status(400).json({ error: "title obrigatório" });

  const organizer = b.organizer_name ? String(b.organizer_name).trim() : null;
  const responsible = b.responsible_name ? String(b.responsible_name).trim() : null;
  const price = centsFromMoneyString(b.ticket_price);
  const drawDate = b.draw_date ? String(b.draw_date) : null;

  const [r] = await query(process.env,
    "INSERT INTO raffles (title, organizer_name, responsible_name, ticket_price_cents, draw_date) VALUES (?, ?, ?, ?, ?)",
    [title, organizer, responsible, price, drawDate]
  );
  res.json({ id: r.insertId });
});

app.get("/api/raffles/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [[r]] = await query(process.env, "SELECT * FROM raffles WHERE id = ? LIMIT 1", [id]);
  if (!r) return res.status(404).json({ error: "Rifa não encontrada" });

  const [[mx]] = await query(process.env, "SELECT MAX(number_int) AS max_number, COUNT(*) AS total FROM tickets WHERE raffle_id = ?", [id]);
  r.max_number = mx.max_number || 0;
  r.total_tickets = mx.total || 0;
  r.ticket_price = moneyStringFromCents(r.ticket_price_cents);

  res.json(r);
});

// Generate tickets 1..N
app.post("/api/raffles/:id/generate-tickets", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const maxNumber = Number(req.body?.max_number);
  if (!Number.isInteger(maxNumber) || maxNumber <= 0 || maxNumber > 100000) {
    return res.status(400).json({ error: "max_number inválido (1..100000)" });
  }

  const [[r]] = await query(process.env, "SELECT id FROM raffles WHERE id = ? LIMIT 1", [id]);
  if (!r) return res.status(404).json({ error: "Rifa não encontrada" });

  // Insert in chunks (ignore duplicates)
  const chunk = 1000;
  for (let start = 1; start <= maxNumber; start += chunk) {
    const end = Math.min(maxNumber, start + chunk - 1);
    const values = [];
    const params = [];
    for (let n = start; n <= end; n++) {
      values.push("(?, ?)");
      params.push(id, n);
    }
    await query(process.env, `INSERT IGNORE INTO tickets (raffle_id, number_int) VALUES ${values.join(",")}`, params);
  }
  res.json({ ok: true, generated: maxNumber });
});

// Tickets list
app.get("/api/raffles/:id/tickets", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const q = String(req.query.q || "").trim();
  const paid = req.query.paid;
  const reserved = req.query.reserved;

  let sql = "SELECT * FROM tickets WHERE raffle_id = ?";
  const params = [id];

  if (q) {
    sql += " AND (number_int = ? OR buyer_name LIKE ? OR buyer_phone LIKE ?)";
    const maybeNum = Number(q);
    params.push(Number.isFinite(maybeNum) ? maybeNum : -1, `%${q}%`, `%${q}%`);
  }
  if (paid === "1" || paid === "0") {
    sql += " AND paid = ?";
    params.push(Number(paid));
  }
  if (reserved === "1" || reserved === "0") {
    sql += " AND reserved = ?";
    params.push(Number(reserved));
  }

  sql += " ORDER BY number_int ASC";
  const [rows] = await query(process.env, sql, params);
  res.json(rows);
});

// Update ticket
app.patch("/api/tickets/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const fields = [];
  const params = [];

  const allowed = ["buyer_name", "buyer_phone", "paid", "reserved", "note"];
  for (const k of allowed) {
    if (k in b) {
      fields.push(`${k} = ?`);
      params.push(b[k]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: "Nada para atualizar" });

  params.push(id);
  await query(process.env, `UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`, params);
  res.json({ ok: true });
});

// Draw
app.post("/api/raffles/:id/draw", requireAuth, async (req, res) => {
  const raffleId = Number(req.params.id);
  const onlyPaid = req.body?.only_paid !== undefined ? !!req.body.only_paid : true;

  const where = ["raffle_id = ?"];
  const params = [raffleId];
  if (onlyPaid) where.push("paid = 1");

  const [rows] = await query(process.env, `SELECT number_int, buyer_name, buyer_phone FROM tickets WHERE ${where.join(" AND ")}`);
  if (!rows.length) return res.status(400).json({ error: "Sem números disponíveis para sorteio" });

  const winner = rows[Math.floor(Math.random() * rows.length)];
  await query(process.env,
    "INSERT INTO draws (raffle_id, ticket_number, buyer_name, buyer_phone, only_paid) VALUES (?, ?, ?, ?, ?)",
    [raffleId, winner.number_int, winner.buyer_name || null, winner.buyer_phone || null, onlyPaid ? 1 : 0]
  );

  res.json({ winner });
});

// Export CSV
app.get("/api/raffles/:id/export.csv", requireAuth, async (req, res) => {
  const raffleId = Number(req.params.id);
  const [[raffle]] = await query(process.env, "SELECT * FROM raffles WHERE id = ? LIMIT 1", [raffleId]);
  if (!raffle) return res.status(404).json({ error: "Rifa não encontrada" });

  const [tickets] = await query(process.env, "SELECT number_int, buyer_name, buyer_phone, paid, reserved, note FROM tickets WHERE raffle_id = ? ORDER BY number_int ASC", [raffleId]);

  const header = ["numero","nome","telefone","pago","reservado","obs"].join(",");
  const lines = tickets.map(t => [
    t.number_int,
    escapeCSV(t.buyer_name || ""),
    escapeCSV(t.buyer_phone || ""),
    t.paid ? "SIM" : "NAO",
    t.reserved ? "SIM" : "NAO",
    escapeCSV(t.note || "")
  ].join(","));
  const csv = [header, ...lines].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="rifa_${raffleId}.csv"`);
  res.send(csv);
});

function escapeCSV(s) {
  const str = String(s);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Export PDF
app.get("/api/raffles/:id/export.pdf", requireAuth, async (req, res) => {
  const raffleId = Number(req.params.id);
  const [[raffle]] = await query(process.env, "SELECT * FROM raffles WHERE id = ? LIMIT 1", [raffleId]);
  if (!raffle) return res.status(404).json({ error: "Rifa não encontrada" });

  const [tickets] = await query(process.env, "SELECT number_int, buyer_name, buyer_phone, paid, note FROM tickets WHERE raffle_id = ? ORDER BY number_int ASC", [raffleId]);
  const [[mx]] = await query(process.env, "SELECT MAX(number_int) AS max_number FROM tickets WHERE raffle_id = ?", [raffleId]);
  raffle.max_number = mx.max_number || 0;

  const pdf = await buildRafflePDF({ raffle, tickets });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="rifa_${raffleId}.pdf"`);
  res.send(pdf);
});

// Public API (sem login) - consultar rifa e ticket
app.get("/api/public/raffles/:id", async (req, res) => {
  const raffleId = Number(req.params.id);
  const [[raffle]] = await query(process.env, "SELECT id, title, organizer_name, responsible_name, ticket_price_cents, draw_date, status FROM raffles WHERE id = ? LIMIT 1", [raffleId]);
  if (!raffle) return res.status(404).json({ error: "Rifa não encontrada" });
  raffle.ticket_price = moneyStringFromCents(raffle.ticket_price_cents);
  res.json(raffle);
});

app.get("/api/public/raffles/:id/tickets/:number", async (req, res) => {
  const raffleId = Number(req.params.id);
  const number = Number(req.params.number);
  const [[t]] = await query(process.env, "SELECT number_int, buyer_name, buyer_phone, paid, reserved, note FROM tickets WHERE raffle_id = ? AND number_int = ? LIMIT 1", [raffleId, number]);
  if (!t) return res.status(404).json({ error: "Número não encontrado" });
  res.json(t);
});

async function start() {
  await ensureSchema(process.env);

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`✅ Servidor rodando em http://localhost:${port}`));
}

start().catch((e) => {
  console.error("Erro ao iniciar:", e);
  process.exit(1);
});
