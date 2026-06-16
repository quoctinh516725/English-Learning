import React, { useState, useEffect } from 'react';
import { getVocabulary, getChunks, addVocabulary, deleteVocabulary, addChunk, deleteChunk, getDailyMission } from '../services/db';

export default function VocabularyTracker({ onStartDrill, showNotification }) {
  const [activeSubTab, setActiveSubTab] = useState('words'); // 'words' | 'chunks'
  const [words, setWords] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [dailyMission, setDailyMission] = useState([]);
  
  const [newWord, setNewWord] = useState('');
  const [newChunk, setNewChunk] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'mastered' | 'unmastered' | 'passive'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vData, cData, mData] = await Promise.all([
        getVocabulary(),
        getChunks(),
        getDailyMission().catch(() => [])
      ]);
      setWords(vData || []);
      setChunks(cData || []);
      setDailyMission(mData || []);
    } catch (err) {
      console.error('Failed to load vocabulary data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    try {
      await addVocabulary(newWord.trim());
      setNewWord('');
      showNotification('Added word to your library!');
      fetchData();
    } catch (err) {
      showNotification('Failed to add word.');
    }
  };

  const handleAddChunk = async (e) => {
    e.preventDefault();
    if (!newChunk.trim()) return;
    try {
      await addChunk(newChunk.trim());
      setNewChunk('');
      showNotification('Added chunk to your library!');
      fetchData();
    } catch (err) {
      showNotification('Failed to add chunk.');
    }
  };

  const handleDeleteWord = async (id, wordText) => {
    if (!window.confirm(`Are you sure you want to delete "${wordText}" from your library?`)) return;
    try {
      await deleteVocabulary(id);
      showNotification('Deleted word.');
      fetchData();
    } catch (err) {
      showNotification('Failed to delete word.');
    }
  };

  const handleDeleteChunk = async (id, chunkText) => {
    if (!window.confirm(`Are you sure you want to delete "${chunkText}"?`)) return;
    try {
      await deleteChunk(id);
      showNotification('Deleted chunk.');
      fetchData();
    } catch (err) {
      showNotification('Failed to delete chunk.');
    }
  };

  // Filter items
  const filteredWords = words.filter(w => {
    const matchesSearch = w.word.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === 'mastered') return w.mastered;
    if (filterType === 'unmastered') return !w.mastered;
    if (filterType === 'passive') return !w.mastered && w.use_count <= 2;
    return true;
  });

  const filteredChunks = chunks.filter(c => {
    const matchesSearch = c.chunk.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === 'mastered') return c.mastered;
    if (filterType === 'unmastered') return !c.mastered;
    if (filterType === 'passive') return !c.mastered && c.use_count <= 2;
    return true;
  });

  // Stats
  const totalWords = words.length;
  const masteredWords = words.filter(w => w.mastered).length;
  const totalChunks = chunks.length;
  const masteredChunks = chunks.filter(c => c.mastered).length;

  return (
    <div className="vocab-tracker animate-fade-in">
      {/* Header Stats */}
      <div className="vocab-stats-grid">
        <div className="vocab-stat-card glass-panel">
          <div className="stat-icon">🔤</div>
          <div className="stat-info">
            <span className="stat-label">Words Collected</span>
            <span className="stat-value">{totalWords}</span>
            <span className="stat-sub">{masteredWords} mastered</span>
          </div>
          {totalWords > 0 && (
            <div className="stat-progress-bar">
              <div 
                className="stat-progress-fill fill-primary" 
                style={{ width: `${(masteredWords / totalWords) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="vocab-stat-card glass-panel">
          <div className="stat-icon">🧩</div>
          <div className="stat-info">
            <span className="stat-label">Chunks Collected</span>
            <span className="stat-value">{totalChunks}</span>
            <span className="stat-sub">{masteredChunks} mastered</span>
          </div>
          {totalChunks > 0 && (
            <div className="stat-progress-bar">
              <div 
                className="stat-progress-fill fill-secondary" 
                style={{ width: `${(masteredChunks / totalChunks) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Daily Target Section */}
      {dailyMission.length > 0 && activeSubTab === 'words' && (
        <div className="glass-panel daily-mission-box" style={{ marginBottom: '24px', padding: '18px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎯</span> Recommended Words to Activate Today
          </h4>
          <div className="mission-words-list" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {dailyMission.map((m, idx) => (
              <div key={idx} className="mission-word-item" style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.word}</span>
                <span className="badge-secondary" style={{ fontSize: '0.7rem' }}>used {m.use_count}x</span>
                <button 
                  className="btn-neon" 
                  style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                  onClick={() => onStartDrill(m.word, 'word')}
                >
                  Drill 🎯
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Panel Controls */}
      <div className="vocab-controls glass-panel">
        <div className="vocab-sub-tabs">
          <button 
            className={`vocab-sub-tab ${activeSubTab === 'words' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('words'); setFilterType('all'); }}
          >
            🔤 Words
          </button>
          <button 
            className={`vocab-sub-tab ${activeSubTab === 'chunks' ? 'active' : ''}`}
            onClick={() => { setActiveSubTab('chunks'); setFilterType('all'); }}
          >
            🧩 Chunks
          </button>
        </div>

        {/* Add custom forms */}
        <div className="vocab-add-section">
          {activeSubTab === 'words' ? (
            <form onSubmit={handleAddWord} className="add-vocab-form">
              <input
                type="text"
                className="text-input"
                placeholder="Add custom word to practice..."
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
              />
              <button type="submit" className="btn-neon" style={{ minWidth: '42px', height: '42px', borderRadius: '10px', padding: 0, justifyContent: 'center' }}>+</button>
            </form>
          ) : (
            <form onSubmit={handleAddChunk} className="add-vocab-form">
              <input
                type="text"
                className="text-input"
                placeholder="Add custom chunk to practice (e.g. build confidence)..."
                value={newChunk}
                onChange={e => setNewChunk(e.target.value)}
              />
              <button type="submit" className="btn-neon" style={{ minWidth: '42px', height: '42px', borderRadius: '10px', padding: 0, justifyContent: 'center' }}>+</button>
            </form>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="vocab-filter-row">
          <input
            type="text"
            className="text-input search-input"
            placeholder={`Search ${activeSubTab}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />

          <select 
            className="text-input filter-select"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ maxWidth: '160px' }}
          >
            <option value="all">All Items</option>
            <option value="mastered">Mastered</option>
            <option value="unmastered">Unmastered</option>
            <option value="passive">Passive (Used ≤ 2x)</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <span className="loader">Loading your library...</span>
        </div>
      ) : (
        <div className="vocab-grid">
          {activeSubTab === 'words' ? (
            filteredWords.length > 0 ? (
              filteredWords.map(w => (
                <div key={w.id} className={`vocab-card glass-panel ${w.mastered ? 'mastered' : ''}`}>
                  <div className="vocab-card-header">
                    <span className="vocab-text">{w.word}</span>
                    <span className={`vocab-badge ${w.mastered ? 'mastered' : 'unmastered'}`}>
                      {w.mastered ? 'Mastered ✔' : 'Learning'}
                    </span>
                  </div>
                  <div className="vocab-card-body">
                    <div className="vocab-stat">
                      <span className="stat-label">Use count:</span>
                      <span className="stat-num">{w.use_count} times</span>
                    </div>
                    <div className="vocab-stat">
                      <span className="stat-label">Drilled:</span>
                      <span className="stat-num">{w.drill_count} times</span>
                    </div>
                  </div>
                  <div className="vocab-card-actions">
                    <button 
                      className="btn-neon btn-card-action"
                      onClick={() => onStartDrill(w.word, 'word')}
                    >
                      🎯 Practice
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDeleteWord(w.id, w.word)}
                      title="Delete word"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-vocab-msg">
                No words found matching the filter. Add some custom words above or start speaking sessions to collect them!
              </div>
            )
          ) : (
            filteredChunks.length > 0 ? (
              filteredChunks.map(c => (
                <div key={c.id} className={`vocab-card glass-panel ${c.mastered ? 'mastered' : ''}`}>
                  <div className="vocab-card-header">
                    <span className="vocab-text">{c.chunk}</span>
                    <span className={`vocab-badge ${c.mastered ? 'mastered' : 'unmastered'}`}>
                      {c.mastered ? 'Mastered ✔' : 'Learning'}
                    </span>
                  </div>
                  <div className="vocab-card-body">
                    <div className="vocab-stat">
                      <span className="stat-label">Use count:</span>
                      <span className="stat-num">{c.use_count} times</span>
                    </div>
                    <div className="vocab-stat">
                      <span className="stat-label">Drilled:</span>
                      <span className="stat-num">{c.drill_count} times</span>
                    </div>
                  </div>
                  <div className="vocab-card-actions">
                    <button 
                      className="btn-neon btn-card-action"
                      onClick={() => onStartDrill(c.chunk, 'chunk')}
                    >
                      🎯 Practice
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDeleteChunk(c.id, c.chunk)}
                      title="Delete chunk"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-vocab-msg">
                No chunks found matching the filter. Chunks are automatically captured from your speaking practice!
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
