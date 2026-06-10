// Dịch vụ đồng bộ dữ liệu với Backend (Supabase PostgreSQL Cloud DB)
// Đọc token xác thực JWT từ localStorage để đính kèm vào header Authorization

const getToken = () => localStorage.getItem('auth_token');

const getHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const API_BASE = import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';

export const db = {
  // --- Notebook Operations (Cloud DB) ---
  async getNotebook() {
    try {
      const response = await fetch(`${API_BASE}/api/notebook`, {
        headers: getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch notebook.');
      return await response.json();
    } catch (e) {
      console.error('Error fetching notebook:', e);
      return [];
    }
  },

  async saveToNotebook(item) {
    try {
      const response = await fetch(`${API_BASE}/api/notebook`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(item)
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Save to notebook error:', errorData.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error saving to notebook:', e);
      return false;
    }
  },

  async removeFromNotebook(id) {
    try {
      const response = await fetch(`${API_BASE}/api/notebook/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!response.ok) throw new Error('Failed to remove from notebook.');
      return true;
    } catch (e) {
      console.error('Error removing from notebook:', e);
      return false;
    }
  },

  // --- Flashcard Operations (Cloud DB & SM-2) ---
  async getDueFlashcards() {
    try {
      const response = await fetch(`${API_BASE}/api/flashcards/due`, {
        headers: getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch due flashcards.');
      return await response.json();
    } catch (e) {
      console.error('Error fetching due flashcards:', e);
      return [];
    }
  },

  async updateFlashcardSchedule(cardId, grade) {
    try {
      const response = await fetch(`${API_BASE}/api/flashcards/review`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ cardId, grade })
      });
      if (!response.ok) throw new Error('Failed to update review progress.');
      return await response.json();
    } catch (e) {
      console.error('Error updating flashcard schedule:', e);
      return null;
    }
  }
};
