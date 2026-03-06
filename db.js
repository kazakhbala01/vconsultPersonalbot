/**
 * PostgreSQL Database Layer
 * Таблицы: users, profiles, documents, conversations
 */

const { Pool } = require("pg");

let pool;

async function init() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      data JSONB NOT NULL DEFAULT '{}',
      settings JSONB NOT NULL DEFAULT '{"format":"pdf"}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      doc_type TEXT NOT NULL,
      title TEXT,
      number TEXT,
      doc_date TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);

    CREATE TABLE IF NOT EXISTS conversations (
      user_id BIGINT PRIMARY KEY,
      history JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("✅ PostgreSQL подключён");
}

// ═══ Профили ═══

async function getProfile(userId) {
  const r = await pool.query("SELECT data FROM profiles WHERE user_id=$1", [userId]);
  return r.rows[0]?.data || null;
}

async function saveProfile(userId, data, username, firstName) {
  await pool.query(`
    INSERT INTO profiles (user_id, username, first_name, data, updated_at)
    VALUES ($1,$2,$3,$4,NOW())
    ON CONFLICT (user_id) DO UPDATE SET data=$4, username=$2, first_name=$3, updated_at=NOW()
  `, [userId, username || "", firstName || "", data]);
}

async function deleteProfile(userId) {
  await pool.query("DELETE FROM profiles WHERE user_id=$1", [userId]);
}

// ═══ Настройки ═══

async function getSettings(userId) {
  const r = await pool.query("SELECT settings FROM profiles WHERE user_id=$1", [userId]);
  return r.rows[0]?.settings || { format: "pdf" };
}

async function saveSetting(userId, key, value) {
  await pool.query(`
    INSERT INTO profiles (user_id, settings) VALUES ($1, jsonb_build_object($2::text, to_jsonb($3::text)))
    ON CONFLICT (user_id) DO UPDATE SET settings = profiles.settings || jsonb_build_object($2::text, to_jsonb($3::text)), updated_at=NOW()
  `, [userId, key, value]);
}

// ═══ Документы ═══

async function saveDocument(userId, docData) {
  const r = await pool.query(`
    INSERT INTO documents (user_id, doc_type, title, number, doc_date, data)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [userId, docData.type || "custom", docData.title || "", docData.number || "", docData.date || "", docData]);
  return r.rows[0].id;
}

async function getDocuments(userId, filters = {}) {
  let q = "SELECT id, doc_type, title, number, doc_date, created_at FROM documents WHERE user_id=$1";
  const params = [userId];

  if (filters.type) {
    params.push(filters.type);
    q += ` AND doc_type=$${params.length}`;
  }
  if (filters.from) {
    params.push(filters.from);
    q += ` AND created_at >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    q += ` AND created_at <= $${params.length}`;
  }

  q += " ORDER BY created_at DESC LIMIT 20";
  const r = await pool.query(q, params);
  return r.rows;
}

async function getDocumentById(id) {
  const r = await pool.query("SELECT * FROM documents WHERE id=$1", [id]);
  return r.rows[0] || null;
}

async function getDocCount(userId) {
  const r = await pool.query("SELECT COUNT(*) as cnt FROM documents WHERE user_id=$1", [userId]);
  return parseInt(r.rows[0].cnt);
}

async function getNextNumber(userId, docType) {
  const r = await pool.query(
    "SELECT COUNT(*) as cnt FROM documents WHERE user_id=$1 AND doc_type=$2",
    [userId, docType]
  );
  return parseInt(r.rows[0].cnt) + 1;
}

// ═══ Диалоги (оптимизированные) ═══

async function getHistory(userId) {
  const r = await pool.query("SELECT history FROM conversations WHERE user_id=$1", [userId]);
  return r.rows[0]?.history || [];
}

async function saveHistory(userId, history) {
  await pool.query(`
    INSERT INTO conversations (user_id, history, updated_at) VALUES ($1,$2,NOW())
    ON CONFLICT (user_id) DO UPDATE SET history=$2, updated_at=NOW()
  `, [userId, JSON.stringify(history)]);
}

async function clearHistory(userId) {
  await pool.query("DELETE FROM conversations WHERE user_id=$1", [userId]);
}

// Очистка старых диалогов (>2ч)
async function cleanupConversations() {
  await pool.query("DELETE FROM conversations WHERE updated_at < NOW() - INTERVAL '2 hours'");
}

async function close() {
  if (pool) await pool.end();
}

module.exports = {
  init, close,
  getProfile, saveProfile, deleteProfile,
  getSettings, saveSetting,
  saveDocument, getDocuments, getDocumentById, getDocCount, getNextNumber,
  getHistory, saveHistory, clearHistory, cleanupConversations,
};
