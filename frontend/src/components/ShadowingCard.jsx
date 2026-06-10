import React, { useState, useEffect } from 'react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

export default function ShadowingCard({ card, onPlayVoice, onComplete }) {
  const { isRecording, transcript, startRecording, stopRecording, supported } = useSpeechRecognition();
  const [score, setScore] = useState(null);
  const [matchingWords, setMatchingWords] = useState([]);
  const [hasPracticed, setHasPracticed] = useState(false);

  useEffect(() => {
    // Reset state khi đổi thẻ flashcard
    setScore(null);
    setMatchingWords([]);
    setHasPracticed(false);
  }, [card]);

  // Phân tích độ trùng khớp và tính điểm
  const evaluateShadowing = (userText) => {
    if (!userText) return;

    const targetWords = card.front.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
    const spokenWords = userText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);

    // Xây dựng mảng so khớp trực quan
    const result = card.front.split(/(\s+)/).map(chunk => {
      if (chunk.trim() === '') return { text: chunk, match: true };
      
      const cleanWord = chunk.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isMatched = spokenWords.includes(cleanWord);
      
      return { text: chunk, match: isMatched };
    });

    setMatchingWords(result);

    // Tính điểm phần trăm trùng khớp đơn giản
    let matchedCount = 0;
    targetWords.forEach(word => {
      if (spokenWords.includes(word)) {
        matchedCount++;
      }
    });

    const calculatedScore = Math.round((matchedCount / Math.max(targetWords.length, spokenWords.length)) * 100);
    setScore(calculatedScore);
    setHasPracticed(true);
  };

  // Kích hoạt đánh giá khi dừng ghi âm
  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
      // Đợi tí để cập nhật transcript cuối cùng trước khi đánh giá
      setTimeout(() => {
        evaluateShadowing(transcript);
      }, 500);
    } else {
      setScore(null);
      setMatchingWords([]);
      startRecording();
    }
  };

  // Chạy chấm điểm lặp lại ngắt quãng (SM-2 Grade) dựa trên điểm shadowing
  const submitShadowingGrade = (grade) => {
    onComplete(card.id, grade);
  };

  return (
    <div className="shadowing-box glass-panel animate-fade-in">
      <div className="section-card-title" style={{ width: '100%' }}>
        <span> Shadowing Practice</span>
        <button 
          className="btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          onClick={() => onPlayVoice(card.front)}
        >
          🔊 Nghe AI đọc mẫu
        </button>
      </div>

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>
          Câu cần luyện nói:
        </h4>
        
        {/* Render câu so khớp màu sắc nếu đã luyện */}
        {hasPracticed ? (
          <div style={{ fontSize: '1.25rem', lineHeight: '1.6', fontWeight: 600 }}>
            {matchingWords.map((item, idx) => (
              <span 
                key={idx} 
                style={{ 
                  color: item.match ? 'var(--color-success)' : 'var(--color-danger)',
                  textDecoration: item.match ? 'none' : 'line-through'
                }}
              >
                {item.text}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '1.25rem', lineHeight: '1.6', fontWeight: 600 }}>
            {card.front}
          </div>
        )}

        {card.ipa && (
          <div className="ipa-notation" style={{ marginTop: '6px' }}>
            {card.ipa}
          </div>
        )}
      </div>

      {/* Voice Recorder Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
        <button 
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleToggleRecord}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {isRecording ? 'Đang lắng nghe... Thả micro/bấm lại để chấm điểm' : 'Bấm micro và nói đuổi theo'}
        </span>
      </div>

      {/* Kết quả chấm điểm Shadowing */}
      {score !== null && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div className="shadowing-score">
            {score}% Match
          </div>
          
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            {score >= 90 ? '🎉 Xuất sắc! Phát âm của bạn gần như người bản xứ.' : score >= 60 ? '👍 Tốt! Hãy cố gắng phát âm chuẩn các từ bôi đỏ.' : '💪 Hãy nghe lại âm mẫu và thử lại để tăng độ chính xác.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hãy tự đánh giá mức độ ghi nhớ và độ trôi chảy:</span>
            <div className="flashcard-actions">
              <button 
                className="btn-grade hard" 
                onClick={() => submitShadowingGrade(1)}
                title="Khó: Không thể phát âm trôi chảy hoặc quên mặt chữ"
              >
                Hard (Lặp lại ngay)
              </button>
              <button 
                className="btn-grade good" 
                onClick={() => submitShadowingGrade(3)}
                title="Tạm ổn: Đọc được nhưng còn ngắc ngứ"
              >
                Good (Ôn sau 3 ngày)
              </button>
              <button 
                className="btn-grade easy" 
                onClick={() => submitShadowingGrade(5)}
                title="Dễ: Phát âm chuẩn xác, trôi chảy, phản xạ nhanh"
              >
                Easy (Ôn sau 7 ngày)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
