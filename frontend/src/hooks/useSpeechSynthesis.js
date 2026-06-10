import { useState, useEffect, useRef } from 'react';

export default function useSpeechSynthesis() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voiceConfig, setVoiceConfig] = useState({
    accent: 'en-US', // en-US, en-GB
    gender: 'female', // female, male
    rate: 1.0 // 0.8, 1.0
  });

  const synthRef = useRef(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
      
      const updateVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        // Lọc các giọng đọc tiếng Anh
        const enVoices = allVoices.filter(v => v.lang.startsWith('en'));
        setVoices(enVoices);
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speak = (text) => {
    if (!synthRef.current) return;

    // Dừng âm thanh đang phát trước đó
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Cấu hình tốc độ đọc
    utterance.rate = voiceConfig.rate;

    // Tìm giọng đọc khớp với cấu hình accent và gender
    const englishVoices = voices.filter(v => v.lang.toLowerCase().includes(voiceConfig.accent.toLowerCase()));
    
    // Thuật toán tìm kiếm giọng nam/nữ (phần lớn dựa trên tên giọng đọc trên các hệ điều hành)
    let selectedVoice = null;
    if (englishVoices.length > 0) {
      if (voiceConfig.gender === 'male') {
        selectedVoice = englishVoices.find(v => 
          v.name.toLowerCase().includes('david') || 
          v.name.toLowerCase().includes('male') || 
          v.name.toLowerCase().includes('google uk english male') || 
          v.name.toLowerCase().includes('mark')
        ) || englishVoices[0];
      } else {
        selectedVoice = englishVoices.find(v => 
          v.name.toLowerCase().includes('zira') || 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('samantha') || 
          v.name.toLowerCase().includes('hazel') || 
          v.name.toLowerCase().includes('google uk english female')
        ) || englishVoices[0];
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    synthRef.current.speak(utterance);
  };

  const stop = () => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setIsPlaying(false);
  };

  return {
    speak,
    stop,
    isPlaying,
    voices,
    voiceConfig,
    setVoiceConfig
  };
}
