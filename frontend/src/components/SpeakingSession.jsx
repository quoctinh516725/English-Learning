import React, { useState, useEffect, useRef } from 'react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { getDailyMission, addVocabulary, addChunk } from '../services/db';

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';

// Suggestion chips below the input
function SuggestionChips({ suggestions, onSelect }) {
  if (!suggestions) return null;
  const chips = [
    { label: 'Short', text: suggestions.short },
    { label: 'Full', text: suggestions.full },
    { label: 'Advanced', text: suggestions.advanced },
  ].filter(c => c.text);

  if (chips.length === 0) return null;

  return (
    <div className="suggestion-chips">
      {chips.map((chip, i) => (
        <button
          key={i}
          className="suggestion-chip"
          onClick={() => onSelect(chip.text)}
          title={chip.text}
        >
          <span className="chip-label">{chip.label}</span>
          <span className="chip-text">{chip.text}</span>
        </button>
      ))}
    </div>
  );
}

// Spotted Item tag component for active manual saving
function SpottedItemCard({ item, showNotification }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    try {
      if (item.type === 'chunk') {
        await addChunk(item.text);
      } else {
        await addVocabulary(item.text);
      }
      setSaved(true);
      showNotification(`Saved ${item.type}: "${item.text}"`);
    } catch (err) {
      console.error(err);
      showNotification(`Failed to save ${item.type}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button 
      className={`spotted-item-tag ${saved ? 'saved' : ''} ${item.type}`}
      onClick={handleSave}
      disabled={saving}
      title={saved ? 'Already in your library' : `Click to save this ${item.type}`}
    >
      <span className="item-icon">{item.type === 'chunk' ? '🧩' : '🔤'}</span>
      <span className="item-text">{item.text}</span>
      {item.meaning && <span className="item-meaning">({item.meaning})</span>}
      <span className="item-action-icon">{saved ? '✓ Saved' : '➕'}</span>
    </button>
  );
}

// ── Session Start Screen ───────────────────────────────────────────────────
function SessionStartScreen({ onStart }) {
  const [topic, setTopic] = useState('');

  const handleStart = () => {
    if (topic.trim()) onStart(topic.trim());
  };

  const quickTopics = [
    'My work and current projects',
    'My gym routine and fitness goals',
    'Something I learned this week',
    'A challenge I\'m facing right now',
    'My plans for this weekend',
  ];

  return (
    <div className="session-start-screen">
      <div className="session-start-card glass-panel">
        <div className="session-start-icon">🎙️</div>
        <h2 className="session-start-title">What do you want to talk about today?</h2>
        <p className="session-start-sub">Describe your topic in a few words — AI will guide the conversation.</p>

        <input
          type="text"
          className="text-input session-topic-input"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder="e.g. I want to talk about my React project..."
          autoFocus
        />

        <div className="quick-topics">
          {quickTopics.map((t, i) => (
            <button key={i} className="quick-topic-chip" onClick={() => onStart(t)}>
              {t}
            </button>
          ))}
        </div>

        <button
          className="btn-neon session-start-btn"
          onClick={handleStart}
          disabled={!topic.trim()}
        >
          Start Speaking Session →
        </button>
      </div>
    </div>
  );
}

// ── Main SpeakingSession Component ────────────────────────────────────────
export default function SpeakingSession({ onSessionEnd, onNewSession }) {
  const [phase, setPhase] = useState('start'); // 'start' | 'active' | 'ended'
  const [sessionId, setSessionId] = useState(null);
  const [topicDescription, setTopicDescription] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const [missionWords, setMissionWords] = useState([]);
  const [usedMissionWords, setUsedMissionWords] = useState({});

  const { isRecording, transcript, setTranscript, startRecording, stopRecording } = useSpeechRecognition();

  const chatEndRef = useRef(null);
  const sendTimeoutRef = useRef(null);
  const cleanTextRef = useRef(null);
  const [usedVoice, setUsedVoice] = useState(false);

  useEffect(() => {
    getDailyMission().then(data => {
      setMissionWords(data || []);
    }).catch(err => console.error('Failed to load daily mission:', err));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Voice trigger auto-send
  useEffect(() => {
    if (!transcript) {
      if (sendTimeoutRef.current) { clearTimeout(sendTimeoutRef.current); sendTimeoutRef.current = null; }
      return;
    }
    setInputText(transcript);

    const TRIGGER_REGEX = /\b(that(?:'s|s|\s+is)?\s+all|send(?:\s+it)?|(?:i(?:'m|m|\s+am)?\s+)?done)[.?!]*$/i;
    if (TRIGGER_REGEX.test(transcript)) {
      const cleanText = transcript.replace(TRIGGER_REGEX, '').trim();
      cleanTextRef.current = cleanText;
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = setTimeout(() => {
        if (cleanTextRef.current) handleSendMessage(cleanTextRef.current, true);
        else { stopRecording(); setTranscript(''); setInputText(''); }
        sendTimeoutRef.current = null;
      }, 1500);
    } else {
      if (sendTimeoutRef.current) { clearTimeout(sendTimeoutRef.current); sendTimeoutRef.current = null; }
    }
  }, [transcript]);

  useEffect(() => () => { if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current); }, []);

  // Start a new session
  const handleStartSession = async (topic) => {
    setTopicDescription(topic);
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_description: topic, session_type: 'free-talk' })
      });
      const data = await resp.json();
      setSessionId(data.id);
      setPhase('active');

      // Welcome message
      const welcome = {
        sender: 'ai',
        text: `Great! Let's talk about: "${topic}". I'm ready. Press the microphone and start speaking whenever you like!`,
        timestamp: new Date()
      };
      setMessages([welcome]);
    } catch (e) {
      console.error('Failed to start session:', e);
    } finally {
      setLoading(false);
    }
  };

  // Send message to AI
  const handleSendMessage = async (textToSend, isVoice = false) => {
    if (!textToSend || !textToSend.trim() || !sessionId) return;
    if (isRecording) stopRecording();

    // Check if user used any mission words
    missionWords.forEach(m => {
      const cleanText = textToSend.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const cleanTarget = m.word.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      if (cleanText.includes(cleanTarget) && !usedMissionWords[m.word]) {
        setUsedMissionWords(prev => ({ ...prev, [m.word]: true }));
      }
    });

    const userMsg = { sender: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setTranscript('');
    setUsedVoice(false);
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: textToSend,
          sessionId,
          sessionType: 'free-talk',
          topicDescription,
          chatHistory: messages.slice(-12).map(m => ({ sender: m.sender, text: m.text })),
          isVoiceInput: isVoice
        })
      });

      const data = await resp.json();

      const aiMsg = {
        sender: 'ai',
        text: data.aiResponse,
        suggestions: data.suggestions,
        grammarNote: data.grammarNote,
        spottedItems: data.spottedItems || [],
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);

      // Speak the AI response
      if (data.aiResponse) {
        const audio = new Audio(`${API_BASE}/api/tts?text=${encodeURIComponent(data.aiResponse)}&rate=1.0`);
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.error('Chat error:', e);
    } finally {
      setLoading(false);
    }
  };

  // End session — trigger analysis
  const handleEndSession = async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    try {
      const resp = await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await resp.json();
      setPhase('ended');
      onSessionEnd && onSessionEnd(sessionId, data.analysis);
    } catch (e) {
      console.error('Error ending session:', e);
    } finally {
      setIsEnding(false);
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setInputText('');
      setTranscript('');
      setUsedVoice(true);
      startRecording();
    }
  };

  const getLastAISuggestions = () => {
    const aiMsgs = messages.filter(m => m.sender === 'ai');
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1].suggestions : null;
  };

  const highlightMissionWords = (text, wordsList) => {
    if (!wordsList || wordsList.length === 0) return text;
    const escWords = wordsList.map(w => w.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
    if (!escWords) return text;
    const regex = new RegExp(`\\b(${escWords})\\b`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, idx) => 
          regex.test(part) ? <strong key={idx} className="highlighted-target-word">{part}</strong> : part
        )}
      </>
    );
  };

  // ── Render: Start Screen ─────────────────────────────────────────────────
  if (phase === 'start') {
    return <SessionStartScreen onStart={handleStartSession} />;
  }

  // ── Render: Active Session ────────────────────────────────────────────────
  return (
    <div className="speaking-session glass-panel">
      {/* Header */}
      <div className="session-header">
        <div>
          <h3 className="session-title">🎙️ Speaking Session</h3>
          <span className="session-topic-badge">{topicDescription}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn-secondary"
            onClick={() => { setPhase('start'); setMessages([]); setSessionId(null); }}
            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
          >
            ← New Topic
          </button>
          <button
            className="btn-end-session"
            onClick={handleEndSession}
            disabled={isEnding || messages.filter(m => m.sender === 'user').length === 0}
          >
            {isEnding ? 'Analyzing...' : '⏹ End Session'}
          </button>
        </div>
      </div>

      {/* Mission Bar */}
      {missionWords.length > 0 && (
        <div className="daily-mission-bar">
          <span className="mission-bar-title">🎯 Today's Mission (Use these words):</span>
          <div className="mission-chips">
            {missionWords.map((m, i) => {
              const wasUsed = usedMissionWords[m.word];
              return (
                <span key={i} className={`mission-word-chip ${wasUsed ? 'activated' : ''}`}>
                  {m.word} {wasUsed ? '✓' : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {notification && (
        <div className="chunk-toast animate-fade-in">
          {notification}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-bubble ${msg.sender}`}>
            <div className="message-text">
              {msg.sender === 'user' ? highlightMissionWords(msg.text, missionWords) : msg.text}
            </div>

            {/* Grammar note for user messages */}
            {msg.sender === 'ai' && msg.grammarNote?.hasError && (
              <div className="grammar-note">
                <span className="grammar-note-icon">✏️</span>
                <span className="grammar-correction">{msg.grammarNote.correction}</span>
                <span className="grammar-explanation"> — {msg.grammarNote.note}</span>
              </div>
            )}

            {msg.sender === 'ai' && msg.spottedItems && msg.spottedItems.length > 0 && (
              <div className="spotted-items-container">
                <span className="spotted-items-title">💡 Save vocabulary & chunks:</span>
                <div className="spotted-items-list">
                  {msg.spottedItems.map((item, itemIdx) => (
                    <SpottedItemCard key={itemIdx} item={item} showNotification={showNotification} />
                  ))}
                </div>
              </div>
            )}

            <div className="message-meta">
              <span>{msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {msg.sender === 'ai' && (
                <button
                  className="tts-play-btn"
                  onClick={() => {
                    const audio = new Audio(`${API_BASE}/api/tts?text=${encodeURIComponent(msg.text)}`);
                    audio.play().catch(() => {});
                  }}
                  title="Replay"
                >🔊</button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-bubble ai loading-bubble">
            <div className="waveform-container" style={{ width: '40px', height: '20px' }}>
              <div className="waveform-bar" style={{ animationDuration: '0.6s', width: '2px' }}></div>
              <div className="waveform-bar" style={{ animationDuration: '0.8s', width: '2px' }}></div>
              <div className="waveform-bar" style={{ animationDuration: '0.6s', width: '2px' }}></div>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>AI is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Footer */}
      <div className="chat-footer">
        {!loading && messages.length > 1 && (
          <SuggestionChips suggestions={getLastAISuggestions()} onSelect={t => setInputText(t)} />
        )}

        <div className="input-row">
          <input
            type="text"
            className="text-input"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(inputText, usedVoice); } }}
            placeholder={isRecording ? 'Listening...' : 'Type or press mic to speak...'}
            disabled={loading}
          />

          {isRecording && (
            <div className="waveform-container">
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
            </div>
          )}

          <button
            className={`record-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleToggleRecord}
            disabled={loading}
            title={isRecording ? 'Stop recording' : 'Start speaking'}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>

          <button
            className="btn-neon"
            style={{ padding: '12px 16px', borderRadius: '12px', minWidth: '50px', height: '50px', justifyContent: 'center' }}
            onClick={() => handleSendMessage(inputText, usedVoice)}
            disabled={loading || !inputText.trim()}
            title="Send"
          >➤</button>
        </div>
      </div>
    </div>
  );
}
