import { useState, useEffect, useRef } from 'react';

export default function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Kiểm tra tính tương thích của trình duyệt
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Cập nhật kết quả tức thời lên màn hình
      setTranscript(finalTranscript + interimTranscript);
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Không có tiếng động, tự động dừng
      }
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = rec;
  }, []);

  const startRecording = () => {
    if (!supported || !recognitionRef.current) {
      console.warn('Speech Recognition is not supported or initialized.');
      return;
    }
    
    try {
      setTranscript('');
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  };

  const stopRecording = () => {
    if (!supported || !recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
      setIsRecording(false);
    } catch (e) {
      console.error('Failed to stop speech recognition:', e);
    }
  };

  return {
    isRecording,
    transcript,
    setTranscript,
    startRecording,
    stopRecording,
    supported
  };
}
