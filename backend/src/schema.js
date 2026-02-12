const bcrypt = require("bcryptjs");
const { query } = require("./db");

async function ensureSchema(env) {
  // users
  await query(env, `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // raffles
  await query(env, `
    CREATE TABLE IF NOT EXISTS raffles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      organizer_name VARCHAR(200) NULL,
      responsible_name VARCHAR(200) NULL,
      ticket_price_cents INT NOT NULL DEFAULT 0,
      draw_date DATE NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active', -- active|closed
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // tickets
  await query(env, `
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      raffle_id INT NOT NULL,
      number_int INT NOT NULL,
      buyer_name VARCHAR(200) NULL,
      buyer_phone VARCHAR(80) NULL,
      paid TINYINT(1) NOT NULL DEFAULT 0,
      reserved TINYINT(1) NOT NULL DEFAULT 0,
      note VARCHAR(255) NULL,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_raffle_ticket (raffle_id, number_int),
      INDEX idx_raffle (raffle_id),
      CONSTRAINT fk_tickets_raffle FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // draws
  await query(env, `
    CREATE TABLE IF NOT EXISTS draws (
      id INT AUTO_INCREMENT PRIMARY KEY,
      raffle_id INT NOT NULL,
      ticket_number INT NOT NULL,
      buyer_name VARCHAR(200) NULL,
      buyer_phone VARCHAR(80) NULL,
      only_paid TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_draw_raffle (raffle_id),
      CONSTRAINT fk_draws_raffle FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureDefaultAdmin(env);
}

async function ensureDefaultAdmin(env) {
  const email = env.ADMIN_EMAIL || "admin@admin.com";
  const pass = env.ADMIN_PASSWORD || "admin123";
  const [[row]] = await query(env, "SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (!row) {
    const hash = await bcrypt.hash(pass, 10);
    await query(env, "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')", [email, hash]);
    console.log(`✅ Admin criado: ${email} (troque a senha no .env)`);
  }
}

module.exports = { ensureSchema };
