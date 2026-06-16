const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';

const headers = () => ({ 'Content-Type': 'application/json' });

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
};

// ── Sessions ────────────────────────────────────────────────────────────────
export const getSessions = () =>
  fetch(`${API_BASE}/api/sessions`).then(handleResponse);

export const createSession = (topic_description, session_type = 'free-talk') =>
  fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ topic_description, session_type })
  }).then(handleResponse);

export const deleteSession = (id) =>
  fetch(`${API_BASE}/api/sessions/${id}`, { method: 'DELETE' }).then(handleResponse);

export const endSession = (id) =>
  fetch(`${API_BASE}/api/sessions/${id}/end`, { method: 'POST', headers: headers() }).then(handleResponse);

export const getSessionReport = (id) =>
  fetch(`${API_BASE}/api/sessions/${id}/report`).then(handleResponse);

// ── Chat ────────────────────────────────────────────────────────────────────
export const getChatHistory = (sessionId) =>
  fetch(`${API_BASE}/api/chat/history?sessionId=${sessionId}`).then(handleResponse);

export const sendChat = (payload) =>
  fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload)
  }).then(handleResponse);

// ── Vocabulary ───────────────────────────────────────────────────────────────
export const getVocabulary = () =>
  fetch(`${API_BASE}/api/vocabulary`).then(handleResponse);

export const addVocabulary = (word) =>
  fetch(`${API_BASE}/api/vocabulary`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ word })
  }).then(handleResponse);

export const deleteVocabulary = (id) =>
  fetch(`${API_BASE}/api/vocabulary/${id}`, { method: 'DELETE' }).then(handleResponse);

export const getChunks = () =>
  fetch(`${API_BASE}/api/chunks`).then(handleResponse);

export const addChunk = (chunk) =>
  fetch(`${API_BASE}/api/chunks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ chunk })
  }).then(handleResponse);

export const deleteChunk = (id) =>
  fetch(`${API_BASE}/api/chunks/${id}`, { method: 'DELETE' }).then(handleResponse);

export const getDailyMission = () =>
  fetch(`${API_BASE}/api/missions/today`).then(handleResponse);

// ── Drill ────────────────────────────────────────────────────────────────────
export const startDrill = (target, type = 'word') =>
  fetch(`${API_BASE}/api/drill/start`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ target, type })
  }).then(handleResponse);

export const completeDrill = (id, payload) =>
  fetch(`${API_BASE}/api/drill/${id}/complete`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload)
  }).then(handleResponse);

// ── Progress ─────────────────────────────────────────────────────────────────
export const getProgressSummary = () =>
  fetch(`${API_BASE}/api/progress/summary`).then(handleResponse);

export const getErrorPatterns = () =>
  fetch(`${API_BASE}/api/progress/errors`).then(handleResponse);

export const getProgressSessions = () =>
  fetch(`${API_BASE}/api/progress/sessions`).then(handleResponse);

// ── TTS Helper ────────────────────────────────────────────────────────────────
export const getTTSUrl = (text, rate = '1.0') =>
  `${API_BASE}/api/tts?text=${encodeURIComponent(text)}&rate=${rate}`;

// Legacy default export for backward compat during migration
const db = {
  getSessions, createSession, deleteSession, endSession, getSessionReport,
  getChatHistory, sendChat,
  getVocabulary, addVocabulary, deleteVocabulary,
  getChunks, addChunk, deleteChunk,
  getDailyMission,
  startDrill, completeDrill,
  getProgressSummary, getErrorPatterns, getProgressSessions,
  getTTSUrl
};

export default db;
