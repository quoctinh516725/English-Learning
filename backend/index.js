import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query, initDb } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'ai-speaking-coach-super-secret-key-13579';

app.use(cors());
app.use(express.json());

// Khởi chạy Database
initDb().then(() => {
  console.log('Database initialized.');
}).catch(err => {
  console.error('Database initialization failed:', err);
});

// Cấu hình xoay tua API Keys (Round Robin) để tránh bị giới hạn quota
let keyCounter = 0;
function getGenAIClient() {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY
  ].filter(k => k && k.trim() !== '' && k !== 'your_gemini_api_key_here' && k !== 'your_api_key_here');

  if (keys.length === 0) {
    return null;
  }

  // Chọn key tiếp theo xoay tua
  const selectedKey = keys[keyCounter % keys.length];
  console.log(`[GenAI Round-Robin] Using API Key #${(keyCounter % keys.length) + 1} of ${keys.length}`);
  keyCounter++;
  
  return new GoogleGenerativeAI(selectedKey);
}

// ==========================================
// MIDDLEWARE XÁC THỰC TOKEN JWT
// ==========================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or has expired.' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// 1. ENDPOINTS XÁC THỰC (AUTH API)
// ==========================================

// Đăng ký tài khoản mới
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Kiểm tra trùng lặp email
    const checkUser = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Lưu vào database
    const newUser = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    res.status(201).json({
      message: 'Registration successful.',
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Tìm người dùng
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Incorrect email or password.' });
    }

    const user = userResult.rows[0];

    // So khớp mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect email or password.' });
    }

    // Ký JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Lấy thông tin user hiện tại (Verify token)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});


// ==========================================
// 2. ENDPOINTS HỘI THOẠI AI TÍCH HỢP DB
// ==========================================

// Lấy lịch sử chat của user
app.get('/api/chat/history', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const history = await query(
      'SELECT sender, text, suggestions, evaluation, timestamp FROM chat_messages WHERE user_id = $1 ORDER BY timestamp ASC LIMIT 50',
      [userId]
    );
    res.json(history.rows);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
});

// Xóa hoàn toàn lịch sử chat của user
app.delete('/api/chat/history', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    await query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
    res.json({ message: 'Chat history cleared successfully.' });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history.' });
  }
});

