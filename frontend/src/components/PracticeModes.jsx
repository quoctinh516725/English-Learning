import React from 'react';

const ROLEPLAY_SCENARIOS = [
  {
    id: 'hotel',
    title: 'Hotel Check-in',
    icon: '🏨',
    role: 'hotel receptionist',
    userRole: 'guest looking to check in',
    scenario: 'You are arriving at the Grand Plaza Hotel and need to complete your check-in process.',
    taskChecklist: [
      'Mention you have a reservation under your name',
      'Ask about the breakfast hours and locations',
      'Request the room key card'
    ]
  },
  {
    id: 'interview',
    title: 'Job Interview',
    icon: '💼',
    role: 'senior tech interviewer',
    userRole: 'software engineer candidate',
    scenario: 'You are interviewing for a software engineering position at a global tech firm.',
    taskChecklist: [
      'Introduce yourself briefly',
      'Describe a complex project you worked on',
      'Ask the interviewer a question about company culture'
    ]
  },
  {
    id: 'cafe',
    title: 'Coffee Shop Order',
    icon: '☕',
    role: 'friendly barista',
    userRole: 'customer ordering drinks',
    scenario: 'You are ordering coffee and snacks at a busy downtown cafe.',
    taskChecklist: [
      'Order a specific type of coffee and snack',
      'Ask to customize the milk or sugar level',
      'Request to pay by card and ask for the receipt'
    ]
  }
];

const TOPICS = [
  {
    id: 'gym',
    title: 'Gym & Fitness',
    icon: '💪',
    coreVocabulary: ['workout', 'stamina', 'consistency', 'protein', 'hypertrophy', 'cardio']
  },
  {
    id: 'tech',
    title: 'Tech Upgrades',
    icon: '💻',
    coreVocabulary: ['latency', 'specs', 'processor', 'integration', 'performance', 'bandwidth']
  },
  {
    id: 'meals',
    title: 'Daily Meals & Diet',
    icon: '🍎',
    coreVocabulary: ['nutritional', 'recipe', 'organic', 'gourmet', 'calorie', 'ingredients']
  }
];

export default function PracticeModes({ activeMode, activeDetails, onSelectMode }) {
  return (
    <div className="workspace-panel animate-fade-in" style={{ padding: '0px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px' }}>🎯 Choose Practice Mode</h2>

      {/* 1. Free Talk */}
      <div 
        className="glass-panel mode-card" 
        style={{
          border: activeMode === 'free-talk' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
          background: activeMode === 'free-talk' ? 'var(--color-primary-glow)' : 'var(--bg-card)'
        }}
        onClick={() => onSelectMode('free-talk', {})}
      >
        <div className="mode-icon">💬</div>
        <div>
          <div className="mode-title">Luyện nói tự do (Free Talk)</div>
          <p className="mode-desc">Trò chuyện cởi mở với AI về bất cứ đề tài gì bạn thích. Thích hợp để rèn luyện phản xạ hội thoại cơ bản.</p>
        </div>
      </div>

      <div className="modes-grid">
        {/* 2. Roleplay */}
        <div style={{ display: 'contents' }}>
          {ROLEPLAY_SCENARIOS.map((scenario) => (
            <div 
              key={scenario.id}
              className="glass-panel mode-card"
              style={{
                border: activeMode === 'roleplay' && activeDetails.id === scenario.id ? '2px solid var(--color-accent)' : '1px solid var(--border-color)',
                background: activeMode === 'roleplay' && activeDetails.id === scenario.id ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-card)'
              }}
              onClick={() => onSelectMode('roleplay', scenario)}
            >
              <div className="mode-icon">{scenario.icon}</div>
              <div>
                <div className="mode-title">Roleplay: {scenario.title}</div>
                <p className="mode-desc">{scenario.scenario}</p>
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <strong>Nhiệm vụ:</strong> {scenario.taskChecklist.length} mục tiêu cần đạt.
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 3. Topics */}
        <div style={{ display: 'contents' }}>
          {TOPICS.map((topic) => (
            <div 
              key={topic.id}
              className="glass-panel mode-card"
              style={{
                border: activeMode === 'topic' && activeDetails.id === topic.id ? '2px solid var(--color-success)' : '1px solid var(--border-color)',
                background: activeMode === 'topic' && activeDetails.id === topic.id ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card)'
              }}
              onClick={() => onSelectMode('topic', topic)}
            >
              <div className="mode-icon">{topic.icon}</div>
              <div>
                <div className="mode-title">Topic: {topic.title}</div>
                <p className="mode-desc">Luyện nói bắt buộc lồng ghép các từ vựng chuyên đề.</p>
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {topic.coreVocabulary.map((word, i) => (
                    <span key={i} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
