&lt;!-- Generated: 2026-06-17 | Files scanned: 2 | Token estimate: ~380 --&gt;

# Dependencies & Integrations

## Backend (`backend/package.json`)
| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.21.1 | HTTP server & routing |
| `cors` | ^2.8.5 | Cross-origin request headers |
| `dotenv` | ^16.4.5 | `.env` loader |
| `pg` | ^8.21.0 | PostgreSQL client (node-postgres Pool) |
| `bcryptjs` | ^3.0.3 | Password hashing (salt rounds = 10) |
| `jsonwebtoken` | ^9.0.3 | JWT sign/verify (HS256, 7d expiry) |
| `@google/generative-ai` | ^0.21.0 | Installed but **not used** (Groq via raw fetch instead) |
| `edge-tts-universal` | ^1.4.0 | Microsoft Edge TTS streaming (en-US-GuyNeural) |
| `nodemon` | ^3.1.7 | Dev: auto-reload on file changes |

**Runtime:** `"type": "module"` — ESM (`import/export`), no CommonJS

## Frontend (`frontend/package.json`)
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2.6 | UI framework |
| `react-dom` | ^19.2.6 | DOM renderer |
| `vite` | ^8.0.12 | Build tool & dev server |
| `@vitejs/plugin-react` | ^6.0.1 | Vite React transform (Babel) |
| `eslint` | ^10.3.0 | Linter |
| `eslint-plugin-react-hooks` | ^7.1.1 | Hooks rules enforcement |
| `eslint-plugin-react-refresh` | ^0.5.2 | HMR safety |

**No third-party UI component library** — all components are hand-written.

## External APIs & Services
| Service | Usage | Auth |
|---------|-------|------|
| **Groq API** | LLM inference for chat evaluation | `GROQ_API_KEY` header |
| **Groq Models** | Round-robin: `llama-3.1-8b-instant`, `qwen/qwen3-32b`, `groq/compound-mini` | Same key |
| **Microsoft Edge TTS** | Speech synthesis via `edge-tts-universal` | No key (free) |
| **Supabase PostgreSQL** | Cloud database hosting | `DATABASE_URL` connection string |
| **Web Speech API** | Browser-native STT (`window.SpeechRecognition`) | No key (browser) |

## Environment Variables
### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...  # Supabase connection string
GROQ_API_KEY=gsk_...           # Groq API key
JWT_SECRET=...                 # JWT signing secret
PORT=5000                      # Optional, defaults to 5000
```

### Frontend (`frontend/.env`)
```
VITE_BACBKEND_URL=http://localhost:5000  # Note: typo 'BACBKEND' (not 'BACKEND')
```
> ⚠️ The env var key has a typo: `VITE_BACBKEND_URL` — used consistently across all frontend files.

## Dev Scripts
| Context | Command | Action |
|---------|---------|--------|
| Backend | `npm run dev` | nodemon index.js |
| Backend | `npm start` | node index.js |
| Frontend | `npm run dev` | vite dev server |
| Frontend | `npm run build` | vite build |
| Frontend | `npm run lint` | eslint . |
