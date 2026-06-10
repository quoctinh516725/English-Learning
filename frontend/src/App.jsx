import React, { useState, useEffect } from 'react';
import './App.css';
import ChatRoom from './components/ChatRoom';
import EvaluationBox from './components/EvaluationBox';
import Notebook from './components/Notebook';
import PracticeModes from './components/PracticeModes';
import useSpeechSynthesis from './hooks/useSpeechSynthesis';
import Auth from './components/Auth';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [userEmail, setUserEmail] = useState(localStorage.getItem('auth_user_email'));
  const [activeTab, setActiveTab] = useState('chat'); // chat, notebook, modes
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Trạng thái cho Contextual Modes
  const [contextMode, setContextMode] = useState('free-talk'); // free-talk, roleplay, topic
  const [contextDetails, setContextDetails] = useState({});

  // Cấu hình giọng đọc TTS
  const { speak, stop, isPlaying, voiceConfig, setVoiceConfig } = useSpeechSynthesis();

  // Hàm hiển thị thông báo popup nhanh (Toast Notification)
  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSelectMode = (mode, details) => {
    setContextMode(mode);
    setContextDetails(details);
    showNotification(`Đã chuyển sang chế độ: ${mode === 'free-talk' ? 'Luyện nói tự do' : details.title}`);
    setActiveTab('chat'); // Tự động đưa về phòng chat để luyện tập
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user_email');
    setToken(null);
    setUserEmail(null);
    showNotification("Đã đăng xuất thành công.");
  };

  if (!token) {
    return (
      <Auth 
        onSuccess={(newToken, email) => {
          localStorage.setItem('auth_token', newToken);
          localStorage.setItem('auth_user_email', email);
          setToken(newToken);
          setUserEmail(email);
        }}
        onNotify={showNotification}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className="glass-panel animate-fade-in" 
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '12px 24px',
            borderLeft: '4px solid var(--color-primary)',
            background: 'rgba(15, 23, 42, 0.9)',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Sidebar điều hướng */}
      <aside className="app-sidebar">
        <div>
          <div className="brand-section">
            <div>
              <h1 className="brand-logo">AI English</h1>
              <div className="brand-subtitle">Speaking Coach</div>
            </div>
          </div>

          <nav className="nav-menu">
            <div 
              className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <span className="nav-item-icon">💬</span>
              <span>Phòng hội thoại</span>
            </div>
            
            <div 
              className={`nav-item ${activeTab === 'notebook' ? 'active' : ''}`}
              onClick={() => setActiveTab('notebook')}
            >
              <span className="nav-item-icon">📚</span>
              <span>Sổ tay thông minh</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'modes' ? 'active' : ''}`}
              onClick={() => setActiveTab('modes')}
            >
              <span className="nav-item-icon">🎯</span>
              <span>Chế độ luyện tập</span>
            </div>
          </nav>
        </div>

        {/* Thông tin User & Đăng xuất */}
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tài khoản</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', margin: '6px 0 12px 0' }} title={userEmail}>
            👤 {userEmail}
          </div>
          <button 
            className="btn-secondary"
            onClick={handleLogout}
            style={{ width: '100%', padding: '8px 12px', fontSize: '0.75rem', justifyContent: 'center', borderRadius: '8px' }}
          >
            Đăng xuất
          </button>
        </div>

        {/* Thiết lập giọng đọc AI ở góc Sidebar */}
        <div className="settings-section">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            ⚙ Cấu hình giọng đọc AI
          </div>
          
          <div className="settings-control">
            <label>Accent</label>
            <select 
              className="settings-select"
              value={voiceConfig.accent}
              onChange={(e) => setVoiceConfig(prev => ({ ...prev, accent: e.target.value }))}
            >
              <option value="en-US">🇺🇸 English (US)</option>
              <option value="en-GB">🇬🇧 English (UK)</option>
            </select>
          </div>

          <div className="settings-control">
            <label>Giọng đọc</label>
            <select 
              className="settings-select"
              value={voiceConfig.gender}
              onChange={(e) => setVoiceConfig(prev => ({ ...prev, gender: e.target.value }))}
            >
              <option value="female">👧 Nữ (Female)</option>
              <option value="male">👦 Nam (Male)</option>
            </select>
          </div>

          <div className="settings-control">
            <label>Tốc độ đọc</label>
            <select 
              className="settings-select"
              value={voiceConfig.rate}
              onChange={(e) => setVoiceConfig(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
            >
              <option value="0.8">🐌 Chậm (0.8x)</option>
              <option value="1.0">⚡ Bình thường (1.0x)</option>
            </select>
          </div>
        </div>
      </aside>

      {/* Vùng nội dung chính */}
      <main className="dashboard-content">
        {activeTab === 'chat' && (
          <div className="workspace-panel" style={{ padding: '24px', height: '100%' }}>
            <div className="chat-workspace">
              {/* Phòng chat */}
              <ChatRoom 
                voiceConfig={voiceConfig}
                setVoiceConfig={setVoiceConfig}
                contextMode={contextMode}
                contextDetails={contextDetails}
                onNewEvaluation={setCurrentEvaluation}
                speak={speak}
                isPlaying={isPlaying}
                onSaveNotify={showNotification}
              />
              
              {/* Bảng chẩn đoán phát âm, ngữ pháp */}
              <EvaluationBox 
                evaluation={currentEvaluation}
                onSaveNotify={showNotification}
              />
            </div>
          </div>
        )}

        {activeTab === 'notebook' && (
          <div className="workspace-panel">
            <Notebook 
              onPlayVoice={speak} 
              onSaveNotify={showNotification}
            />
          </div>
        )}

        {activeTab === 'modes' && (
          <div className="workspace-panel">
            <PracticeModes 
              activeMode={contextMode}
              activeDetails={contextDetails}
              onSelectMode={handleSelectMode}
            />
          </div>
        )}
      </main>
    </div>
  );
}
