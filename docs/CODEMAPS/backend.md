&lt;!-- Generated: 2026-06-17 | Files scanned: 2 | Token estimate: ~550 --&gt;

# Backend Architecture

## Entry Point
`backend/index.js` (822 lines) — Express app, all routes inline (no router separation)

## Middleware Chain
```
app.use(cors())
app.use(express.json())
authenticateToken(req, res, next)  ← JWT verification, applied per-route
```

## API Routes

### Auth
| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | `/api/auth/register` | inline | bcrypt salt=10, INSERT users |
| POST | `/api/auth/login` | inline | bcrypt compare, JWT sign 7d |
| GET | `/api/auth/me` | inline | returns req.user from token |

### Conversations
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/conversations` | ✓ | ORDER BY created_at DESC |
| POST | `/api/conversations` | ✓ | body: `{title, mode, details}` |
| DELETE | `/api/conversations/:id` | ✓ | CASCADE deletes chat_messages |

### Chat
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/chat/history` | ✓ | query: `?conversationId=` LIMIT 50 |
| DELETE | `/api/chat/history/:conversationId` | ✓ | clears messages only |
| POST | `/api/chat` | ✓ | main AI endpoint (see below) |

### Text-to-Speech
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/tts` | ✗ | query: `?text=&rate=` → MP3 stream |

### Notebook & Flashcards
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/notebook` | ✓ | ORDER BY saved_at DESC |
| POST | `/api/notebook` | ✓ | duplicate check (LOWER TRIM), auto-creates flashcard |
| DELETE | `/api/notebook/:id` | ✓ | cascade removes linked flashcard |
| GET | `/api/flashcards/due` | ✓ | WHERE next_review_date <= NOW() |
| POST | `/api/flashcards/review` | ✓ | body: `{cardId, grade}` SM-2 algorithm |

## Key Business Logic

### POST /api/chat — AI Pipeline
```
1. Verify conversationId belongs to user
2. Build system prompt (mode-aware: free-talk / roleplay / topic)
3. Round-robin Groq model: llama-3.1-8b → qwen3-32b → compound-mini
4. 30s AbortController timeout per model attempt
5. Parse JSON response via cleanAndParseJSON()
6. Strip pronunciationTips if isVoiceInput=false
7. INSERT user message + AI message to chat_messages
8. Return evaluation JSON to frontend
   → Falls back to getMockResponse() on any failure
```

### SM-2 Spaced Repetition (POST /api/flashcards/review)
```
easeFactor += 0.1 - (5-grade) * (0.08 + (5-grade) * 0.02)  min=1.3
grade < 3  → repetitions=0, interval=1
rep=0 → interval=1d; rep=1 → 3d; rep=2 → 7d; rep>2 → interval*EF
```

## Key Files
| File | Purpose | Size |
|------|---------|------|
| `backend/index.js` | All routes + business logic | 822 lines |
| `backend/db.js` | Pool config + initDb() schema bootstrap | 111 lines |
| `backend/.env` | `DATABASE_URL`, `GROQ_API_KEY`, `JWT_SECRET`, `PORT` | - |

## Helper Functions (backend/index.js)
- `authenticateToken(req, res, next)` — JWT middleware (line 31)
- `cleanAndParseJSON(text)` — strips markdown fences, extracts JSON (line 683)
- `getMockResponse(userText, mode, details)` — fallback AI response (line 706)
- `formatRate(rate)` — converts 1.0→"+0%" for edge-tts (line 474)