// Gửi tin nhắn mới & Phân tích bằng Gemini
app.post('/api/chat', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { 
    userText, 
    contextMode = 'free-talk',
    contextDetails = {},
    chatHistory = [],
    isVoiceInput = false
  } = req.body;

  if (!userText || userText.trim() === '') {
    return res.status(400).json({ error: 'User text is required.' });
  }

  try {
    let evaluationResult = null;
    
    const hasKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
      process.env.GEMINI_API_KEY
    ].some(k => k && k.trim() !== '' && k !== 'your_gemini_api_key_here' && k !== 'your_api_key_here');

    if (!hasKeys) {
      // Sử dụng mock response nếu không cấu hình Gemini API Key
      evaluationResult = getMockResponse(userText, contextMode, contextDetails);
    } else {
      // Lấy lịch sử chat từ tham số hoặc tải từ DB
      const formattedHistory = chatHistory.map(msg => 
        `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`
      ).join('\n');

      let systemInstruction = `
You are an advanced AI English Speaking Assistant.
Role & Personality:
- You are a friendly and patient English teacher conducting a 1:1 speaking lesson.
- The user is a beginner English learner at an A2 level.
- Speak in simple, basic English suitable for A2 level. Avoid using complex vocabulary.
- You must ALWAYS speak in English in your conversational responses ("aiResponse").

Pedagogical Rules:
1. If the user makes an English mistake (grammar, vocabulary, word choice): in your conversational response, briefly identify the mistake, provide the correct sentence, optionally suggest how to expand it, and always ask them to repeat the corrected sentence (e.g., "Could you try saying that again: '...'?").
2. If the user asks how to translate or express a Vietnamese phrase into English: provide the correct English translation and explain it briefly.
3. Always keep your response ("aiResponse") very short, concise, and natural for audio-based conversational practice. Avoid long paragraphs. Max 3 sentences.

Current Mode: ${contextMode}
`;

      if (contextMode === 'roleplay') {
        systemInstruction += `
Roleplay Setting:
- Your Role: ${contextDetails.role || 'an interviewer'}
- User's Role: ${contextDetails.userRole || 'a candidate'}
- Goal/Scenario: ${contextDetails.scenario || 'Job Interview'}
- Checklist items to check off: ${JSON.stringify(contextDetails.taskChecklist || [])}
Maintain your character strictly in the 'aiResponse' part, but evaluate their English objectively in the JSON.
Analyze if they completed any checklist tasks.
`;
      } else if (contextMode === 'topic') {
        systemInstruction += `
Topic Setting:
- Subject: ${contextDetails.topicName || 'General'}
- Core Vocabulary that the user is encouraged to use: ${JSON.stringify(contextDetails.coreVocabulary || [])}
Encourage discussing this topic. If the user used any of the core vocabulary words (or variations/plurals), mark them as used in the JSON output.
`;
      }

      systemInstruction += `
Evaluate the user's sentence: "${userText}"
Compare what they said with typical native grammar. Provide grammar correction if needed, with a short explanation in Vietnamese.
Analyze difficult words or potential pronunciation issues in their sentence and provide their IPA transcriptions and tips.
Provide 3 suggestion responses for the user to reply back: Short (simple, direct), Full (complete, polite), Advanced (using native idioms or advanced phrases).

You MUST output your response in JSON format matching the schema below:
{
  "aiResponse": "Next conversational response by AI. In English. (If roleplay, keep character. If topic, continue discussion). Max 3 sentences.",
  "suggestions": {
    "short": "Short response option in English",
    "full": "Full response option in English",
    "advanced": "Advanced response option in English"
  },
  "grammarCorrection": {
    "hasError": true/false,
    "original": "The user's original input",
    "corrected": "The corrected version of the user's input",
    "explanation": "A concise explanation of the grammar/vocabulary errors and why the correction is better (in Vietnamese)",
    "rephrasings": [
      {
        "phrase": "Alternative native-like way to say this",
        "explanation": "Why this phrase sounds natural/native (in Vietnamese)"
      }
    ]
  },
  "pronunciationTips": [
    {
      "word": "Word from user text that has complex phonetics",
      "ipa": "/IPA Phonetic spelling/",
      "tip": "Quick pronunciation tip (in Vietnamese)"
    }
  ],
  "roleplayTasks": {
    "completedIndex": number or null
  },
  "topicWordsUsed": ["word1", "word2"]
}
`;

      const prompt = `
Chat History:
${formattedHistory}

User's spoken text: "${userText}"

Response JSON:
`;

      // Thu thập các API keys có cấu hình để xác định số lần thử tối đa
      const keys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
        process.env.GEMINI_API_KEY
      ].filter(k => k && k.trim() !== '' && k !== 'your_gemini_api_key_here' && k !== 'your_api_key_here');

      const maxAttempts = keys.length > 0 ? keys.length : 1;
      let lastError = null;
      let responseText = null;

      outerLoop:
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const clientGenAI = getGenAIClient();
        if (!clientGenAI) {
          throw new Error("No active API keys found");
        }

        // Cascade fallback các model khả dụng
        const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

        for (const modelName of modelsToTry) {
          try {
            console.log(`Calling model: ${modelName} with current API key (Timeout 30s)`);
            const model = clientGenAI.getGenerativeModel({ model: modelName });
            
            // Tạo Promise chờ 30 giây để tránh đứng treo
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Model ${modelName} request timed out after 30 seconds`)), 30000)
            );

            const generatePromise = model.generateContent({
              contents: [{ role: 'user', parts: [{ text: systemInstruction + '\n' + prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            });

            // Race giữa fetch và timeout
            const result = await Promise.race([generatePromise, timeoutPromise]);
            responseText = result.response.text();
            if (responseText) {
              console.log(`Success calling model ${modelName} with current API key`);
              break outerLoop; // Thoát cả 2 vòng lặp khi thành công
            }
          } catch (e) {
            console.warn(`Model ${modelName} failed or timed out: ${e.message}`);
            lastError = e;

            // Kiểm tra xem lỗi có phải cấp độ API Key hay không (hết quota, hết hạn, hoặc timeout)
            const isKeyLevel = e.message.includes('429') || 
                               e.message.includes('Too Many Requests') ||
                               e.message.includes('503') || 
                               e.message.includes('Service Unavailable') ||
                               e.message.includes('401') || 
                               e.message.includes('403') || 
                               e.message.includes('API key') ||
                               e.message.includes('timed out');
            
            if (isKeyLevel) {
              console.log(`Key level error or timeout detected. Switching to next API key...`);
              break; // Thoát khỏi vòng lặp model để chuyển sang API key khác ở vòng ngoài
            }
          }
        }
      }

      if (!responseText) {
        throw lastError || new Error("All Gemini models and API keys failed to respond.");
      }

      evaluationResult = cleanAndParseJSON(responseText);
    }

    // Nếu KHÔNG phải giọng nói (chỉ gõ text), xóa toàn bộ chẩn đoán phát âm sai
    if (!isVoiceInput) {
      evaluationResult.pronunciationTips = [];
    }

    // 1. Lưu tin nhắn của user kèm chẩn đoán lỗi vào database
    await query(
      'INSERT INTO chat_messages (user_id, sender, text, evaluation) VALUES ($1, $2, $3, $4)',
      [userId, 'user', userText, JSON.stringify(evaluationResult)]
    );

    // 2. Lưu tin nhắn phản hồi của AI kèm suggestions vào database
    await query(
      'INSERT INTO chat_messages (user_id, sender, text, suggestions) VALUES ($1, $2, $3, $4)',
      [userId, 'ai', evaluationResult.aiResponse, JSON.stringify(evaluationResult.suggestions)]
    );

    res.json(evaluationResult);

  } catch (error) {
    console.error('Error in chat processing:', error);
    
    // Fallback response mock khi có lỗi xảy ra
    const fallbackResult = getMockResponse(userText, contextMode, contextDetails);
    if (!isVoiceInput) {
      fallbackResult.pronunciationTips = [];
    }

    try {
      await query(
        'INSERT INTO chat_messages (user_id, sender, text, evaluation) VALUES ($1, $2, $3, $4)',
        [userId, 'user', userText, JSON.stringify(fallbackResult)]
      );
      await query(
        'INSERT INTO chat_messages (user_id, sender, text, suggestions) VALUES ($1, $2, $3, $4)',
        [userId, 'ai', fallbackResult.aiResponse, JSON.stringify(fallbackResult.suggestions)]
      );
    } catch (dbErr) {
      console.error('Failed to save fallback chat to DB:', dbErr);
    }

    res.json(fallbackResult);
  }
});


// ==========================================
// 3. ENDPOINTS SỔ TAY VÀ FLASHCARD (CRUD API)
// ==========================================

// Lấy danh sách sổ tay của user
app.get('/api/notebook', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const notebookItems = await query(
      'SELECT id, original, corrected, explanation, ipa, type, saved_at AS "savedAt" FROM notebook WHERE user_id = $1 ORDER BY saved_at DESC',
      [userId]
    );
    res.json(notebookItems.rows);
  } catch (error) {
    console.error('Error fetching notebook:', error);
    res.status(500).json({ error: 'Failed to fetch notebook.' });
  }
});

// Lưu từ vựng/câu vào sổ tay
app.post('/api/notebook', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { original, corrected, explanation, ipa, type } = req.body;

  if (!original) {
    return res.status(400).json({ error: 'Original text is required.' });
  }

  try {
    // Kiểm tra xem đã tồn tại chưa
    const duplicate = await query(
      'SELECT id FROM notebook WHERE user_id = $1 AND LOWER(TRIM(original)) = LOWER(TRIM($2))',
      [userId, original]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'This item already exists in your notebook.' });
    }

    // 1. Lưu vào bảng notebook
    const notebookResult = await query(
      `INSERT INTO notebook (user_id, original, corrected, explanation, ipa, type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, original, corrected, explanation, ipa, type, saved_at AS "savedAt"`,
      [userId, original, corrected || '', explanation || '', ipa || '', type || 'sentence']
    );

    const savedItem = notebookResult.rows[0];

    // 2. Tạo Flashcard tương ứng để ôn tập (Shadowing)
    await query(
      `INSERT INTO flashcards (user_id, notebook_id, front, back, ipa, next_review_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [userId, savedItem.id, corrected || original, explanation || 'Practice shadowing this item.', ipa]
    );

    res.status(201).json(savedItem);
  } catch (error) {
    console.error('Error saving to notebook:', error);
    res.status(500).json({ error: 'Failed to save item.' });
  }
});

// Xóa từ vựng/câu khỏi sổ tay
app.delete('/api/notebook/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const notebookId = req.params.id;

  try {
    const result = await query(
      'DELETE FROM notebook WHERE id = $1 AND user_id = $2 RETURNING id',
      [notebookId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found or unauthorized.' });
    }

    res.json({ message: 'Deleted successfully.', id: notebookId });
  } catch (error) {
    console.error('Error deleting from notebook:', error);
    res.status(500).json({ error: 'Failed to delete item.' });
  }
});

// Lấy danh sách flashcards đến hạn ôn tập
app.get('/api/flashcards/due', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const dueCards = await query(
      `SELECT id, front, back, ipa, repetitions, interval, ease_factor AS "easeFactor", next_review_date AS "nextReviewDate"
       FROM flashcards 
       WHERE user_id = $1 AND next_review_date <= CURRENT_TIMESTAMP`,
      [userId]
    );
    res.json(dueCards.rows);
  } catch (error) {
    console.error('Error fetching due flashcards:', error);
    res.status(500).json({ error: 'Failed to fetch due flashcards.' });
  }
});

