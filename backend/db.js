import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

// Cấu hình SSL nếu kết nối tới Supabase Cloud
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

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createNotebookTable = `
    CREATE TABLE IF NOT EXISTS notebook (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      original TEXT NOT NULL,
      corrected TEXT,
      explanation TEXT,
      ipa VARCHAR(255),
      type VARCHAR(50) DEFAULT 'sentence',
      saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createFlashcardsTable = `
    CREATE TABLE IF NOT EXISTS flashcards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      notebook_id INTEGER REFERENCES notebook(id) ON DELETE SET NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      ipa VARCHAR(255),
      repetitions INTEGER DEFAULT 0,
      interval INTEGER DEFAULT 1,
      ease_factor NUMERIC(4,2) DEFAULT 2.50,
      next_review_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createConversationsTable = `
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      mode VARCHAR(50) DEFAULT 'free-talk',
      details JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createChatMessagesTable = `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
      text TEXT NOT NULL,
      suggestions JSONB,
      evaluation JSONB,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createUsersTable);
    await pool.query(createConversationsTable);
    await pool.query(createNotebookTable);
    await pool.query(createFlashcardsTable);
    await pool.query(createChatMessagesTable);
    
    // Đảm bảo cột evaluation tồn tại nếu bảng đã được tạo trước đó
    await pool.query('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS evaluation JSONB;');

    // Đảm bảo cột conversation_id tồn tại để lưu trữ nhiều phòng chat độc lập
    await pool.query('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE;');
    
    console.log('Database tables initialized successfully.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
};

export default {
  query,
  initDb
};
