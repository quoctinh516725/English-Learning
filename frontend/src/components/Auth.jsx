import React, { useState } from 'react';

export default function Auth({ onSuccess, onNotify }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    const API_BASE = import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';
    const url = isLogin 
      ? `${API_BASE}/api/auth/login` 
      : `${API_BASE}/api/auth/register`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          onNotify("Đăng nhập thành công! Chào mừng quay trở lại.");
          onSuccess(data.token, data.user.email);
        } else {
          onNotify("Đăng ký thành công! Hãy đăng nhập để bắt đầu.");
          setIsLogin(true);
          setPassword('');
        }
      } else {
        setError(data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Auth request error:', err);
      setError('Lỗi kết nối đến server. Hãy chắc chắn backend đã được khởi chạy.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.2) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%)'
      }}
    >
      <div 
        className="glass-panel animate-fade-in" 
        style={{
          width: '400px',
          padding: '40px',
          boxShadow: 'var(--glass-shadow)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 
            style={{ 
              fontSize: '2rem', 
              fontWeight: 800, 
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            AI English Coach
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
            {isLogin ? 'Đăng nhập để tiếp tục luyện giao tiếp' : 'Đăng ký tài khoản luyện nói tiếng Anh'}
          </p>
        </div>

        {error && (
          <div 
            style={{
              background: 'var(--color-danger-glow)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '20px',
              textAlign: 'center'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="settings-control">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Địa chỉ Email</label>
            <input 
              type="email"
              className="text-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              disabled={loading}
              style={{ marginTop: '4px' }}
            />
          </div>

          <div className="settings-control">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mật khẩu</label>
            <input 
              type="password"
              className="text-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              style={{ marginTop: '4px' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn-neon" 
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              padding: '14px', 
              marginTop: '10px',
              fontSize: '0.95rem' 
            }}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          </span>
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            disabled={loading}
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}
