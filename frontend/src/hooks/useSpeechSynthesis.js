import { useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_BACBKEND_URL || 'http://localhost:5000';

export default function useSpeechSynthesis() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState({
    accent: 'en-US',
    gender: 'female',
    rate: 1.0
  });

  const audioRef = useRef(null);

  const speak = (text) => {
    if (!text || text.trim() === '') return;

    // Dừng âm thanh đang phát trước đó
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }

    try {
      // Gọi API TTS của Backend để tải và phát file MP3
      const url = `${API_BASE}/api/tts?text=${encodeURIComponent(text)}&rate=${voiceConfig.rate}`;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
        audioRef.current = null;
      };

      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
        setIsPlaying(false);
      });
    } catch (err) {
      console.error('Failed to play TTS:', err);
      setIsPlaying(false);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  };

  return {
    speak,
    stop,
    isPlaying,
    voices: [], // Giọng đọc cố định ở backend
    voiceConfig,
    setVoiceConfig
  };
}
