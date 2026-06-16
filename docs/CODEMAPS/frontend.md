&lt;!-- Generated: 2026-06-17 | Files scanned: 12 | Token estimate: ~700 --&gt;

# Frontend Architecture

## Entry Point
`frontend/src/main.jsx` → `<App />` wrapped in `<StrictMode>`

## Page / View Tree
```
App.jsx  (root state: token, conversations, activeTab, evaluation)
├── Auth.jsx           (renders when !token — login/register form)
└── [Authenticated Layout]
    ├── <aside> app-sidebar
    │   ├── Brand logo
    │   ├── New Chat button
    │   ├── Nav tabs (chat | notebook | modes)
    │   ├── Conversation history list
    │   └── User info + Logout
    └── <main> dashboard-content
        ├── [activeTab=chat]
        │   ├── ChatRoom.jsx          (message thread + voice input)
        │   └── EvaluationBox.jsx     (diagnosis sidebar, slide-in on mobile)
        ├── [activeTab=notebook]
        │   └── Notebook.jsx
        │       └── ShadowingCard.jsx (flashcard review session)
        └── [activeTab=modes]
            └── PracticeModes.jsx     (mode/scenario selector grid)
```

## Component Inventory
| Component | File | Props In | Key State |
|-----------|------|----------|-----------|
| `App` | App.jsx (342L) | - | token, conversations, activeTab, currentEvaluation, isDiagnosisOpen |
| `Auth` | Auth.jsx (178L) | onSuccess, onNotify | isLogin, email, password, loading, error |
| `ChatRoom` | ChatRoom.jsx (523L) | activeConversation, onNewEvaluation, speak, isPlaying, onSaveNotify, onToggleDiagnosis | messages, inputText, loading, roleplayChecklist, usedTopicWords |
| `EvaluationBox` | EvaluationBox.jsx (247L) | evaluation[], onSaveNotify, onClose | currentIndex, selectedWord |
| `Notebook` | Notebook.jsx (227L) | onPlayVoice, onSaveNotify | items, dueCards, isReviewing, currentReviewIndex |
| `ShadowingCard` | ShadowingCard.jsx (170L) | card, onPlayVoice, onComplete | score, matchingWords, hasPracticed |
| `PracticeModes` | PracticeModes.jsx (264L) | activeMode, activeDetails, onSelectMode | - (stateless) |
| `SuggestionCards` | SuggestionCards.jsx (small) | suggestions, onSelect | - (stateless) |

## State Management Flow
```
App.jsx (owns auth + conversation state)
  │
  ├── token ─────────────────────────── guards Auth/Main split
  ├── conversations[] ────────────────── list from GET /api/conversations
  ├── activeConversationId ───────────── passed to ChatRoom as activeConversation
  ├── currentEvaluation ─────────────── set by ChatRoom, read by EvaluationBox
  ├── isDiagnosisOpen ───────────────── mobile sidebar toggle
  └── isSidebarOpen ─────────────────── mobile nav sidebar toggle

ChatRoom.jsx (owns message + voice state)
  ├── messages[] ─────── append-only, loaded from /api/chat/history
  ├── inputText ──────── controlled text input + transcript sync
  ├── loading ────────── disables inputs during API call
  ├── roleplayChecklist[] ─ updated on roleplayTasks.completedIndex
  └── usedTopicWords[] ─── updated on topicWordsUsed response
```

## Custom Hooks
| Hook | File | Purpose | Key API |
|------|------|---------|---------|
| `useSpeechRecognition` | hooks/useSpeechRecognition.js (146L) | Web Speech API wrapper, continuous mode, auto-restart on silence, overlap dedup | `isRecording, transcript, startRecording, stopRecording, supported` |
| `useSpeechSynthesis` | hooks/useSpeechSynthesis.js (69L) | Fetches `/api/tts` and plays MP3 via `new Audio()` | `speak(text), stop(), isPlaying, voiceConfig` |

## Voice Trigger System (ChatRoom)
```
transcript changes
  └─► TRIGGER_REGEX test: /\b(that's all|send it|done|send)\b/i
        → strip trigger words → auto-send after 1500ms delay
        → user continues speaking → cancel timer
```

## Services Layer
`frontend/src/services/db.js` — API client singleton `db`
```
db.getNotebook()           → GET  /api/notebook
db.saveToNotebook(item)    → POST /api/notebook
db.removeFromNotebook(id)  → DELETE /api/notebook/:id
db.getDueFlashcards()      → GET  /api/flashcards/due
db.updateFlashcardSchedule(cardId, grade) → POST /api/flashcards/review
db.getConversations()      → GET  /api/conversations
db.createConversation()    → POST /api/conversations
db.deleteConversation(id)  → DELETE /api/conversations/:id
```
All methods attach `Authorization: Bearer <token>` from `localStorage`.

## Practice Modes (Static Data in PracticeModes.jsx)
- **Free Talk** — open-ended conversation
- **Roleplay** (3 scenarios): Hotel Check-in, Job Interview, Coffee Shop Order
- **Topic** (8 topics): Travel, Workplace, Food, Entertainment, Health, Shopping, Tech, Traffic
  - Each topic has 8 core vocabulary words with Vietnamese meanings

## Styling
- `frontend/src/index.css` — CSS custom properties (design tokens), global resets
- `frontend/src/App.css` — component-specific styles (18KB)
- No CSS framework — vanilla CSS with CSS variables
- Dark mode only; uses `--bg-main`, `--color-primary` (#0ea5e9), `--color-accent` (#8b5cf6)
