&lt;!-- Generated: 2026-06-17 | Files scanned: 17 | Token estimate: ~600 --&gt;

# System Architecture

## Project Type
Full-stack monorepo — React SPA (frontend) + Express REST API (backend)

## Services
| Service | Stack | Port | Entry |
|---------|-------|------|-------|
| Frontend | React 19 + Vite 8 | 5173 (dev) | `frontend/src/main.jsx` |
| Backend | Node.js 20 + Express 4 | 5000 | `backend/index.js` |
| Database | PostgreSQL (Supabase Cloud) | cloud | `backend/db.js` |

## High-Level Data Flow

```
Browser (User)
  │
  ├─[Voice Input]──► Web Speech API (browser-native)
  │                      │
  │                      ▼
  ├─[Text/Voice]──► POST /api/chat ──► Groq LLM API (external)
  │                      │                 (llama-3.1-8b / qwen3-32b / compound-mini)
  │                      │             fallback round-robin
  │                      ▼
  │              PostgreSQL (Supabase)
  │              chat_messages, conversations
  │
  ├─[TTS Request]─► GET /api/tts ──► edge-tts-universal (en-US-GuyNeural)
  │                      │
  │                      ▼
  │              Audio stream (MP3 chunks)
  │
  └─[Notebook/Flashcard]─► CRUD /api/notebook, /api/flashcards
                              │
                              ▼
                        PostgreSQL (notebook, flashcards)
                        SM-2 spaced-repetition algorithm
```

## Auth Flow
```
POST /api/auth/register  →  bcrypt hash  →  INSERT users
POST /api/auth/login     →  bcrypt compare  →  JWT (7d expiry)
All protected routes     →  authenticateToken middleware  →  req.user
```

## Deployment Notes
- Frontend: Static SPA, deploy to Vercel/Netlify
- Backend: Node.js server, deploy to Render/Railway
- DB: Supabase PostgreSQL (SSL required for cloud connections)
- Env vars: `GROQ_API_KEY`, `DATABASE_URL`, `JWT_SECRET`, `PORT` (backend); `VITE_BACBKEND_URL` (frontend, note: typo in original env key)
