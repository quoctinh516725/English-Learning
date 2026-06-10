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
    id: 'travel',
    title: 'Travel & Exploration',
    icon: '✈️',
    coreVocabulary: ['tourist attraction', 'itinerary', 'local cuisine', 'sightseeing', 'travel agency', 'accommodation', 'luggage allowance', 'board the plane'],
    vocabularyDetail: [
      { word: 'tourist attraction', meaning: 'điểm du lịch' },
      { word: 'itinerary', meaning: 'lịch trình' },
      { word: 'local cuisine', meaning: 'ẩm thực địa phương' },
      { word: 'sightseeing', meaning: 'ngắm cảnh' },
      { word: 'travel agency', meaning: 'đại lý du lịch' },
      { word: 'accommodation', meaning: 'chỗ ở' },
      { word: 'luggage allowance', meaning: 'hành lý cho phép' },
      { word: 'board the plane', meaning: 'lên máy bay' }
    ]
  },
  {
    id: 'workplace',
    title: 'Workplace & Career',
    icon: '💼',
    coreVocabulary: ['tight deadline', 'collaborate', 'performance review', 'career ladder', 'brainstorming', 'work-life balance', 'overtime work', 'job satisfaction'],
    vocabularyDetail: [
      { word: 'tight deadline', meaning: 'hạn chót gấp rút' },
      { word: 'collaborate', meaning: 'hợp tác' },
      { word: 'performance review', meaning: 'đánh giá năng lực' },
      { word: 'career ladder', meaning: 'nấc thang sự nghiệp' },
      { word: 'brainstorming', meaning: 'động não thảo luận' },
      { word: 'work-life balance', meaning: 'cân bằng cuộc sống' },
      { word: 'overtime work', meaning: 'làm tăng ca' },
      { word: 'job satisfaction', meaning: 'hài lòng công việc' }
    ]
  },
  {
    id: 'food',
    title: 'Food & Gourmet',
    icon: '🍳',
    coreVocabulary: ['culinary skills', 'signature dish', 'dine out', 'healthy recipe', 'street food', 'authentic flavor', 'appetizer', 'table manners'],
    vocabularyDetail: [
      { word: 'culinary skills', meaning: 'kỹ năng nấu nướng' },
      { word: 'signature dish', meaning: 'món đặc trưng' },
      { word: 'dine out', meaning: 'đi ăn ngoài' },
      { word: 'healthy recipe', meaning: 'công thức lành mạnh' },
      { word: 'street food', meaning: 'ẩm thực đường phố' },
      { word: 'authentic flavor', meaning: 'hương vị nguyên bản' },
      { word: 'appetizer', meaning: 'món khai vị' },
      { word: 'table manners', meaning: 'văn hóa bàn ăn' }
    ]
  },
  {
    id: 'entertainment',
    title: 'Entertainment & Movies',
    icon: '🎬',
    coreVocabulary: ['blockbuster', 'binge-watch', 'catchy tune', 'trending topic', 'live performance', 'critically acclaimed', 'plot twist', 'soundtrack'],
    vocabularyDetail: [
      { word: 'blockbuster', meaning: 'phim bom tấn' },
      { word: 'binge-watch', meaning: 'cày phim liên tục' },
      { word: 'catchy tune', meaning: 'giai điệu bắt tai' },
      { word: 'trending topic', meaning: 'chủ đề hot' },
      { word: 'live performance', meaning: 'biểu diễn trực tiếp' },
      { word: 'critically acclaimed', meaning: 'giới chuyên môn đánh giá cao' },
      { word: 'plot twist', meaning: 'bước ngoặt cốt truyện' },
      { word: 'soundtrack', meaning: 'nhạc phim' }
    ]
  },
  {
    id: 'health',
    title: 'Health & Wellness',
    icon: '🌱',
    coreVocabulary: ['physical fitness', 'mental health', 'balanced diet', 'immune system', 'stay hydrated', 'regular exercise', 'lack of sleep', 'relieve stress'],
    vocabularyDetail: [
      { word: 'physical fitness', meaning: 'thể chất khỏe mạnh' },
      { word: 'mental health', meaning: 'sức khỏe tinh thần' },
      { word: 'balanced diet', meaning: 'chế độ ăn cân bằng' },
      { word: 'immune system', meaning: 'hệ miễn dịch' },
      { word: 'stay hydrated', meaning: 'uống đủ nước' },
      { word: 'regular exercise', meaning: 'tập thể dục đều đặn' },
      { word: 'lack of sleep', meaning: 'thiếu ngủ' },
      { word: 'relieve stress', meaning: 'giảm stress' }
    ]
  },
  {
    id: 'shopping',
    title: 'Shopping & Fashion',
    icon: '🛍️',
    coreVocabulary: ['shopping spree', 'bargain hunter', 'wardrobe', 'discount coupon', 'fashion trend', 'refund policy', 'brand loyalty', 'fitting room'],
    vocabularyDetail: [
      { word: 'shopping spree', meaning: 'mua sắm thả ga' },
      { word: 'bargain hunter', meaning: 'người săn giá hời' },
      { word: 'wardrobe', meaning: 'tủ quần áo' },
      { word: 'discount coupon', meaning: 'phiếu giảm giá' },
      { word: 'fashion trend', meaning: 'xu hướng thời trang' },
      { word: 'refund policy', meaning: 'chính sách hoàn tiền' },
      { word: 'brand loyalty', meaning: 'trung thành thương hiệu' },
      { word: 'fitting room', meaning: 'phòng thử đồ' }
    ]
  },
  {
    id: 'tech',
    title: 'Tech & Gadgets',
    icon: '🤖',
    coreVocabulary: ['state-of-the-art', 'user-friendly', 'battery life', 'smart home', 'cutting-edge technology', 'data privacy', 'artificial intelligence', 'high latency'],
    vocabularyDetail: [
      { word: 'state-of-the-art', meaning: 'tối tân nhất' },
      { word: 'user-friendly', meaning: 'thân thiện người dùng' },
      { word: 'battery life', meaning: 'thời lượng pin' },
      { word: 'smart home', meaning: 'nhà thông minh' },
      { word: 'cutting-edge technology', meaning: 'công nghệ tiên tiến nhất' },
      { word: 'data privacy', meaning: 'bảo mật dữ liệu' },
      { word: 'artificial intelligence', meaning: 'trí tuệ nhân tạo' },
      { word: 'high latency', meaning: 'độ trễ cao' }
    ]
  },
  {
    id: 'traffic',
    title: 'Traffic & Urban Life',
    icon: '🚗',
    coreVocabulary: ['rush hour', 'public transport', 'traffic congestion', 'commute', 'pedestrian zone', 'cost of living', 'infrastructure', 'urban sprawl'],
    vocabularyDetail: [
      { word: 'rush hour', meaning: 'giờ cao điểm' },
      { word: 'public transport', meaning: 'phương tiện công cộng' },
      { word: 'traffic congestion', meaning: 'tắc nghẽn giao thông' },
      { word: 'commute', meaning: 'đi lại đi làm hằng ngày' },
      { word: 'pedestrian zone', meaning: 'phố đi bộ' },
      { word: 'cost of living', meaning: 'chi phí sinh hoạt' },
      { word: 'infrastructure', meaning: 'cơ sở hạ tầng' },
      { word: 'urban sprawl', meaning: 'đô thị hóa tự phát' }
    ]
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
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(topic.vocabularyDetail || []).map((item, i) => (
                    <span 
                      key={i} 
                      style={{ 
                        fontSize: '0.7rem', 
                        background: 'rgba(255,255,255,0.04)', 
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '3px 8px', 
                        borderRadius: '6px',
                        color: 'var(--text-primary)'
                      }}
                      title={item.meaning}
                    >
                      <strong>{item.word}</strong> <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>({item.meaning})</span>
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
