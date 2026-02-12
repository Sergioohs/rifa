const mysql = require("mysql2/promise");

let pool;

async function getPool(env) {
  if (pool) return pool;
  pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

async function query(env, sql, params = []) {
  const p = await getPool(env);
  return p.execute(sql, params);
}

module.exports = { getPool, query };