// Cập nhật lịch ôn tập flashcard (Thuật toán SM-2)
app.post('/api/flashcards/review', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { cardId, grade } = req.body; // grade từ 0 đến 5

  if (cardId === undefined || grade === undefined) {
    return res.status(400).json({ error: 'cardId and grade are required.' });
  }

  try {
    // Lấy thẻ flashcard
    const cardResult = await query(
      'SELECT id, repetitions, interval, ease_factor FROM flashcards WHERE id = $1 AND user_id = $2',
      [cardId, userId]
    );

    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Flashcard not found.' });
    }

    const card = cardResult.rows[0];
    let { repetitions, interval } = card;
    let easeFactor = parseFloat(card.ease_factor);

    // Thuật toán SM-2 điều khiển Ease Factor (EF)
    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < 1.3) {
      easeFactor = 1.3;
    }

    // Tính toán số lần lặp và khoảng cách ngày tiếp theo
    if (grade < 3) {
      repetitions = 0;
      interval = 1;
    } else {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 3; // Lần 2 ôn sau 3 ngày
      } else if (repetitions === 2) {
        interval = 7; // Lần 3 ôn sau 7 ngày
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
    }

    // Tính toán ngày ôn tập tiếp theo
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    // Cập nhật vào DB
    const updatedCard = await query(
      `UPDATE flashcards 
       SET repetitions = $1, interval = $2, ease_factor = $3, next_review_date = $4
       WHERE id = $5 RETURNING id, front, back, ipa, repetitions, interval, ease_factor AS "easeFactor", next_review_date AS "nextReviewDate"`,
      [repetitions, interval, easeFactor, nextReview.toISOString(), cardId]
    );

    res.json(updatedCard.rows[0]);
  } catch (error) {
    console.error('Error updating flashcard schedule:', error);
    res.status(500).json({ error: 'Failed to update review schedule.' });
  }
});

