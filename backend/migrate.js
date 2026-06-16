/**
 * Migration Script — AI English Speaking Coach Personal Edition
 * 
 * Drops old schema (auth-based multi-user) and creates new schema
 * (single-user personal edition with sessions, vocabulary, drill).
 *
 * Run: node migrate.js
 */

import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const run = async (label, sql) => {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
    throw err;
  }
};

const migrate = async () => {
  console.log('\n═══════════════════════════════════════════');
  console.log('  AI Speaking Coach — Database Migration');
  console.log('═══════════════════════════════════════════\n');

  // ── Step 1: Drop old tables (in dependency order) ───────────────────────
  console.log('Step 1: Dropping old tables...');

  await run('Drop flashcards',    'DROP TABLE IF EXISTS flashcards CASCADE');
  await run('Drop notebook',      'DROP TABLE IF EXISTS notebook CASCADE');
  await run('Drop chat_messages', 'DROP TABLE IF EXISTS chat_messages CASCADE');
  await run('Drop conversations', 'DROP TABLE IF EXISTS conversations CASCADE');
  await run('Drop users',         'DROP TABLE IF EXISTS users CASCADE');

  // Also drop new tables so we can recreate them cleanly
  console.log('\nStep 2: Dropping new tables (clean slate)...');
  await run('Drop session_analysis', 'DROP TABLE IF EXISTS session_analysis CASCADE');
  await run('Drop drill_sessions',   'DROP TABLE IF EXISTS drill_sessions CASCADE');
  await run('Drop chunks',           'DROP TABLE IF EXISTS chunks CASCADE');
  await run('Drop word_usage',       'DROP TABLE IF EXISTS word_usage CASCADE');
  await run('Drop sessions',         'DROP TABLE IF EXISTS sessions CASCADE');

  // ── Step 3: Create new tables ────────────────────────────────────────────
  console.log('\nStep 3: Creating new schema...');

  await run('Create sessions', `
    CREATE TABLE sessions (
      id                SERIAL PRIMARY KEY,
      topic_description TEXT,
      session_type      VARCHAR(20) DEFAULT 'free-talk',
      started_at        TIMESTAMPTZ DEFAULT NOW(),
      ended_at          TIMESTAMPTZ,
      duration_seconds  INTEGER,
      status            VARCHAR(20) DEFAULT 'active'
    )
  `);

  await run('Create chat_messages', `
    CREATE TABLE chat_messages (
      id          SERIAL PRIMARY KEY,
      session_id  INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      sender      VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
      text        TEXT NOT NULL,
      suggestions JSONB,
      timestamp   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await run('Create session_analysis', `
    CREATE TABLE session_analysis (
      id                  SERIAL PRIMARY KEY,
      session_id          INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      fluency_score       INTEGER,
      vocab_range_score   INTEGER,
      grammar_score       INTEGER,
      avg_response_length NUMERIC,
      repeated_words      JSONB,
      error_patterns      JSONB,
      chunks_detected     JSONB,
      active_words_used   JSONB,
      summary             TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await run('Create word_usage', `
    CREATE TABLE word_usage (
      id               SERIAL PRIMARY KEY,
      word             VARCHAR(255) UNIQUE NOT NULL,
      use_count        INTEGER DEFAULT 0,
      first_used_at    TIMESTAMPTZ,
      last_used_at     TIMESTAMPTZ,
      example_sentences JSONB,
      drill_count      INTEGER DEFAULT 0,
      mastered         BOOLEAN DEFAULT FALSE,
      mastered_at      TIMESTAMPTZ
    )
  `);

  await run('Create chunks', `
    CREATE TABLE chunks (
      id                SERIAL PRIMARY KEY,
      chunk             TEXT UNIQUE NOT NULL,
      source_session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      use_count         INTEGER DEFAULT 1,
      first_seen_at     TIMESTAMPTZ DEFAULT NOW(),
      last_used_at      TIMESTAMPTZ DEFAULT NOW(),
      drill_count       INTEGER DEFAULT 0,
      mastered          BOOLEAN DEFAULT FALSE,
      mastered_at       TIMESTAMPTZ
    )
  `);

  await run('Create drill_sessions', `
    CREATE TABLE drill_sessions (
      id                SERIAL PRIMARY KEY,
      target_text       VARCHAR(500) NOT NULL,
      target_type       VARCHAR(10) NOT NULL CHECK (target_type IN ('word', 'chunk')),
      scenario_hint     TEXT,
      started_at        TIMESTAMPTZ DEFAULT NOW(),
      completed_at      TIMESTAMPTZ,
      self_mastered     BOOLEAN DEFAULT FALSE,
      times_target_used INTEGER DEFAULT 0
    )
  `);

  // ── Step 4: Create indexes ────────────────────────────────────────────────
  console.log('\nStep 4: Creating indexes...');

  await run('Index sessions.status',        'CREATE INDEX idx_sessions_status ON sessions(status)');
  await run('Index sessions.started_at',    'CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC)');
  await run('Index chat_messages.session',  'CREATE INDEX idx_chat_messages_session ON chat_messages(session_id)');
  await run('Index word_usage.use_count',   'CREATE INDEX idx_word_usage_count ON word_usage(use_count DESC)');
  await run('Index word_usage.mastered',    'CREATE INDEX idx_word_usage_mastered ON word_usage(mastered)');
  await run('Index chunks.use_count',       'CREATE INDEX idx_chunks_count ON chunks(use_count DESC)');

  // ── Step 5: Verify ────────────────────────────────────────────────────────
  console.log('\nStep 5: Verifying tables...');

  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log('\n  Tables in database:');
  result.rows.forEach(row => console.log(`    • ${row.table_name}`));

  const expectedTables = ['chat_messages', 'chunks', 'drill_sessions', 'session_analysis', 'sessions', 'word_usage'];
  const actualTables = result.rows.map(r => r.table_name);
  const missing = expectedTables.filter(t => !actualTables.includes(t));

  if (missing.length > 0) {
    console.error(`\n  ✗ Missing tables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ Migration complete! All tables ready.');
  console.log('═══════════════════════════════════════════\n');

  await pool.end();
};

migrate().catch(err => {
  console.error('\nMigration failed:', err.message);
  pool.end();
  process.exit(1);
});
