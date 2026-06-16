import React, { useState } from 'react';
import './App.css';
import SpeakingSession from './components/SpeakingSession';
import SessionReport from './components/SessionReport';
import VocabularyTracker from './components/VocabularyTracker';
import DrillSession from './components/DrillSession';
import ProgressDashboard from './components/ProgressDashboard';
import { startDrill } from './services/db';

// ── App Root ───────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('speak'); // 'speak' | 'vocabulary' | 'progress'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Session report state
  const [sessionReport, setSessionReport] = useState(null);
  const [reportSessionId, setReportSessionId] = useState(null);
  const [speakKey, setSpeakKey] = useState(0); // force remount SpeakingSession
  const [activeDrill, setActiveDrill] = useState(null);

  const handleStartDrill = async (target, type) => {
    try {
      showToast(`Starting drill for: "${target}"...`);
      const config = await startDrill(target, type);
      setActiveDrill(config);
    } catch (err) {
      console.error('Failed to start drill:', err);
      showToast('Failed to start drill session.');
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSessionEnd = (sessionId, analysis) => {
    setReportSessionId(sessionId);
    setSessionReport(analysis);
  };

  const handleStartNew = () => {
    setSessionReport(null);
    setReportSessionId(null);
    setSpeakKey(k => k + 1); // remount SpeakingSession to reset state
    setActiveTab('speak');
  };

  const tabs = [
    { id: 'speak', icon: '🎙️', label: 'Speak' },
    { id: 'vocabulary', icon: '📚', label: 'Vocabulary' },
    { id: 'progress', icon: '📊', label: 'Progress' },
  ];

  return (
    <div className="app-container">
      {/* Toast */}
      {toastMessage && (
        <div className="glass-panel animate-fade-in" style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '12px 24px',
          borderLeft: '4px solid var(--color-primary)',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Session Report overlay */}
      {sessionReport && (
        <SessionReport
          analysis={sessionReport}
          sessionId={reportSessionId}
          onStartNew={handleStartNew}
          onClose={() => setSessionReport(null)}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar ${isSidebarOpen ? 'open' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        <div className="brand-section">
          <h1 className="brand-logo">AI English</h1>
          <div className="brand-subtitle">Speaking Gym · Personal</div>
        </div>

        <nav className="nav-menu" style={{ flex: 1 }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setIsSidebarOpen(false); }}
            >
              <span className="nav-item-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{
            padding: '12px', background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px', border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Speaking Gym
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
              Personal edition — no account needed.
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-content">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title="Toggle sidebar"
        >
          {isSidebarOpen ? '✕' : '☰'}
        </button>

        {isSidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
        )}

        {activeDrill ? (
          <div className="workspace-panel" style={{ padding: '24px', height: '100%', overflow: 'hidden' }}>
            <DrillSession
              drillConfig={activeDrill}
              onEndDrill={() => { setActiveDrill(null); setActiveTab('vocabulary'); }}
              showNotification={showToast}
            />
          </div>
        ) : (
          <>
            {activeTab === 'speak' && (
              <div className="workspace-panel" style={{ padding: '24px', height: '100%', overflow: 'hidden' }}>
                <SpeakingSession
                  key={speakKey}
                  onSessionEnd={handleSessionEnd}
                  onNewSession={() => setSpeakKey(k => k + 1)}
                />
              </div>
            )}

            {activeTab === 'vocabulary' && (
              <div className="workspace-panel" style={{ height: '100%', overflow: 'auto', padding: '24px' }}>
                <VocabularyTracker
                  onStartDrill={handleStartDrill}
                  showNotification={showToast}
                />
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="workspace-panel" style={{ height: '100%', overflow: 'auto', padding: '24px' }}>
                <ProgressDashboard showNotification={showToast} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
