import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import ShadowingCard from './ShadowingCard';

export default function Notebook({ onPlayVoice, onSaveNotify }) {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dueCards, setDueCards] = useState([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const notebookItems = await db.getNotebook();
    setItems(notebookItems);
    
    // Nạp thẻ đến hạn ôn tập
    const due = await db.getDueFlashcards();
    setDueCards(due);

    if (notebookItems.length > 0 && !selectedItem) {
      setSelectedItem(notebookItems[0]);
    }
  };

  const handleRemove = async (id) => {
    await db.removeFromNotebook(id);
    onSaveNotify("Đã xóa khỏi sổ tay.");
    
    // Nạp lại dữ liệu
    const updated = await db.getNotebook();
    setItems(updated);
    const due = await db.getDueFlashcards();
    setDueCards(due);

    if (selectedItem && selectedItem.id === id) {
      setSelectedItem(updated.length > 0 ? updated[0] : null);
    }
  };

  const startReviewSession = () => {
    if (dueCards.length === 0) return;
    setIsReviewing(true);
    setCurrentReviewIndex(0);
  };

  const handleReviewComplete = async (cardId, grade) => {
    // Cập nhật lịch sử ôn tập theo thuật toán SM-2
    await db.updateFlashcardSchedule(cardId, grade);
    
    onSaveNotify("Đã ghi nhận điểm ôn tập!");

    // Chuyển sang thẻ tiếp theo
    if (currentReviewIndex + 1 < dueCards.length) {
      setCurrentReviewIndex(prev => prev + 1);
    } else {
      // Hoàn thành phiên ôn tập
      setIsReviewing(false);
      await loadData(); // Tải lại dữ liệu để cập nhật số lượng dueCards
      onSaveNotify("🎉 Chúc mừng! Bạn đã hoàn thành tất cả thẻ ôn tập hôm nay.");
    }
  };

  return (
    <div className="notebook-container animate-fade-in">
      {/* Cột trái: Danh sách các từ và câu đã lưu */}
      <div className="word-list-panel">
        <h3 className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📚 Sổ tay của bạn</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{items.length} mục</span>
        </h3>

        {/* Ôn tập Flashcards */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: '16px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(14, 165, 233, 0.1))',
            borderColor: dueCards.length > 0 ? 'rgba(139, 92, 246, 0.4)' : 'var(--border-color)',
            marginBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Thẻ cần ôn tập hôm nay</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {dueCards.length > 0 ? `Bạn có ${dueCards.length} thẻ đến hạn` : 'Không có thẻ nào đến hạn'}
              </div>
            </div>
            {dueCards.length > 0 && !isReviewing && (
              <button className="btn-neon" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={startReviewSession}>
                Luyện ngay
              </button>
            )}
          </div>
        </div>

        <div className="notebook-list">
          {items.map(item => (
            <div 
              key={item.id} 
              className={`notebook-item ${selectedItem && selectedItem.id === item.id && !isReviewing ? 'active' : ''}`}
              onClick={() => {
                setIsReviewing(false);
                setSelectedItem(item);
              }}
            >
              <div className="notebook-item-word">
                <span style={{ 
                  color: item.type === 'vocabulary' ? 'var(--color-primary)' : 'var(--text-primary)',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '200px'
                }}>
                  {item.type === 'vocabulary' ? `🔤 ${item.original}` : `💬 ${item.corrected || item.original}`}
                </span>
                <span className={`badge-${item.type === 'vocabulary' ? 'success' : 'success'}`} style={{ fontSize: '0.65rem' }}>
                  {item.type}
                </span>
              </div>
              <div className="notebook-item-meta">
                Lưu vào: {new Date(item.savedAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>
              Chưa lưu từ vựng hoặc câu nào. Hãy bấm nút ⭐ trong chat room để lưu.
            </p>
          )}
        </div>
      </div>

      {/* Cột phải: Vùng hiển thị chi tiết hoặc Phiên Shadowing */}
      <div style={{ height: '100%', overflowY: 'auto' }}>
        {isReviewing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Thẻ số {currentReviewIndex + 1} trên tổng số {dueCards.length}
            </div>
            <ShadowingCard 
              card={dueCards[currentReviewIndex]} 
              onPlayVoice={onPlayVoice}
              onComplete={handleReviewComplete}
            />
            <button 
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.75rem' }} 
              onClick={() => setIsReviewing(false)}
            >
              ❌ Thoát ôn tập
            </button>
          </div>
        ) : selectedItem ? (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Chi tiết {selectedItem.type === 'vocabulary' ? 'Từ vựng' : 'Câu đã sửa'}
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
                  {selectedItem.corrected || selectedItem.original}
                </h2>
                {selectedItem.ipa && (
                  <div className="ipa-notation" style={{ fontSize: '1.1rem', marginTop: '4px' }}>
                    {selectedItem.ipa}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  onClick={() => onPlayVoice(selectedItem.corrected || selectedItem.original)}
                >
                  🔊 Phát âm
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--color-danger)', borderColor: 'rgba(244,63,94,0.3)' }}
                  onClick={() => handleRemove(selectedItem.id)}
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>

            {selectedItem.type === 'sentence' && selectedItem.corrected && (
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Câu gốc bạn đã nói:</div>
                <div style={{ fontSize: '0.95rem', color: '#fda4af', textDecoration: 'line-through', marginTop: '4px' }}>
                  {selectedItem.original}
                </div>
              </div>
            )}

            {selectedItem.explanation && (
              <div style={{ borderLeft: '3px solid var(--color-warning)', paddingLeft: '14px', margin: '8px 0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-warning)' }}>Giải nghĩa / Giải thích lỗi:</div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '4px' }}>
                  {selectedItem.explanation}
                </p>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mục này sẽ tự động xuất hiện trong Flashcards đến hạn của bạn để shadowing dựa trên mức độ ôn tập.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Chọn một mục từ danh sách bên trái để xem chi tiết.
          </div>
        )}
      </div>
    </div>
  );
}
