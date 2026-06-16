import React from 'react';

function ScoreRing({ score, label, color }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div className="score-ring-wrapper">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={radius} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">
          {score}
        </text>
      </svg>
      <div className="score-ring-label">{label}</div>
    </div>
  );
}

function ErrorPatternTag({ pattern }) {
  return (
    <div className="error-pattern-tag">
      <div className="error-type-badge">{pattern.type}</div>
      <div className="error-example">
        <span className="error-original">"{pattern.example}"</span>
        <span className="error-arrow">→</span>
        <span className="error-correction">"{pattern.correction}"</span>
      </div>
    </div>
  );
}

export default function SessionReport({ analysis, sessionId, onStartNew, onClose }) {
  if (!analysis) return null;

  const {
    fluency_score = 0,
    vocab_range_score = 0,
    grammar_score = 0,
    avg_response_length = 0,
    repeated_words = [],
    error_patterns = [],
    chunks_detected = [],
    active_words_used = [],
    summary = ''
  } = analysis;

  const overallScore = Math.round((fluency_score + vocab_range_score + grammar_score) / 3);
  const overallColor = overallScore >= 70 ? 'var(--color-success)' : overallScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';

  return (
    <div className="session-report-overlay animate-fade-in">
      <div className="session-report glass-panel">
        {/* Header */}
        <div className="report-header">
          <div>
            <h2 className="report-title">Session Complete 🎉</h2>
            <p className="report-sub">Here's your coaching feedback</p>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
            ✕ Close
          </button>
        </div>

        {/* Score summary */}
        <div className="report-summary-card glass-panel">
          <p className="report-summary-text">{summary}</p>
        </div>

        {/* Score rings */}
        <div className="report-scores">
          <ScoreRing score={fluency_score} label="Fluency" color="var(--color-primary)" />
          <ScoreRing score={vocab_range_score} label="Vocabulary" color="var(--color-accent)" />
          <ScoreRing score={grammar_score} label="Grammar" color="var(--color-success)" />
          <div className="score-ring-wrapper">
            <div className="response-length-stat">
              <span className="response-length-number">{Math.round(avg_response_length)}</span>
              <span className="response-length-unit">words/turn</span>
            </div>
            <div className="score-ring-label">Avg. Length</div>
          </div>
        </div>

        {/* Chunks detected */}
        {chunks_detected.length > 0 && (
          <div className="report-section">
            <h4 className="report-section-title">✨ Chunks Collected ({chunks_detected.length})</h4>
            <div className="chunk-tags">
              {chunks_detected.map((chunk, i) => (
                <span key={i} className="chunk-tag">{chunk}</span>
              ))}
            </div>
          </div>
        )}

        {/* Words activated */}
        {active_words_used.length > 0 && (
          <div className="report-section">
            <h4 className="report-section-title">🔓 Words Activated ({active_words_used.length})</h4>
            <div className="chunk-tags">
              {active_words_used.map((w, i) => (
                <span key={i} className="chunk-tag activated">{w}</span>
              ))}
            </div>
          </div>
        )}

        {/* Error patterns */}
        {error_patterns.length > 0 && (
          <div className="report-section">
            <h4 className="report-section-title">📝 Grammar Notes ({error_patterns.length})</h4>
            <div className="error-patterns-list">
              {error_patterns.slice(0, 4).map((p, i) => (
                <ErrorPatternTag key={i} pattern={p} />
              ))}
            </div>
          </div>
        )}

        {/* Repeated words */}
        {repeated_words.length > 0 && (
          <div className="report-section">
            <h4 className="report-section-title">🔁 Words to Vary</h4>
            <div className="repeated-words">
              {repeated_words.slice(0, 6).map((rw, i) => (
                <span key={i} className="repeated-word-tag">
                  {rw.word} <span className="repeated-count">×{rw.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {onStartNew && (
          <div className="report-actions">
            <button className="btn-neon report-new-btn" onClick={onStartNew}>
              🎙️ Start New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
