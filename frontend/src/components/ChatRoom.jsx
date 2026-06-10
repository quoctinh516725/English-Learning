import React, { useState, useEffect, useRef } from 'react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import SuggestionCards from './SuggestionCards';

export default function ChatRoom({ 
  activeConversation,
  onNewEvaluation, 
  speak,
  isPlaying,
  onSaveNotify,
  onToggleDiagnosis
}) {
  const { id: conversationId, mode: contextMode, details: contextDetails = {}, title } = activeConversation || {};

  const { isRecording, transcript, setTranscript, startRecording, stopRecording, supported } = useSpeechRecognition();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [roleplayChecklist, setRoleplayChecklist] = useState([]);
  const [usedTopicWords, setUsedTopicWords] = useState([]);
  const [usedVoice, setUsedVoice] = useState(false);

  const chatEndRef = useRef(null);
  const sendTimeoutRef = useRef(null);
  const cleanTextRef = useRef(null);

  const API_BASE = import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';

  // Khởi tạo phòng chat khi cuộc hội thoại thay đổi
  useEffect(() => {
    if (!conversationId) return;

    setMessages([]);
    onNewEvaluation(null);
    setUsedTopicWords([]);

    let welcomeMsg = "Hello! Let's practice English. Press the microphone to talk to me!";
    
    if (contextMode === 'roleplay') {
      welcomeMsg = `[Roleplay Scenario] Welcome to the ${contextDetails.title}. I am acting as ${contextDetails.role}. Let's begin!`;
      setRoleplayChecklist(
        (contextDetails.taskChecklist || []).map((task, idx) => ({ text: task, done: false, index: idx }))
      );
    } else if (contextMode === 'topic') {
      welcomeMsg = `[Topic Practice] Let's discuss "${contextDetails.title}". Try to use the following words: ${contextDetails.coreVocabulary.join(', ')}.`;
    }

    const loadHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE}/api/chat/history?conversationId=${conversationId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            const mapped = data.map(m => ({
              sender: m.sender,
              text: m.text,
              suggestions: typeof m.suggestions === 'string' ? JSON.parse(m.suggestions) : m.suggestions,
              evaluation: m.evaluation ? (typeof m.evaluation === 'string' ? JSON.parse(m.evaluation) : m.evaluation) : null,
              timestamp: new Date(m.timestamp)
            }));
            setMessages(mapped);
          } else {
            setMessages([{ sender: 'ai', text: welcomeMsg, timestamp: new Date() }]);
            speak(welcomeMsg);
          }
        } else {
          setMessages([{ sender: 'ai', text: welcomeMsg, timestamp: new Date() }]);
          speak(welcomeMsg);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setMessages([{ sender: 'ai', text: welcomeMsg, timestamp: new Date() }]);
        speak(welcomeMsg);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [conversationId, contextMode]);

  // Tự động cuộn xuống cuối ô chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Lắng nghe phím Enter trong ô nhập văn bản
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText, usedVoice);
    }
  };

  // Gửi câu thoại lên server để phân tích
  const handleSendMessage = async (textToSend, isVoice = false) => {
    if (!textToSend || textToSend.trim() === '') return;

    // Tự động dừng ghi âm nếu đang chạy khi tin nhắn được gửi đi
    if (isRecording) {
      stopRecording();
    }

    // Thêm tin nhắn của user vào chat history
    const userMessage = { sender: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setTranscript('');
    setUsedVoice(false);
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userText: textToSend,
          conversationId,
          chatHistory: messages.slice(-5).map(msg => ({ sender: msg.sender, text: msg.text })), // Chỉ gửi text và sender để tối ưu hóa payload
          isVoiceInput: isVoice
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Thêm câu trả lời của AI
        const aiMessage = { 
          sender: 'ai', 
          text: data.aiResponse, 
          suggestions: data.suggestions,
          timestamp: new Date() 
        };
        
        setMessages(prev => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].sender === 'user') {
              next[i] = { ...next[i], evaluation: data };
              break;
            }
          }
          return [...next, aiMessage];
        });

        // Tự động phát âm thanh
        speak(data.aiResponse);

        // Cập nhật Checklist Roleplay nếu hoàn thành nhiệm vụ
        if (contextMode === 'roleplay' && data.roleplayTasks && data.roleplayTasks.completedIndex !== null) {
          const complIndex = data.roleplayTasks.completedIndex;
          setRoleplayChecklist(prev => prev.map(task => 
            task.index === complIndex ? { ...task, done: true } : task
          ));
          onSaveNotify("🎯 Đã hoàn thành một nhiệm vụ đóng vai!");
        }

        // Cập nhật từ vựng Topic nếu được sử dụng
        if (contextMode === 'topic' && data.topicWordsUsed && data.topicWordsUsed.length > 0) {
          setUsedTopicWords(prev => {
            const next = [...new Set([...prev, ...data.topicWordsUsed])];
            if (next.length > prev.length) {
              onSaveNotify("✨ Đã lồng ghép thành công từ vựng chủ đề!");
            }
            return next;
          });
        }

      } else {
        console.error('API Error:', data.error);
        onSaveNotify('Lỗi API: Không thể phân tích câu thoại.');
      }
    } catch (error) {
      console.error('Network error calling backend:', error);
      onSaveNotify('Lỗi mạng: Vui lòng kiểm tra xem server NodeJS đã bật chưa.');
    } finally {
      setLoading(false);
    }
  };

  // Xóa sạch hội thoại hiện tại (Chỉ dọn tin nhắn, giữ nguyên thread ở Sidebar)
  const handleClearConversation = async () => {
    const confirmClear = window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện trong phòng này? Hành động này sẽ xóa vĩnh viễn tin nhắn và không thể hoàn tác.");
    if (!confirmClear) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE}/api/chat/history/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        onSaveNotify("Đã dọn dẹp sạch cuộc hội thoại!");
        
        // Trở về tin nhắn chào mừng mặc định
        let welcomeMsg = "Hello! Let's practice English. Press the microphone to talk to me!";
        if (contextMode === 'roleplay') {
          welcomeMsg = `[Roleplay Scenario] Welcome to the ${contextDetails.title}. I am acting as ${contextDetails.role}. Let's begin!`;
          setRoleplayChecklist(
            (contextDetails.taskChecklist || []).map((task, idx) => ({ text: task, done: false, index: idx }))
          );
        } else if (contextMode === 'topic') {
          welcomeMsg = `[Topic Practice] Let's discuss "${contextDetails.title}". Try to use the following words: ${contextDetails.coreVocabulary.join(', ')}.`;
        }

        setMessages([{ sender: 'ai', text: welcomeMsg, timestamp: new Date() }]);
        onNewEvaluation(null);
        setUsedTopicWords([]);
        speak(welcomeMsg);
      } else {
        onSaveNotify("Lỗi: Không thể xóa cuộc trò chuyện.");
      }
    } catch (err) {
      console.error(err);
      onSaveNotify("Lỗi mạng: Không thể kết nối để xóa cuộc trò chuyện.");
    }
  };

  // Kích hoạt khi bấm giữ hoặc nhấn/thả microphone
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

  // Theo dõi khi transcript thay đổi từ SpeechRecognition (Voice Trigger Sending)
  useEffect(() => {
    if (!transcript) {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
      return;
    }

    setInputText(transcript);

    // Định nghĩa Regex cho 3 cụm từ khóa ở cuối câu:
    // 1. that's all / that is all / that all
    // 2. send it / send
    // 3. I'm done / I am done / done
    const TRIGGER_REGEX = /\b(that(?:'s|s|\s+is)?\s+all|send(?:\s+it)?|(?:i(?:'m|m|\s+am)?\s+)?done)[.?!]*$/i;

    if (TRIGGER_REGEX.test(transcript)) {
      const cleanText = transcript.replace(TRIGGER_REGEX, '').trim();
      cleanTextRef.current = cleanText;

      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }

      console.log(`[VoiceTrigger] Detected trigger word. Clean text: "${cleanText}". Auto-sending in 1.5s...`);

      sendTimeoutRef.current = setTimeout(() => {
        if (cleanTextRef.current) {
          handleSendMessage(cleanTextRef.current, true);
        } else {
          stopRecording();
          setTranscript('');
          setInputText('');
        }
        sendTimeoutRef.current = null;
      }, 1500);
    } else {
      // Nếu đang có timer tự động gửi nhưng người học nói tiếp câu khác, hủy bỏ gửi ngay
      if (sendTimeoutRef.current) {
        console.log('[VoiceTrigger] User continued speaking. Canceling auto-send.');
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
    }
  }, [transcript]);

  // Dọn dẹp timer khi component bị hủy
  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
    };
  }, []);

  // Đồng bộ danh sách chẩn đoán (tối đa 5 cái gần nhất) lên App.jsx
  useEffect(() => {
    const evals = messages
      .filter(m => m.sender === 'user' && m.evaluation)
      .map(m => m.evaluation);
    const last5Evals = evals.slice(-5);
    onNewEvaluation(last5Evals);
  }, [messages]);

  // Điền văn bản gợi ý vào ô nhập liệu
  const handleSelectSuggestion = (text) => {
    setInputText(text);
  };

  // Lấy danh sách suggestions từ tin nhắn cuối cùng của AI
  const getLastAISuggestions = () => {
    const aiMessages = messages.filter(m => m.sender === 'ai');
    if (aiMessages.length === 0) return null;
    return aiMessages[aiMessages.length - 1].suggestions;
  };

  return (
    <div className="chat-section glass-panel">
      {/* Chat Header */}
      <div className="chat-header">
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {contextMode === 'roleplay' ? `🏨 Roleplay: ${contextDetails.title}` : contextMode === 'topic' ? `🍎 Topic: ${contextDetails.title}` : '💬 Free Talk'}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            AI Assistant is active
          </span>
        </div>

        {/* Nút dọn dẹp và nút chẩn đoán */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="diagnosis-toggle-btn btn-secondary"
            onClick={onToggleDiagnosis}
            style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--color-primary)', borderColor: 'rgba(14,165,233,0.2)', borderRadius: '8px', display: 'none' }}
            title="Xem chẩn đoán phát âm & ngữ pháp"
          >
            📊 Chẩn đoán
          </button>

          <button 
            className="btn-secondary"
            onClick={handleClearConversation}
            style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'rgba(244,63,94,0.2)', borderRadius: '8px' }}
            title="Dọn dẹp sạch cuộc trò chuyện hiện tại"
          >
            🗑️ Dọn dẹp
          </button>
        </div>
      </div>

      {/* Task Checklist hoặc Topic Words bar */}
      {contextMode === 'roleplay' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Nhiệm vụ cần hoàn thành:
          </div>
          <div className="checklist-container">
            {roleplayChecklist.map((task) => (
              <div key={task.index} className={`checklist-item ${task.done ? 'done' : ''}`}>
                <div className={`checklist-checkbox ${task.done ? 'checked' : ''}`}>
                  {task.done && '✓'}
                </div>
                <span>{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {contextMode === 'topic' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Từ vựng chủ đề (Hãy sử dụng các từ này trong cuộc nói chuyện):
          </div>
          <div className="topic-vocab-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {contextDetails.vocabularyDetail && contextDetails.vocabularyDetail.length > 0 ? (
              contextDetails.vocabularyDetail.map((item, idx) => {
                const isUsed = usedTopicWords.some(w => w.toLowerCase() === item.word.toLowerCase());
                return (
                  <span 
                    key={idx} 
                    className={`topic-vocab-chip ${isUsed ? 'used' : ''}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      background: isUsed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: isUsed ? '1px solid var(--color-success)' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isUsed ? 'var(--color-success)' : 'var(--text-primary)',
                      transition: 'all 0.3s ease',
                      cursor: 'help'
                    }}
                    title={`Nghĩa: ${item.meaning}`}
                  >
                    <strong>{item.word}</strong> 
                    <span style={{ fontSize: '0.65rem', opacity: 0.75 }}>({item.meaning})</span> 
                    {isUsed && ' ✓'}
                  </span>
                );
              })
            ) : (
              (contextDetails.coreVocabulary || []).map((word, idx) => {
                const isUsed = usedTopicWords.some(w => w.toLowerCase() === word.toLowerCase());
                return (
                  <span 
                    key={idx} 
                    className={`topic-vocab-chip ${isUsed ? 'used' : ''}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      background: isUsed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: isUsed ? '1px solid var(--color-success)' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isUsed ? 'var(--color-success)' : 'var(--text-primary)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {word} {isUsed && ' ✓'}
                  </span>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Message Area */}
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-bubble ${msg.sender}`}>
            <div>{msg.text}</div>
            <div className="message-info">
              <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {msg.sender === 'ai' && (
                <button 
                  className="tts-play-btn" 
                  onClick={() => speak(msg.text)}
                  title="Phát lại giọng nói"
                >
                  🔊
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message-bubble ai" style={{ display: 'flex', gap: '8px', padding: '12px' }}>
            <div className="waveform-container" style={{ width: '40px', height: '20px' }}>
              <div className="waveform-bar" style={{ animationDuration: '0.6s', width: '2px' }}></div>
              <div className="waveform-bar" style={{ animationDuration: '0.6s', width: '2px' }}></div>
              <div className="waveform-bar" style={{ animationDuration: '0.6s', width: '2px' }}></div>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>AI đang phân tích & soạn câu trả lời...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Footer chứa Microphone và gợi ý câu trả lời */}
      <div className="chat-footer">
        {/* Smart response chips */}
        {!loading && messages.length > 1 && (
          <SuggestionCards 
            suggestions={getLastAISuggestions()} 
            onSelect={handleSelectSuggestion} 
          />
        )}

        <div className="input-row">
          <input 
            type="text"
            className="text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Đang thu âm giọng nói của bạn..." : "Nhập văn bản hoặc bấm micro để nói..."}
            disabled={loading}
          />
          
          {/* Animated waveform when recording */}
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
            title={isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm nói tiếng Anh"}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>

          <button 
            className="btn-neon" 
            style={{ padding: '12px 16px', borderRadius: '12px', minWidth: '50px', height: '50px', justifyContent: 'center' }}
            onClick={() => handleSendMessage(inputText, usedVoice)}
            disabled={loading || !inputText.trim()}
            title="Gửi văn bản"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
