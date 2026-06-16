import React, { useState, useEffect } from 'react';
import { getProgressSummary, getErrorPatterns, getProgressSessions } from '../services/db';
import SessionReport from './SessionReport';

export default function ProgressDashboard({ showNotification }) {
  const [summary, setSummary] = useState(null);
  const [errors, setErrors] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionReport, setSelectedSessionReport] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumData, errData, sessData] = await Promise.all([
        getProgressSummary(),
        getErrorPatterns(),
        getProgressSessions()
      ]);
      setSummary(sumData);
      setErrors(errData || []);
      setSessions(sessData || []);
    } catch (err) {
      console.error('Failed to load progress dashboard data:', err);
      showNotification('Failed to load progress data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        <span className="loader">Analyzing your progress data...</span>
      </div>
    );
  }

  // Prep SVG chart data
  // Sort sessions chronologically (oldest to newest)
  const chartSessions = [...sessions]
    .filter(s => s.fluency_score !== null)
    .reverse()
    .slice(-10); // last 10 sessions

  const renderSVGChart = () => {
    if (chartSessions.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Complete some speaking sessions to generate progress charts.
        </div>
      );
    }

    const width = 500;
    const height = 180;
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Grid coordinates
    const points = chartSessions.map((s, idx) => {
      const x = padding + (idx / Math.max(1, chartSessions.length - 1)) * chartWidth;
      // Fluency score is 0-100. Map to chart height (100 is at top, 0 at bottom)
      const y = padding + chartHeight - (s.fluency_score / 100) * chartHeight;
      return { x, y, score: s.fluency_score, topic: s.topic_description };
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <div className="trend-chart-wrapper" style={{ position: 'relative', width: '100%' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1={padding} y1={padding + chartHeight} x2={width - padding} y2={padding + chartHeight} stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

          {/* Grid labels */}
          <text x={padding - 5} y={padding + 4} textAnchor="end" fontSize="8" fill="var(--text-muted)">100</text>
          <text x={padding - 5} y={padding + chartHeight / 2 + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">50</text>
          <text x={padding - 5} y={padding + chartHeight + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">0</text>

          {/* The trend line */}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="url(#chart-grad)"
              strokeWidth="3"
              points={polylinePoints}
              strokeLinecap="round"
            />
          )}

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="var(--color-primary)"
                stroke="var(--bg-dark)"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
              >
                <title>{`${p.topic}: ${p.score}%`}</title>
              </circle>
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
                fill="white"
              >
                {p.score}
              </text>
            </g>
          ))}

          {/* Gradient */}
          <defs>
            <linearGradient id="chart-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-accent)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  const getOverallColor = (score) => {
    if (score >= 70) return '#6ee7b7';
    if (score >= 50) return '#fde047';
    return '#fda4af';
  };

  return (
    <div className="progress-dashboard animate-fade-in">
      {/* Session report viewer modal */}
      {selectedSessionReport && (
        <SessionReport
          analysis={selectedSessionReport}
          sessionId={selectedSessionReport.session_id}
          onClose={() => setSelectedSessionReport(null)}
        />
      )}

      {/* Stats Cards */}
      <div className="vocab-stats-grid">
        <div className="vocab-stat-card glass-panel">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <span className="stat-label">Practice Time</span>
            <span className="stat-value">{summary?.sessions?.totalMinutes || 0}m</span>
            <span className="stat-sub">{summary?.sessions?.total || 0} total sessions</span>
          </div>
        </div>

        <div className="vocab-stat-card glass-panel">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <span className="stat-label">Avg Fluency</span>
            <span className="stat-value">{summary?.averages?.fluency || 0}%</span>
            <span className="stat-sub">Across all practice runs</span>
          </div>
        </div>

        <div className="vocab-stat-card glass-panel">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <span className="stat-label">Active Vocab</span>
            <span className="stat-value">{summary?.vocabulary?.mastered || 0} / {summary?.vocabulary?.total || 0}</span>
            <span className="stat-sub">Words mastered</span>
          </div>
        </div>

        <div className="vocab-stat-card glass-panel">
          <div className="stat-icon">🧩</div>
          <div className="stat-info">
            <span className="stat-label">Chunks Mastered</span>
            <span className="stat-value">{summary?.chunks?.mastered || 0} / {summary?.chunks?.total || 0}</span>
            <span className="stat-sub">Phrase chunks mastered</span>
          </div>
        </div>
      </div>

      {/* Main dashboard content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: Fluency Chart & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Chart Card */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📈 Fluency Score Trend (Last 10 Runs)
            </h4>
            {renderSVGChart()}
          </div>

          {/* Session History Card */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📁 Session History
            </h4>
            
            <div className="session-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
              {sessions.length > 0 ? (
                sessions.map(s => {
                  const avgScore = Math.round(((s.fluency_score || 0) + (s.vocab_range_score || 0) + (s.grammar_score || 0)) / 3);
                  return (
                    <div 
                      key={s.id} 
                      className="history-session-item glass-panel"
                      onClick={() => setSelectedSessionReport({ ...s, session_id: s.id })}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.topic_description}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(s.started_at).toLocaleDateString('vi-VN')} · {Math.round(s.duration_seconds / 60)} mins
                        </span>
                      </div>
                      
                      {s.fluency_score !== null ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Score:</span>
                          <span style={{ 
                            fontSize: '1rem', 
                            fontWeight: 800, 
                            color: getOverallColor(avgScore),
                            background: 'rgba(255,255,255,0.02)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.05)'
                          }}>
                            {avgScore}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No analysis</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No session history available yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Error Patterns */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Error patterns card */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚠️ Grammar Mistake Areas
            </h4>

            <div className="dashboard-errors-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {errors.length > 0 ? (
                errors.map((err, i) => (
                  <div key={i} className="dashboard-error-item" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {err.type} errors
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {err.count} times
                      </span>
                    </div>
                    {/* Progress representation */}
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${Math.min(100, (err.count / Math.max(1, errors[0].count)) * 100)}%`, 
                          height: '100%', 
                          background: 'linear-gradient(90deg, var(--color-danger), #f43f5e)',
                          borderRadius: '3px'
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No mistakes captured yet. Complete sessions to populate grammar notes!
                </div>
              )}
            </div>
          </div>

          {/* Tips Card */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              💡 Practice Tips
            </h4>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ borderLeft: '2px solid var(--color-primary)', paddingLeft: '8px' }}>
                <strong>Vary your vocabulary:</strong> Check the "Words to Vary" list in your session reports to see which words you overused, and try to search for synonyms.
              </div>
              <div style={{ borderLeft: '2px solid var(--color-secondary)', paddingLeft: '8px' }}>
                <strong>Drill regularly:</strong> Target phrases in your Chunk Library that have high use count but remain unmastered. Drill them to move passive vocab into active!
              </div>
              <div style={{ borderLeft: '2px solid var(--color-success)', paddingLeft: '8px' }}>
                <strong>Answer in detail:</strong> Try to give longer answers (aim for 2-3 sentences) to practice complex structures and improve your overall average response length.
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
