import React, { useState, useEffect, useRef } from 'react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { completeDrill, sendChat, getTTSUrl, addVocabulary, addChunk } from '../services/db';

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';

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

export default function DrillSession({ drillConfig, onEndDrill, showNotification }) {
  const { drillId, sessionId, target, type, scenarioHint } = drillConfig;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetCount, setTargetCount] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);

  const { isRecording, transcript, setTranscript, startRecording, stopRecording } = useSpeechRecognition();
  
  const chatEndRef = useRef(null);
  const sendTimeoutRef = useRef(null);
  const cleanTextRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Welcome message with scenario context
  useEffect(() => {
    const welcomeText = `Hello! We are drilling the ${type}: "${target}".\n\nContext: ${scenarioHint || 'Talk naturally.'}\n\nI will guide the conversation without using the target word. Start speaking when you're ready!`;
    setMessages([
      {
        sender: 'ai',
        text: welcomeText,
        timestamp: new Date()
      }
    ]);

    // Speak the welcome
    const audio = new Audio(getTTSUrl(`Welcome. Let's practice using the expression ${target}. ${scenarioHint || ''}`));
    audio.play().catch(() => {});
  }, [drillId]);

  // Helper to check target usage
  const checkTargetUsed = (text, targetStr) => {
    const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const cleanTarget = targetStr.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    
    if (cleanText.includes(cleanTarget)) return true;
    
    // Stem variations
    if (cleanTarget.endsWith('y')) {
      const stem = cleanTarget.slice(0, -1);
      if (cleanText.includes(stem + 'ie') || cleanText.includes(stem + 'y')) return true;
    }
    if (cleanTarget.endsWith('e')) {
      const stem = cleanTarget.slice(0, -1);
      if (cleanText.includes(stem + 'ing') || cleanText.includes(stem + 'ed')) return true;
    }
    if (cleanText.includes(cleanTarget + 's') || cleanText.includes(cleanTarget + 'es')) return true;
    
    return false;
  };

  // Helper to highlight target word in User messages
  const highlightTarget = (text, targetStr) => {
    if (!targetStr) return text;
    const cleanTarget = targetStr.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    
    // Break target into words to make matches more flexible
    const regex = new RegExp(`(${cleanTarget}[a-z]*|${cleanTarget.replace(/\s+/g, '[a-z]*\\s+')}[a-z]*)`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, idx) => 
          regex.test(part) ? <strong key={idx} className="highlighted-target-word">{part}</strong> : part
        )}
      </>
    );
  };

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

  const handleSendMessage = async (textToSend, isVoice = false) => {
    if (!textToSend || !textToSend.trim() || !sessionId) return;
    if (isRecording) stopRecording();

    // Check if target was used
    const wasUsed = checkTargetUsed(textToSend, target);
    if (wasUsed) {
      setTargetCount(prev => prev + 1);
      showNotification(`✨ Target used! Well done!`);
    }

    const userMsg = { sender: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setTranscript('');
    setUsedVoice(false);
    setLoading(true);

    try {
      const data = await sendChat({
        userText: textToSend,
        sessionId,
        sessionType: 'drill',
        topicDescription: `Drill: ${target}`,
        chatHistory: messages.slice(-12).map(m => ({ sender: m.sender, text: m.text })),
        isVoiceInput: isVoice,
        drillTarget: { text: target, type }
      });

      const aiMsg = {
        sender: 'ai',
        text: data.aiResponse,
        suggestions: data.suggestions,
        spottedItems: data.spottedItems || [],
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);

      // Speak responses
      if (data.aiResponse) {
        const audio = new Audio(getTTSUrl(data.aiResponse));
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.error('Drill chat error:', e);
    } finally {
      setLoading(false);
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

  const handleCompleteDrill = async (selfRated) => {
    setLoading(true);
    if (selfRated) {
      setCelebrate(true);
      const audio = new Audio(getTTSUrl("Fantastic! You have mastered this word. Keep it up!"));
      audio.play().catch(() => {});
      // Wait for celebration animation
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    
    try {
      await completeDrill(drillId, {
        selfRated,
        timesUsed: targetCount,
        target,
        type
      });
      showNotification(selfRated ? `🎉 "${target}" marked as Mastered!` : 'Drill session ended.');
      onEndDrill();
    } catch (err) {
      console.error('Error completing drill:', err);
      onEndDrill();
    } finally {
      setLoading(false);
      setCelebrate(false);
    }
  };

  const getLastAISuggestions = () => {
    const aiMsgs = messages.filter(m => m.sender === 'ai');
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1].suggestions : null;
  };

  return (
    <div className="drill-session-wrapper">
      {celebrate && (
        <div className="celebration-overlay animate-fade-in">
          <div className="celebration-box glass-panel">
            <span className="celebration-emoji">🎉</span>
            <h3>Word Mastered!</h3>
            <p>You practiced "{target}" and declared mastery. Excellent work!</p>
          </div>
        </div>
      )}

      <div className="speaking-session drill-session glass-panel">
        {/* Header */}
        <div className="session-header drill-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="session-title-icon">🎯</span>
              <h3 className="session-title">Vocabulary Drill</h3>
            </div>
            <span className="drill-target-badge">{target}</span>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className={`drill-counter-pill ${targetCount > 0 ? 'used' : ''}`}>
              Used: <strong>{targetCount} times</strong>
            </div>

            <button
              className="btn-secondary"
              onClick={() => handleCompleteDrill(false)}
              disabled={loading}
            >
              Skip
            </button>

            <button
              className="btn-neon"
              onClick={() => handleCompleteDrill(true)}
              disabled={loading || targetCount === 0}
              title="Click when you feel confident using this word"
            >
              ✅ I feel confident
            </button>
          </div>
        </div>

        {/* Message Panel */}
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-bubble ${msg.sender}`}>
              <div className="message-text">
                {msg.sender === 'user' ? highlightTarget(msg.text, target) : msg.text}
              </div>

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
                      const audio = new Audio(getTTSUrl(msg.text));
                      audio.play().catch(() => {});
                    }}
                    title="Replay"
                  >🔊</button>
                )}
              </div>
            </div>
          ))}

          {loading && !celebrate && (
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
            <div className="suggestion-chips">
              {getLastAISuggestions() && [
                { label: 'Short', text: getLastAISuggestions().short },
                { label: 'Full', text: getLastAISuggestions().full },
                { label: 'Advanced', text: getLastAISuggestions().advanced },
              ].filter(c => c.text).map((chip, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => setInputText(chip.text)}
                  title={chip.text}
                >
                  <span className="chip-label">{chip.label}</span>
                  <span className="chip-text">{chip.text}</span>
                </button>
              ))}
            </div>
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
    </div>
  );
}
