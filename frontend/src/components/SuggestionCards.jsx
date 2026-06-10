import React from 'react';

export default function SuggestionCards({ suggestions, onSelect }) {
  if (!suggestions) return null;

  const { short, full, advanced } = suggestions;

  return (
    <div className="suggestions-container animate-fade-in">
      {short && (
        <button 
          className="suggestion-chip" 
          onClick={() => onSelect(short)}
          title="Câu trả lời ngắn gọn, dễ nói"
        >
          ⚡ Short: {short}
        </button>
      )}
      {full && (
        <button 
          className="suggestion-chip" 
          onClick={() => onSelect(full)}
          title="Câu trả lời đầy đủ, đúng ngữ pháp"
        >
          💬 Full: {full}
        </button>
      )}
      {advanced && (
        <button 
          className="suggestion-chip" 
          onClick={() => onSelect(advanced)}
          title="Câu trả lời tự nhiên dạng bản xứ"
        >
          ⭐ Advanced: {advanced}
        </button>
      )}
    </div>
  );
}
