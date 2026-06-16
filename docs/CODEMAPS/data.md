&lt;!-- Generated: 2026-06-17 | Files scanned: 1 | Token estimate: ~450 --&gt;

# Database Schema

## Connection
- Driver: `pg` (node-postgres) Pool
- Config: `DATABASE_URL` env var
- SSL: auto-enabled if URL contains `supabase`, `neon`, or `render`
- Init: `initDb()` runs CREATE TABLE IF NOT EXISTS on startup

## Tables

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### `conversations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | FK → users(id) ON DELETE CASCADE |
| title | VARCHAR(255) | NOT NULL |
| mode | VARCHAR(50) | DEFAULT 'free-talk' |
| details | JSONB | nullable — holds roleplay/topic config |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**mode values:** `'free-talk'` `'roleplay'` `'topic'`

**details JSONB shape (roleplay):**
```json
{ "id": "hotel", "title": "Hotel Check-in", "role": "hotel receptionist",
  "userRole": "guest", "scenario": "...", "taskChecklist": ["...", "..."] }
```
**details JSONB shape (topic):**
```json
{ "id": "travel", "title": "Travel & Exploration",
  "coreVocabulary": ["tourist attraction", ...],
  "vocabularyDetail": [{ "word": "...", "meaning": "..." }] }
```

### `chat_messages`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | FK → users(id) ON DELETE CASCADE |
| conversation_id | INTEGER | FK → conversations(id) ON DELETE CASCADE |
| sender | VARCHAR(10) | CHECK IN ('user', 'ai') |
| text | TEXT | NOT NULL |
| suggestions | JSONB | nullable — AI reply options (short/full/advanced) |
| evaluation | JSONB | nullable — full AI evaluation for user messages |
| timestamp | TIMESTAMPTZ | DEFAULT NOW() |

**evaluation JSONB shape:**
```json
{ "aiResponse": "...", "suggestions": {"short":"","full":"","advanced":""},
  "grammarCorrection": {"hasError":bool,"original":"","corrected":"","explanation":"","rephrasings":[]},
  "pronunciationTips": [{"word":"","ipa":"","tip":""}],
  "roleplayTasks": {"completedIndex": null},
  "topicWordsUsed": [] }
```

### `notebook`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | FK → users(id) ON DELETE CASCADE |
| original | TEXT | NOT NULL |
| corrected | TEXT | nullable |
| explanation | TEXT | nullable |
| ipa | VARCHAR(255) | nullable |
| type | VARCHAR(50) | DEFAULT 'sentence' — `'sentence'` or `'vocabulary'` |
| saved_at | TIMESTAMPTZ | DEFAULT NOW() |

**Unique constraint:** enforced in application via `LOWER(TRIM(original))` check.

### `flashcards`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| user_id | INTEGER | FK → users(id) ON DELETE CASCADE |
| notebook_id | INTEGER | FK → notebook(id) ON DELETE SET NULL |
| front | TEXT | NOT NULL — the corrected sentence/word |
| back | TEXT | NOT NULL — explanation/meaning |
| ipa | VARCHAR(255) | nullable |
| repetitions | INTEGER | DEFAULT 0 |
| interval | INTEGER | DEFAULT 1 (days) |
| ease_factor | NUMERIC(4,2) | DEFAULT 2.50 |
| next_review_date | TIMESTAMPTZ | DEFAULT NOW() |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

## Relationships
```
users (1) ──── (N) conversations
users (1) ──── (N) chat_messages
users (1) ──── (N) notebook
users (1) ──── (N) flashcards
conversations (1) ──── (N) chat_messages  [CASCADE DELETE]
notebook (1) ──── (0..1) flashcards       [SET NULL on notebook delete]
```

## Migrations Applied at Runtime (ALTER TABLE guards)
```sql
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS evaluation JSONB;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE;
```
