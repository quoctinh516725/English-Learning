import React, { useState, useEffect } from 'react';
import { db } from '../services/db';

export default function EvaluationBox({ evaluation: evaluations, onSaveNotify }) {
  const [selectedWord, setSelectedWord] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (evaluations && evaluations.length > 0) {
      setCurrentIndex(evaluations.length - 1);
    }
  }, [evaluations]);

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="diagnosis-panel glass-panel">
        <h3 className="panel-title">🎯 Real-time Diagnosis</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginTop: '40px' }}>
          Trò chuyện trong phòng hội thoại để xem chẩn đoán phát âm và sửa ngữ pháp tại đây.
        </p>
      </div>
    );
  }

  const activeEval = evaluations[currentIndex] || {};
  const { grammarCorrection, pronunciationTips = [] } = activeEval;

  // Tách câu gốc của user thành mảng các từ để hiển thị bôi đỏ nếu phát âm sai
  const renderPronunciationWords = () => {
    if (!grammarCorrection || !grammarCorrection.original) return null;
    
    const words = grammarCorrection.original.split(/(\s+)/); // Giữ lại cả khoảng trắng
    return words.map((chunk, idx) => {
      // Nếu là khoảng trắng, render bình thường
      if (chunk.trim() === '') return chunk;

      // Xóa các dấu câu để so khớp từ chính xác
      const cleanWord = chunk.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isError = pronunciationTips.some(tip => tip.word.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanWord);

      return (
        <span 
          key={idx} 
          className={`pron-word ${isError ? 'error' : 'correct'}`}
          onClick={() => {
            if (isError) {
              const matchedTip = pronunciationTips.find(tip => tip.word.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanWord);
              setSelectedWord(matchedTip);
            }
          }}
          title={isError ? "Bấm để xem phiên âm IPA và mẹo sửa" : ""}
        >
          {chunk}
        </span>
      );
    });
  };

  // Lưu câu đã sửa vào Sổ tay thông minh
  const handleSaveSentence = async () => {
    if (!grammarCorrection) return;
    
    const item = {
      original: grammarCorrection.original,
      corrected: grammarCorrection.corrected,
      explanation: grammarCorrection.explanation,
      // Lấy phiên âm của từ sai đầu tiên nếu có để làm gợi ý phát âm trong flashcard
      ipa: pronunciationTips.length > 0 ? `${pronunciationTips[0].word}: ${pronunciationTips[0].ipa}` : '',
      type: 'sentence'
    };

    const saved = await db.saveToNotebook(item);
    if (saved) {
      onSaveNotify("Lưu câu sửa vào Sổ tay thành công!");
    } else {
      onSaveNotify("Không thể lưu hoặc câu này đã tồn tại trong Sổ tay của bạn.");
    }
  };

  // Lưu từ vựng sai cụ thể vào Sổ tay thông minh
  const handleSaveWord = async (wordTip) => {
    const item = {
      original: wordTip.word,
      corrected: wordTip.word,
      explanation: wordTip.tip,
      ipa: wordTip.ipa,
      type: 'vocabulary'
    };

    const saved = await db.saveToNotebook(item);
    if (saved) {
      onSaveNotify(`Đã lưu từ "${wordTip.word}" vào Sổ tay!`);
    } else {
      onSaveNotify(`Không thể lưu hoặc từ "${wordTip.word}" đã có trong Sổ tay.`);
    }
  };

  return (
    <div className="diagnosis-panel glass-panel animate-fade-in">
      <h3 className="panel-title">🎯 Real-time Diagnosis</h3>

      {/* Điều chuyển lịch sử chẩn đoán (Tối đa 5 cái gần nhất) */}
      {evaluations.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <button 
            className="btn-secondary" 
            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          >
            ◀ Trước
          </button>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Lịch sử: {currentIndex + 1} / {evaluations.length}
          </span>
          <button 
            className="btn-secondary" 
            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
            disabled={currentIndex === evaluations.length - 1}
            onClick={() => setCurrentIndex(prev => Math.min(evaluations.length - 1, prev + 1))}
          >
            Sau ▶
          </button>
        </div>
      )}

      {/* 1. Pronunciation Assessment */}
      <div className="section-card">
        <div className="section-card-title">
          <span>Phát âm (Pronunciation)</span>
          {pronunciationTips.length > 0 && <span className="badge-error">{pronunciationTips.length} từ sai</span>}
        </div>
        <div className="pronunciation-text">
          {renderPronunciationWords()}
        </div>
        {pronunciationTips.length > 0 ? (
          <div className="pron-tips-list">
            {pronunciationTips.map((tip, idx) => (
              <div 
                key={idx} 
                className="pron-tip-item"
                style={{
                  boxShadow: selectedWord && selectedWord.word === tip.word ? '0 0 8px rgba(244,63,94,0.4)' : 'none',
                  borderColor: selectedWord && selectedWord.word === tip.word ? 'var(--color-danger)' : 'rgba(244, 63, 94, 0.3)'
                }}
              >
                <div className="pron-word-title">
                  <span>{tip.word}</span>
                  <span className="ipa-notation">{tip.ipa}</span>
                  <button 
                    className="save-notebook-btn"
                    onClick={() => handleSaveWord(tip)}
                    title="Lưu từ này vào sổ tay ôn tập"
                  >
                    ⭐ Lưu từ
                  </button>
                </div>
                <div className="pron-instruction">{tip.tip}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-success)', fontSize: '0.8rem', fontWeight: 600 }}>
            ✓ Phát âm rất tốt! Không phát hiện từ sai lệch lớn.
          </p>
        )}
      </div>

      {/* 2. Grammar & Vocabulary Correction */}
      {grammarCorrection && (
        <div className="section-card">
          <div className="section-card-title">
            <span>Ngữ pháp & Từ vựng</span>
            <button 
              className="save-notebook-btn" 
              onClick={handleSaveSentence}
              title="Lưu câu sửa vào Sổ tay ôn tập"
            >
              ⭐ Lưu cả câu
            </button>
          </div>
          
          <div className="grammar-correction-container">
            {grammarCorrection.hasError ? (
              <div className="grammar-text-diff">
                <div className="grammar-item original">
                  {grammarCorrection.original}
                </div>
                <div className="grammar-item corrected">
                  {grammarCorrection.corrected}
                </div>
                {grammarCorrection.explanation && (
                  <div className="grammar-explanation">
                    <strong>Giải thích:</strong> {grammarCorrection.explanation}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--color-success)', fontSize: '0.8rem', fontWeight: 600 }}>
                ✓ Ngữ pháp chính xác!
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. Rephrasing Suggestions */}
      {grammarCorrection && grammarCorrection.rephrasings && grammarCorrection.rephrasings.length > 0 && (
        <div className="section-card">
          <div className="section-card-title">
            <span>Cách diễn đạt tự nhiên hơn</span>
          </div>
          <div className="rephrasings-list">
            {grammarCorrection.rephrasings.map((rep, idx) => (
              <div key={idx} className="rephrasing-item">
                <div className="rephrasing-phrase">{rep.phrase}</div>
                {rep.explanation && <div className="rephrasing-exp">{rep.explanation}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