// Hàm làm sạch và parse chuỗi JSON từ LLM tránh các ký tự rác hoặc khối markdown
function cleanAndParseJSON(text) {
  let cleanText = text.trim();
  
  // Loại bỏ các thẻ code block markdown (```json ... ``` hoặc ``` ... ```)
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '');
    cleanText = cleanText.replace(/\s*```$/, '');
  }
  
  // Tìm khối ngoặc nhọn đầu tiên và cuối cùng để trích xuất JSON thuần
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }
  
  return JSON.parse(cleanText);
}

// ==========================================
// HÀM MOCK FALLBACK (KHI CHƯA CÓ GEMINI KEY)
// ==========================================
function getMockResponse(userText, contextMode, contextDetails) {
  const lowercaseInput = userText.toLowerCase();
  
  let aiResponse = "That sounds very interesting! Could you tell me more about that?";
  let shortSug = "Yes, of course.";
  let fullSug = "I would love to tell you more about it when we have time.";
  let advSug = "To be quite frank, it's something I've been giving a lot of thought to recently.";
  let hasError = false;
  let corrected = userText;
  let explanation = "Không phát hiện lỗi ngữ pháp rõ ràng. Câu nói của bạn rất tốt!";
  let rephrasings = [
    { phrase: `In other words, ${userText}`, explanation: "Cách nói lại để nhấn mạnh ý kiến." }
  ];
  let pronunciationTips = [];
  let completedIndex = null;
  let topicWordsUsed = [];

  if (lowercaseInput.includes("have ever gone") || lowercaseInput.includes("ever gone to")) {
    hasError = true;
    corrected = userText.replace(/have ever gone to|ever gone to/gi, "have been to");
    explanation = "Khi nói về việc đã từng đi đâu đó và đã trở về, chúng ta sử dụng cấu trúc 'have been to' thay vì 'have gone to'. 'Have gone to' ngụ ý người đó đi và chưa trở về.";
    rephrasings = [
      { phrase: "I have been to Paris twice.", explanation: "Cách nói chuẩn xác và tự nhiên để chia sẻ trải nghiệm." },
      { phrase: "I've traveled to Paris before.", explanation: "Sử dụng động từ travel để nói rõ mục đích du lịch." }
    ];
  } else if (lowercaseInput.includes("he don't") || lowercaseInput.includes("she don't") || lowercaseInput.includes("it don't")) {
    hasError = true;
    corrected = userText.replace(/don't/gi, "doesn't");
    explanation = "Với ngôi thứ ba số ít (he, she, it), chúng ta phải sử dụng trợ động từ phủ định 'doesn't' thay vì 'don't'.";
  }

  const words = userText.split(/\s+/);
  words.forEach(w => {
    const cleanW = w.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanW === 'determine') {
      pronunciationTips.push({
        word: 'determine',
        ipa: '/dɪˈtɜː.mɪn/',
        tip: 'Trọng âm rơi vào âm tiết thứ hai. Âm cuối là /mɪn/, không phải /maɪn/.'
      });
    } else if (cleanW === 'schedule') {
      pronunciationTips.push({
        word: 'schedule',
        ipa: '/ˈʃedj.uːl/ hoặc /ˈskedʒ.uːl/',
        tip: 'Anh-Anh thường đọc là /ʃ/, Anh-Mỹ thường đọc là /sk/.'
      });
    } else if (cleanW === 'comfortable') {
      pronunciationTips.push({
        word: 'comfortable',
        ipa: '/ˈkʌm.fə.tə.bəl/',
        tip: 'Trọng âm rơi vào âm thứ nhất. Đọc lướt chữ "or" thành âm câm: "cumf-ta-ble".'
      });
    }
  });

  if (pronunciationTips.length === 0 && words.length > 0) {
    const longWords = words.filter(w => w.length > 6);
    if (longWords.length > 0) {
      const selectedWord = longWords[0].replace(/[^a-zA-Z]/g, '');
      pronunciationTips.push({
        word: selectedWord,
        ipa: `/${selectedWord.toLowerCase()}/`,
        tip: `Hãy lưu ý phát âm rõ nét các âm tiết và trọng âm của từ "${selectedWord}".`
      });
    }
  }

  if (contextMode === 'roleplay') {
    const role = contextDetails.role || 'receptionist';
    if (role.includes('receptionist') || role.includes('khách sạn')) {
      aiResponse = "Welcome to the Grand Plaza Hotel! How can I assist you today?";
      shortSug = "I'd like to check in, please.";
      fullSug = "Hello, I have a reservation under my name and I'd like to check in.";
      advSug = "Hi there, checking in. The reservation should be under my name, is my room ready?";
      
      if (lowercaseInput.includes("check in") || lowercaseInput.includes("reservation")) completedIndex = 0;
      else if (lowercaseInput.includes("breakfast") || lowercaseInput.includes("eat")) completedIndex = 1;
      else if (lowercaseInput.includes("key") || lowercaseInput.includes("card")) completedIndex = 2;
    }
  } else if (contextMode === 'topic') {
    const topic = contextDetails.topicName || 'Gym';
    const vocab = contextDetails.coreVocabulary || [];
    aiResponse = `Yes! Licking your goals in ${topic} is all about consistency. How often do you hit your fitness routine?`;
    
    vocab.forEach(word => {
      if (lowercaseInput.includes(word.toLowerCase())) {
        topicWordsUsed.push(word);
      }
    });
  }

  return {
    aiResponse,
    suggestions: {
      short: shortSug,
      full: fullSug,
      advanced: advSug
    },
    grammarCorrection: {
      hasError,
      original: userText,
      corrected,
      explanation,
      rephrasings
    },
    pronunciationTips,
    roleplayTasks: {
      completedIndex
    },
    topicWordsUsed
  };
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
