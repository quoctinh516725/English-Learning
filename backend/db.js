import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && (connectionString.includes('supabase') || connectionString.includes('neon') || connectionString.includes('render'))
    ? { rejectUnauthorized: false }
    : false
});

export const query = (text, params) => pool.query(text, params);

export const initDb = async () => {
  if (!connectionString) {
    console.warn('WARNING: DATABASE_URL is not defined in .env. Skipping database initialization.');
    return;
  }

  // ── Core session tables ──────────────────────────────────────────────────
  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      topic_description TEXT,
      session_type VARCHAR(20) DEFAULT 'free-talk', -- 'free-talk' | 'drill'
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      duration_seconds INTEGER,
      status VARCHAR(20) DEFAULT 'active'           -- 'active' | 'completed'
    );
  `;

  const createChatMessagesTable = `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
      text TEXT NOT NULL,
      suggestions JSONB,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const createSessionAnalysisTable = `
    CREATE TABLE IF NOT EXISTS session_analysis (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      fluency_score INTEGER,
      vocab_range_score INTEGER,
      grammar_score INTEGER,
      avg_response_length NUMERIC,
      repeated_words JSONB,
      error_patterns JSONB,
      chunks_detected JSONB,
      active_words_used JSONB,
      summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // ── Vocabulary intelligence tables ───────────────────────────────────────
  const createWordUsageTable = `
    CREATE TABLE IF NOT EXISTS word_usage (
      id SERIAL PRIMARY KEY,
      word VARCHAR(255) UNIQUE NOT NULL,
      use_count INTEGER DEFAULT 0,
      first_used_at TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ,
      example_sentences JSONB,
      drill_count INTEGER DEFAULT 0,
      mastered BOOLEAN DEFAULT FALSE,
      mastered_at TIMESTAMPTZ
    );
  `;

  const createChunksTable = `
    CREATE TABLE IF NOT EXISTS chunks (
      id SERIAL PRIMARY KEY,
      chunk TEXT UNIQUE NOT NULL,
      source_session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      use_count INTEGER DEFAULT 1,
      first_seen_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ DEFAULT NOW(),
      drill_count INTEGER DEFAULT 0,
      mastered BOOLEAN DEFAULT FALSE,
      mastered_at TIMESTAMPTZ
    );
  `;

  // ── Drill session tables ─────────────────────────────────────────────────
  const createDrillSessionsTable = `
    CREATE TABLE IF NOT EXISTS drill_sessions (
      id SERIAL PRIMARY KEY,
      target_text VARCHAR(500) NOT NULL,
      target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('word', 'chunk')),
      scenario_hint TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      self_mastered BOOLEAN DEFAULT FALSE,
      times_target_used INTEGER DEFAULT 0
    );
  `;

  try {
    await pool.query(createSessionsTable);
    await pool.query(createChatMessagesTable);
    await pool.query(createSessionAnalysisTable);
    await pool.query(createWordUsageTable);
    await pool.query(createChunksTable);
    await pool.query(createDrillSessionsTable);

    console.log('Database tables initialized successfully.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
};

export default { query, initDb };
