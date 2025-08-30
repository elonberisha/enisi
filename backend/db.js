import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;

let dbInstance = null; // Postgres only now

function transformPlaceholders(query, params) {
  // Convert SQLite style ? placeholders to $1, $2 ... for Postgres
  let idx = 0;
  const transformed = query.replace(/\?/g, () => {
    idx += 1;
    return '$' + idx;
  });
  return { text: transformed, params };
}

function adaptQueryForPostgres(q) {
  let query = q;
  // Replace datetime('now') with NOW()
  query = query.replace(/datetime\('now'\)/gi, 'NOW()');
  // INSERT OR IGNORE -> ON CONFLICT DO NOTHING (simple patterns)
  if (/INSERT OR IGNORE INTO sectors \(name\) VALUES \(\?\)/i.test(query)) {
    query = query.replace(/INSERT OR IGNORE/i, 'INSERT').replace(/\)$/, ') ON CONFLICT (name) DO NOTHING');
  }
  // Generic INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING (cannot guess constraint; leave as-is if uncertain)
  query = query.replace(/INSERT OR IGNORE/gi, 'INSERT');
  return query;
}

async function initPostgres() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Basic connectivity check
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  const db = {
    engine: 'postgres',
    async run(rawQuery, params = []) {
      let query = adaptQueryForPostgres(rawQuery);
      // Add RETURNING id for plain INSERT statements without it so we can emulate lastID
      const isInsert = /^\s*INSERT\s+/i.test(query);
      const hasReturning = /RETURNING\s+/i.test(query);
      if (isInsert && !hasReturning && !/ON CONFLICT DO NOTHING$/i.test(query)) {
        query += ' RETURNING id';
      }
      const { text, params: p } = transformPlaceholders(query, params);
      let res;
      try {
        res = await pool.query(text, p);
      } catch (e) {
        console.error('[DB RUN ERROR]', { query: text, params: p, code: e.code, message: e.message });
        throw e;
      }
      const lastID = isInsert ? (res.rows[0]?.id || null) : undefined;
      // emulate sqlite .changes using rowCount
      return { lastID, changes: res.rowCount };
    },
    async get(rawQuery, params = []) {
      let query = adaptQueryForPostgres(rawQuery);
      const { text, params: p } = transformPlaceholders(query, params);
      let res; try { res = await pool.query(text, p); } catch(e){ console.error('[DB GET ERROR]', { query: text, params: p, code: e.code, message: e.message }); throw e; }
      return res.rows[0] || undefined;
    },
    async all(rawQuery, params = []) {
      let query = adaptQueryForPostgres(rawQuery);
      const { text, params: p } = transformPlaceholders(query, params);
      let res; try { res = await pool.query(text, p); } catch(e){ console.error('[DB ALL ERROR]', { query: text, params: p, code: e.code, message: e.message }); throw e; }
      return res.rows;
    },
    async exec(rawMulti) {
      // Split on semicolons (simple); skip empty
      const statements = rawMulti.split(/;\s*/).map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await this.run(stmt);
      }
    }
  };

  await ensureSchema(db);
  return db;
}

async function ensureSchema(db) {
  // Postgres DDL only (SQLite removed)
    // Postgres DDL
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sectors (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_by TEXT
      );
      CREATE TABLE IF NOT EXISTS workers (
        id SERIAL PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        position TEXT,
        hourly_rate REAL,
        sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by TEXT
      );
      CREATE TABLE IF NOT EXISTS work_hours (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
        date TEXT,
        hours REAL,
        created_by TEXT
      );
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
        date TEXT,
        amount REAL,
        type TEXT,
        created_by TEXT
      );
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        approved INTEGER DEFAULT 1,
        provider TEXT,
        display_name TEXT,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_ip TEXT,
        last_login_ip TEXT
      );
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        transports TEXT,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity TEXT,
        entity_id INTEGER,
        action TEXT,
        username TEXT,
        info TEXT,
        ts TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_worker_name_sector ON workers(first_name, last_name, sector_id);
    `);
    // Admin bootstrap (shto admin nëse tabela është bosh)
    const userCount = await db.get('SELECT COUNT(*) as c FROM users');
    if (!userCount || userCount.c === 0) {
      const hash = await bcrypt.hash('admin', 10);
      await db.run("INSERT INTO users (username, password, approved, role, provider) VALUES (?, ?, 1, 'admin', 'local')", ['admin', hash]);
    }
}

export async function initDb() {
  if (dbInstance) return dbInstance;
  if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL (PostgreSQL)');
  dbInstance = await initPostgres();
  console.log('[DB] Connected to PostgreSQL (SQLite removed)');
  return dbInstance;
}

export function getDb() { return dbInstance; }
