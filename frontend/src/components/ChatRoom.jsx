import React, { useState, useEffect, useRef } from 'react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import SuggestionCards from './SuggestionCards';

export default function ChatRoom({ 
  voiceConfig, 
  setVoiceConfig, 
  contextMode, 
  contextDetails, 
  onNewEvaluation, 
  speak,
  isPlaying,
  onSaveNotify 
}) {
  const { isRecording, transcript, setTranscript, startRecording, stopRecording, supported } = useSpeechRecognition();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [roleplayChecklist, setRoleplayChecklist] = useState([]);
  const [usedTopicWords, setUsedTopicWords] = useState([]);

  const chatEndRef = useRef(null);

  const API_BASE = import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';

  // Khởi tạo phòng chat khi đổi chế độ
  useEffect(() => {
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
        const response = await fetch(`${API_BASE}/api/chat/history`, {
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
  }, [contextMode, contextDetails]);

  // Tự động cuộn xuống cuối ô chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Lắng nghe phím Enter trong ô nhập văn bản
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText, false);
    }
  };

  // Gửi câu thoại lên server để phân tích
  const handleSendMessage = async (textToSend, isVoice = false) => {
    if (!textToSend || textToSend.trim() === '') return;

    // Thêm tin nhắn của user vào chat history
    const userMessage = { sender: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setTranscript('');
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
          contextMode,
          contextDetails: {
            ...contextDetails,
            taskChecklist: roleplayChecklist.map(t => t.text) // Gửi danh sách task gốc
          },
          chatHistory: messages.slice(-10), // Gửi 10 tin nhắn gần nhất
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

  // Xóa sạch hội thoại hiện tại
  const handleClearConversation = async () => {
    const confirmClear = window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện? Hành động này sẽ xóa vĩnh viễn tin nhắn trong hệ thống và không thể hoàn tác.");
    if (!confirmClear) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE}/api/chat/history`, {
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
        onNewEvaluation([]);
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
      startRecording();
    }
  };

  // Theo dõi khi transcript thay đổi từ SpeechRecognition
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // Theo dõi khi người dùng dừng nói thì tự động gửi (Voice-First flow)
  useEffect(() => {
    if (!isRecording && transcript.trim() !== '') {
      handleSendMessage(transcript, true);
    }
  }, [isRecording]);

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
      {/* Chat Header với Điều khiển giọng nói */}
      <div className="chat-header">
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {contextMode === 'roleplay' ? `🏨 Roleplay: ${contextDetails.title}` : contextMode === 'topic' ? `🍎 Topic: ${contextDetails.title}` : '💬 Free Talk'}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            AI Assistant is active
          </span>
        </div>

        {/* Tùy chỉnh giọng đọc trực tiếp ở chat header */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            className="settings-select"
            value={voiceConfig.accent}
            onChange={(e) => setVoiceConfig(prev => ({ ...prev, accent: e.target.value }))}
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
          >
            <option value="en-US">🇺🇸 Anh-Mỹ</option>
            <option value="en-GB">🇬🇧 Anh-Anh</option>
          </select>
          <select 
            className="settings-select"
            value={voiceConfig.gender}
            onChange={(e) => setVoiceConfig(prev => ({ ...prev, gender: e.target.value }))}
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
          >
            <option value="female">👧 Nữ</option>
            <option value="male">👦 Nam</option>
          </select>
          <button 
            className="btn-secondary"
            onClick={() => setVoiceConfig(prev => ({ ...prev, rate: prev.rate === 1.0 ? 0.8 : 1.0 }))}
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
          >
            Speed: {voiceConfig.rate}x
          </button>
          
          <button 
            className="btn-secondary"
            onClick={handleClearConversation}
            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'rgba(244,63,94,0.2)' }}
            title="Dọn dẹp sạch cuộc trò chuyện hiện tại"
          >
            🗑️ Dọn dẹp
          </button>
        </div>
      </div>

      {/* Task Checklist hoặc Topic Words bar (Chỉ hiển thị khi đang trong chế độ tương ứng) */}
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
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Từ vựng chủ đề (Nói để kích hoạt):
          </div>
          <div className="topic-vocab-grid">
            {contextDetails.coreVocabulary.map((word, idx) => {
              const isUsed = usedTopicWords.includes(word);
              return (
                <span key={idx} className={`topic-vocab-chip ${isUsed ? 'used' : ''}`}>
                  {word} {isUsed && '✓'}
                </span>
              );
            })}
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
            title={isRecording ? "Dừng ghi âm và phân tích" : "Bắt đầu ghi âm nói tiếng Anh"}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>

          <button 
            className="btn-neon" 
            style={{ padding: '12px 16px', borderRadius: '12px', minWidth: '50px', height: '50px', justifyContent: 'center' }}
            onClick={() => handleSendMessage(inputText, false)}
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
