import { useState, useEffect, useRef } from 'react';

export default function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const currentTranscriptRef = useRef('');

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
      let merged = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (!transcriptText) continue;

        if (merged === '') {
          merged = transcriptText;
        } else {
          const currentMergedLower = merged.toLowerCase().trim();
          const nextLower = transcriptText.toLowerCase().trim();

          // Trường hợp 1: Kết quả mới là phần nối tiếp tích lũy (phổ biến trên di động)
          if (nextLower.startsWith(currentMergedLower)) {
            merged = transcriptText;
          } else {
            // Trường hợp 2: Có sự giao thoa từ (overlap) cuối chuỗi trước và đầu chuỗi sau
            const mergedWords = merged.trim().split(/\s+/);
            const nextWords = transcriptText.trim().split(/\s+/);
            let overlapCount = 0;

            // Tìm số từ trùng lặp lớn nhất ở cuối merged và đầu next
            for (let len = Math.min(mergedWords.length, nextWords.length); len > 0; len--) {
              const mergedTail = mergedWords.slice(-len).join(' ').toLowerCase();
              const nextHead = nextWords.slice(0, len).join(' ').toLowerCase();
              if (mergedTail === nextHead) {
                overlapCount = len;
                break;
              }
            }

            if (overlapCount > 0) {
              const nonOverlap = nextWords.slice(overlapCount).join(' ');
              merged = merged.trim() + ' ' + nonOverlap;
            } else {
              // Trường hợp 3: Độc lập hoàn toàn (phổ biến trên desktop), nối tiếp bình thường
              merged = merged.trim() + ' ' + transcriptText.trim();
            }
          }
        }
      }

      // Ghép kết quả của phiên hiện tại vào phần final của các phiên trước đó
      const fullTranscript = (finalTranscriptRef.current + ' ' + merged).trim();
      currentTranscriptRef.current = fullTranscript;
      setTranscript(fullTranscript);
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    rec.onend = () => {
      // Nếu người dùng không chủ động Stop (isRecordingRef.current vẫn là true)
      // thì có nghĩa là hệ thống Speech Recognition tự ngắt do im lặng (silence timeout).
      // Ta sẽ tự động khởi động lại để người dùng nói tiếp mà không mất câu cũ.
      if (isRecordingRef.current) {
        finalTranscriptRef.current = currentTranscriptRef.current;
        try {
          recognitionRef.current.start();
          console.log('[SpeechRecognition] Auto-restarted due to silence timeout.');
        } catch (e) {
          // Thử lại sau 100ms nếu trình duyệt chưa kịp giải phóng mic
          setTimeout(() => {
            if (isRecordingRef.current) {
              try {
                recognitionRef.current.start();
              } catch (err) {
                console.error('[SpeechRecognition] Retry start failed:', err);
              }
            }
          }, 100);
        }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = rec;
  }, []);

  const startRecording = () => {
    if (!supported || !recognitionRef.current) {
      console.warn('Speech Recognition is not supported or initialized.');
      return;
    }
    
    try {
      finalTranscriptRef.current = '';
      currentTranscriptRef.current = '';
      setTranscript('');
      isRecordingRef.current = true;
      setIsRecording(true);
      recognitionRef.current.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  };

  const stopRecording = () => {
    if (!supported || !recognitionRef.current) return;
    
    try {
      isRecordingRef.current = false;
      setIsRecording(false);
      recognitionRef.current.stop();
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
