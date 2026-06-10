import React, { useState, useEffect } from 'react';
import './App.css';
import ChatRoom from './components/ChatRoom';
import EvaluationBox from './components/EvaluationBox';
import Notebook from './components/Notebook';
import PracticeModes from './components/PracticeModes';
import useSpeechSynthesis from './hooks/useSpeechSynthesis';
import Auth from './components/Auth';
import { db } from './services/db';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [userEmail, setUserEmail] = useState(localStorage.getItem('auth_user_email'));
  const [activeTab, setActiveTab] = useState('chat'); // chat, notebook, modes
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Trạng thái cho Conversations (ChatGPT-like)
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // Cấu hình giọng đọc TTS (Giọng nam chuẩn en-US-GuyNeural cố định ở backend)
  const { speak, stop, isPlaying } = useSpeechSynthesis();

  // Hàm hiển thị thông báo popup nhanh (Toast Notification)
  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const loadConversations = async () => {
    const list = await db.getConversations();
    setConversations(list);
    if (list.length > 0) {
      setActiveConversationId(list[0].id);
    } else {
      // Tự động tạo cuộc trò chuyện đầu tiên nếu chưa có gì
      const title = `Free Talk - ${new Date().toLocaleDateString('vi-VN')}`;
      const newConv = await db.createConversation(title, 'free-talk', {});
      if (newConv) {
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    }
  };

  useEffect(() => {
    if (token) {
      loadConversations();
    }
  }, [token]);

  const handleNewChat = async () => {
    const title = `Free Talk - ${new Date().toLocaleDateString('vi-VN')}`;
    const newConv = await db.createConversation(title, 'free-talk', {});
    if (newConv) {
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setActiveTab('chat');
      showNotification("Đã tạo cuộc trò chuyện tự do mới.");
    }
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    const confirmDelete = window.confirm("Bạn có chắc chắn muốn xóa cuộc hội thoại này?");
    if (!confirmDelete) return;

    const success = await db.deleteConversation(convId);
    if (success) {
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        const remaining = conversations.filter(c => c.id !== convId);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          setActiveConversationId(null);
        }
      }
      showNotification("Đã xóa cuộc hội thoại thành công.");
    }
  };

  const handleSelectMode = async (mode, details) => {
    const title = mode === 'roleplay' ? `🏨 Roleplay: ${details.title}` : `🍎 Topic: ${details.title}`;
    const newConv = await db.createConversation(title, mode, details);
    if (newConv) {
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      showNotification(`Đã mở khung chat riêng cho chế độ: ${details.title}`);
      setActiveTab('chat');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user_email');
    setToken(null);
    setUserEmail(null);
    setConversations([]);
    setActiveConversationId(null);
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
      <aside className="app-sidebar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="brand-section">
            <div>
              <h1 className="brand-logo">AI English</h1>
              <div className="brand-subtitle">Speaking Coach</div>
            </div>
          </div>

          {/* Nút tạo Chat mới */}
          <div style={{ padding: '0 16px', marginBottom: '16px' }}>
            <button 
              className="btn-neon" 
              onClick={handleNewChat}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', justifyContent: 'center', fontSize: '0.85rem' }}
            >
              ＋ New Chat
            </button>
          </div>

          <nav className="nav-menu" style={{ marginBottom: '16px' }}>
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

          {/* Lịch sử hội thoại */}
          <div style={{ padding: '0 16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '150px', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: 'bold' }}>
              Lịch sử hội thoại
            </div>
            <div className="conversations-list" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {conversations.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px' }}>Chưa có hội thoại nào</div>
              ) : (
                conversations.map(conv => (
                  <div 
                    key={conv.id}
                    className={`nav-item ${activeConversationId === conv.id && activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setActiveTab('chat');
                    }}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: activeConversationId === conv.id && activeTab === 'chat' ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: activeConversationId === conv.id && activeTab === 'chat' ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent'
                    }}
                  >
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginRight: '8px' }} title={conv.title}>
                      💬 {conv.title.length > 18 ? conv.title.substring(0, 18) + '...' : conv.title}
                    </span>
                    <button 
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px', display: 'flex', alignItems: 'center' }}
                      title="Xóa cuộc hội thoại"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Thông tin User & Đăng xuất nằm ở dưới cùng */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tài khoản</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', margin: '4px 0 10px 0' }} title={userEmail}>
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
        </div>
      </aside>

      {/* Vùng nội dung chính */}
      <main className="dashboard-content">
        {activeTab === 'chat' && (
          <div className="workspace-panel" style={{ padding: '24px', height: '100%' }}>
            <div className="chat-workspace">
              {/* Phòng chat */}
              {activeConversationId ? (
                <ChatRoom 
                  activeConversation={conversations.find(c => c.id === activeConversationId)}
                  onNewEvaluation={setCurrentEvaluation}
                  speak={speak}
                  isPlaying={isPlaying}
                  onSaveNotify={showNotification}
                />
              ) : (
                <div className="glass-panel chat-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Vui lòng tạo hoặc chọn một cuộc hội thoại từ Sidebar để bắt đầu.
                </div>
              )}
              
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
              activeMode={null}
              activeDetails={{}}
              onSelectMode={handleSelectMode}
            />
          </div>
        )}
      </main>
    </div>
  );
}
