import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query, initDb } from './db.js';
import { Communicate } from 'edge-tts-universal';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize database
initDb().then(() => {
  console.log('Database initialized.');
}).catch(err => {
  console.error('Database initialization failed:', err);
});

// ─── Groq model round-robin ───────────────────────────────────────────────
let modelCounter = 0;
const GROQ_MODELS = ['llama-3.1-8b-instant', 'qwen/qwen3-32b', 'groq/compound-mini'];

async function callGroq(messages, jsonMode = true) {
  const hasKey = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '';
  if (!hasKey) throw new Error('GROQ_API_KEY not configured');

  const startIndex = modelCounter % GROQ_MODELS.length;
  modelCounter++;
  let lastError = null;

  for (let i = 0; i < GROQ_MODELS.length; i++) {
    const modelName = GROQ_MODELS[(startIndex + i) % GROQ_MODELS.length];
    try {
      console.log(`[Groq] Calling model: ${modelName}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const body = {
        model: modelName,
        messages,
        temperature: 0.7,
      };
      if (jsonMode) body.response_format = { type: 'json_object' };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errBody}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (content) {
        console.log(`[Groq] Success with model: ${modelName}`);
        return content;
      }
    } catch (e) {
      console.warn(`[Groq] Model ${modelName} failed: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError || new Error('All Groq models failed');
}

function cleanAndParseJSON(text) {
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleanText);
}

function formatRate(rate) {
  const num = parseFloat(rate);
  if (isNaN(num)) return '+0%';
  const percent = Math.round((num - 1) * 100);
  return percent >= 0 ? `+${percent}%` : `${percent}%`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. SESSIONS API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/sessions — list all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, topic_description, session_type, started_at, ended_at, duration_seconds, status
       FROM sessions ORDER BY started_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
});

// POST /api/sessions — create new session
app.post('/api/sessions', async (req, res) => {
  const { topic_description, session_type = 'free-talk' } = req.body;
  try {
    const result = await query(
      `INSERT INTO sessions (topic_description, session_type)
       VALUES ($1, $2)
       RETURNING id, topic_description, session_type, started_at, status`,
      [topic_description || 'Free conversation', session_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session.' });
  }
});

// DELETE /api/sessions/:id — delete session + messages (cascade)
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Session deleted.' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session.' });
  }
});

// POST /api/sessions/:id/end — end session and run post-session analysis
app.post('/api/sessions/:id/end', async (req, res) => {
  const sessionId = req.params.id;
  try {
    // Mark session as completed and calculate duration
    await query(
      `UPDATE sessions
       SET status = 'completed',
           ended_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE id = $1`,
      [sessionId]
    );

    // Get all user messages from this session for analysis
    const messagesResult = await query(
      `SELECT sender, text, timestamp FROM chat_messages
       WHERE session_id = $1 ORDER BY timestamp ASC`,
      [sessionId]
    );

    const messages = messagesResult.rows;
    const userMessages = messages.filter(m => m.sender === 'user');

    if (userMessages.length === 0) {
      return res.json({ message: 'Session ended. No messages to analyze.' });
    }

    // Build transcript for analysis
    const transcript = messages.map(m =>
      `${m.sender === 'user' ? 'User' : 'AI'}: ${m.text}`
    ).join('\n');

    // Call Groq for post-session analysis
    const analysisPrompt = `Analyze this English speaking practice session transcript.
The user is a Vietnamese native speaker at A2-B1 speaking level.

TRANSCRIPT:
${transcript}

Return a JSON object with this exact structure:
{
  "fluency_score": <integer 0-100>,
  "vocab_range_score": <integer 0-100>,
  "grammar_score": <integer 0-100>,
  "avg_response_length": <average words per user turn as number>,
  "repeated_words": [{"word": "string", "count": <integer>}],
  "error_patterns": [{"type": "string (e.g. article/preposition/tense/subject-verb)", "example": "string", "correction": "string"}],
  "chunks_detected": ["chunk1", "chunk2"],
  "active_words_used": ["word1", "word2"],
  "summary": "2-3 sentence coaching feedback in English, encouraging but specific"
}

Focus on the user's turns only for scoring. Be fair and constructive.`;

    let analysis;
    try {
      const rawAnalysis = await callGroq([
        { role: 'user', content: analysisPrompt }
      ], true);
      analysis = cleanAndParseJSON(rawAnalysis);
    } catch (e) {
      console.error('Analysis Groq call failed:', e);
      // Fallback minimal analysis
      analysis = {
        fluency_score: 60,
        vocab_range_score: 55,
        grammar_score: 60,
        avg_response_length: userMessages.reduce((sum, m) => sum + m.text.split(/\s+/).length, 0) / userMessages.length,
        repeated_words: [],
        error_patterns: [],
        chunks_detected: [],
        active_words_used: [],
        summary: 'Great effort today! Keep practicing to improve your fluency and vocabulary range.'
      };
    }

    // Save analysis to DB
    await query(
      `INSERT INTO session_analysis
         (session_id, fluency_score, vocab_range_score, grammar_score,
          avg_response_length, repeated_words, error_patterns,
          chunks_detected, active_words_used, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        sessionId,
        analysis.fluency_score,
        analysis.vocab_range_score,
        analysis.grammar_score,
        analysis.avg_response_length,
        JSON.stringify(analysis.repeated_words || []),
        JSON.stringify(analysis.error_patterns || []),
        JSON.stringify(analysis.chunks_detected || []),
        JSON.stringify(analysis.active_words_used || []),
        analysis.summary
      ]
    );

    // Auto-save detected chunks to chunks table
    if (analysis.chunks_detected && analysis.chunks_detected.length > 0) {
      for (const chunk of analysis.chunks_detected) {
        if (typeof chunk === 'string' && chunk.trim()) {
          await query(
            `INSERT INTO chunks (chunk, source_session_id, use_count)
             VALUES ($1, $2, 1)
             ON CONFLICT (chunk) DO UPDATE SET use_count = chunks.use_count + 1, last_used_at = NOW()`,
            [chunk.trim().toLowerCase(), sessionId]
          );
        }
      }
    }

    res.json({ message: 'Session ended and analyzed.', analysis });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session.' });
  }
});

// GET /api/sessions/:id/report — fetch stored analysis
app.get('/api/sessions/:id/report', async (req, res) => {
  try {
    const result = await query(
      `SELECT sa.*, s.topic_description, s.duration_seconds, s.started_at
       FROM session_analysis sa
       JOIN sessions s ON sa.session_id = s.id
       WHERE sa.session_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CHAT API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/chat/history — fetch messages for a session
app.get('/api/chat/history', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId query parameter is required.' });
  }
  try {
    const history = await query(
      `SELECT sender, text, suggestions, timestamp
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY timestamp ASC LIMIT 100`,
      [sessionId]
    );
    res.json(history.rows);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
});

// DELETE /api/chat/history/:sessionId — clear messages in a session
app.delete('/api/chat/history/:sessionId', async (req, res) => {
  try {
    await query('DELETE FROM chat_messages WHERE session_id = $1', [req.params.sessionId]);
    res.json({ message: 'Chat history cleared.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear chat history.' });
  }
});

// POST /api/chat — main AI conversation endpoint
app.post('/api/chat', async (req, res) => {
  const {
    userText,
    sessionId,
    sessionType = 'free-talk',
    topicDescription = '',
    chatHistory = [],
    isVoiceInput = false,
    drillTarget = null   // { text: 'build confidence', type: 'chunk' }
  } = req.body;

  if (!userText || userText.trim() === '') {
    return res.status(400).json({ error: 'User text is required.' });
  }
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  const formattedHistory = chatHistory.map(msg =>
    `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`
  ).join('\n');

  // Fetch today's mission targets and top unmastered chunks for injection
  let targetWordsList = [];
  let topChunksList = [];
  let isStorytellingTriggered = false;
  if (sessionType !== 'drill') {
    try {
      const missionRes = await query(
        `SELECT word FROM word_usage WHERE mastered = FALSE AND use_count <= 2 ORDER BY use_count ASC, last_used_at ASC LIMIT 4`
      );
      targetWordsList = missionRes.rows.map(r => r.word);

      const chunksRes = await query(
        `SELECT chunk FROM chunks WHERE mastered = FALSE ORDER BY use_count DESC LIMIT 5`
      );
      topChunksList = chunksRes.rows.map(r => r.chunk);

      // Check if user has had several turns already (e.g. 8 messages / 4 turns in this session)
      const countRes = await query(
        `SELECT COUNT(*) as count FROM chat_messages WHERE session_id = $1`,
        [sessionId]
      );
      const msgCount = parseInt(countRes.rows[0].count);
      if (msgCount >= 8) {
        isStorytellingTriggered = true;
      }
    } catch (err) {
      console.error('Error fetching mission words or chunks for system prompt:', err);
    }
  }

  // ── Build system prompt ──────────────────────────────────────────────────
  let systemPrompt;

  if (sessionType === 'drill' && drillTarget) {
    // Drill mode — AI must NEVER say the target word
    systemPrompt = `You are an AI English speaking coach running a focused DRILL SESSION.

Target word/chunk the user needs to practice: "${drillTarget.text}"
Your role: Create natural conversation situations that FORCE the user to use this word/chunk themselves.

CRITICAL RULES:
1. NEVER say "${drillTarget.text}" yourself. NEVER. Not even to give an example.
2. Ask questions where the most natural answer would include "${drillTarget.text}".
3. If the user uses "${drillTarget.text}" naturally, react positively and deepen the conversation.
4. Keep YOUR responses to 1-2 sentences MAXIMUM — this is drill time, not lecture time.
5. Vary your approach: ask about experiences, opinions, goals, challenges — anything that makes the word feel necessary.
6. Be warm and conversational, like a native English friend, not a teacher.
7. CRITICAL RULE FOR SUGGESTIONS: The suggestions object must contain reply options/templates for the USER to answer YOUR question. They must NOT be questions. They must be statements written from the USER's perspective (using 'I' or 'My') answering the AI's question.
8. SPOTTED ITEMS: Identify 1-2 useful chunks (collocations, phrasal verbs, idioms) or advanced words related to the current context. Return them in the "spottedItems" array.
9. VIETNAMESE INPUT / TRANSLATION REQUESTS: If the user inputs Vietnamese (e.g., they don't know how to express an idea in English, or mix English and Vietnamese), you must:
       a. In "aiResponse": Acknowledge their idea in English, show them how to express their FULL thought naturally in English, and then ask a follow-up question in English. (Do NOT use the drill target word yourself in the aiResponse!).
       b. In "grammarNote": Set "hasError" to true. Set "correction" to the complete and natural English translation of their Vietnamese thought. Set "note" to a brief explanation of the translation/phrasing, starting with "Translation: ".

Your JSON response must follow this schema:
{
  "aiResponse": "Your 1-2 sentence conversational response",
  "suggestions": {
    "short": "A short statement or phrase in English written from the USER's perspective (using 'I' or 'My') answering the AI's question.",
    "full": "A complete sentence in English written from the USER's perspective (using 'I' or 'My') answering the AI's question.",
    "advanced": "An advanced reply option in English written from the USER's perspective (using 'I' or 'My') answering the AI's question, using natural chunks."
  },
  "grammarNote": {
    "hasError": true or false,
    "correction": "Corrected version or natural translation (only if hasError is true)",
    "note": "One brief explanation (only if hasError is true)"
  },
  "targetUsed": true or false,
  "targetUsedCount": 0,
  "spottedItems": [
    {
      "text": "useful English chunk or word",
      "type": "word" or "chunk",
      "meaning": "Brief translation in Vietnamese (e.g. 'đi chơi', 'bầu không khí')"
    }
  ]
}`;
  } else {
    // Free talk mode — dynamic follow-up speaking gym
    systemPrompt = `You are a personal AI English speaking coach and conversation partner.

User Profile:
- Vietnamese native speaker
- Reading/Listening: B1-B2 | Speaking/Grammar: A2-B1
- Core weakness: Passive vocabulary (knows words but cannot use them while speaking)
- Goal: Build speaking fluency, active vocabulary, natural chunk usage

Session Topic: "${topicDescription || 'Open conversation'}"

Coaching Rules:
1. ALWAYS ask a follow-up question based on what the user JUST said — never change topic abruptly.
2. Encourage longer responses: "Tell me more about that..." / "What happened next?" / "Why do you think so?"
3. Naturally model good English chunks in YOUR responses (e.g., "build confidence", "look for opportunities").
4. Keep YOUR responses SHORT (1-2 sentences) — the user must speak more than you.
5. Be warm and encouraging — like a native English friend, not a grammar teacher.
6. If the user makes a grammar error, acknowledge their IDEA first, then gently model the correct form in your reply (don't lecture).
7. CRITICAL RULE FOR SUGGESTIONS: The suggestions object must contain reply options/templates for the USER to answer YOUR question. They must NOT be questions. They must be statements written from the USER's perspective (using 'I' or 'My') answering the AI's question.
8. SPOTTED ITEMS: Identify 1-2 useful chunks (collocations, phrasal verbs, idioms) or advanced words related to the current context. Return them in the "spottedItems" array.
9. VIETNAMESE INPUT / TRANSLATION REQUESTS: If the user inputs Vietnamese (e.g., they don't know how to express an idea in English, or mix English and Vietnamese), you must:
   a. In "aiResponse": Acknowledge their idea in English, show them how to express their FULL thought naturally in English, and then ask a follow-up question in English.
   b. In "grammarNote": Set "hasError" to true. Set "correction" to the complete and natural English translation of their Vietnamese thought. Set "note" to a brief explanation of the translation/phrasing, starting with "Translation: ".

${targetWordsList.length > 0 ? `Today's Activation Targets (guide the user to naturally use these words if relevant): [${targetWordsList.join(', ')}]. If they use one, acknowledge it subtly and positively.` : ''}
${topChunksList.length > 0 ? `Known Chunks to Reinforce (model these naturally in your replies to the user if relevant): [${topChunksList.join(', ')}].` : ''}
${isStorytellingTriggered ? `CRITICAL RULE: The conversation has progressed. Your next response MUST prompt/encourage the user to tell a continuous story or summarize their whole point about this topic in one go (e.g. "Now, try to tell me the whole story in one go..." or "Can you summarize your main points for me?"). Keep your response short and let the user speak.` : ''}

Your JSON response must follow this schema:
{
  "aiResponse": "Your 1-2 sentence conversational response + follow-up question",
  "suggestions": {
    "short": "A short statement or phrase in English written from the USER's perspective (using 'I' or 'My') answering the AI's question.",
    "full": "A complete sentence in English written from the USER's perspective (using 'I' or 'My') answering the AI's question.",
    "advanced": "An advanced reply option in English written from the USER's perspective (using 'I' or 'My') answering the AI's question, using natural chunks."
  },
  "grammarNote": {
    "hasError": true or false,
    "correction": "Corrected version (only if hasError is true)",
    "note": "One brief, kind explanation in English (only if hasError is true)"
  },
  "spottedItems": [
    {
      "text": "useful English chunk or word",
      "type": "word" or "chunk",
      "meaning": "Brief translation in Vietnamese (e.g. 'đi chơi', 'bầu không khí')"
    }
  ]
}`;
  }

  try {
    const rawResponse = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Chat History:\n${formattedHistory}\n\nUser's spoken text: "${userText}"\n\nResponse JSON:` }
    ], true);

    const result = cleanAndParseJSON(rawResponse);

    // Strip pronunciation tips for text input (not voice)
    if (!isVoiceInput) {
      delete result.pronunciationTips;
    }

    // Save user message
    await query(
      `INSERT INTO chat_messages (session_id, sender, text) VALUES ($1, $2, $3)`,
      [sessionId, 'user', userText]
    );

    // Save AI message with suggestions
    await query(
      `INSERT INTO chat_messages (session_id, sender, text, suggestions) VALUES ($1, $2, $3, $4)`,
      [sessionId, 'ai', result.aiResponse, JSON.stringify(result.suggestions)]
    );

    // Update use_count for existing chunks if found in user text
    try {
      const activeChunksRes = await query('SELECT chunk FROM chunks WHERE mastered = FALSE');
      for (const row of activeChunksRes.rows) {
        const chunkText = row.chunk.toLowerCase();
        if (userText.toLowerCase().includes(chunkText)) {
          await query(
            `UPDATE chunks 
             SET use_count = use_count + 1, last_used_at = NOW() 
             WHERE chunk = $1`,
            [row.chunk]
          );
        }
      }
    } catch (err) {
      console.error('Error updating active chunk usage:', err);
    }

    // Update use_count for existing words in user message (no auto-saving new words)
    // Skip updating if the message is primarily Vietnamese (contains Vietnamese accents)
    const hasVietnameseAccents = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(userText);
    if (!hasVietnameseAccents) {
      const contentWords = userText
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3); // skip short function words

      for (const word of contentWords) {
        await query(
          `UPDATE word_usage 
           SET use_count = use_count + 1, last_used_at = NOW()
           WHERE word = $1`,
          [word]
        );
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error in chat processing:', error);
    // Fallback response
    const fallback = {
      aiResponse: "That sounds interesting! Could you tell me a bit more about that?",
      suggestions: {
        short: "Sure, let me explain.",
        full: "Of course! I think the most important thing is...",
        advanced: "Absolutely. To put it another way..."
      },
      grammarNote: { hasError: false }
    };
    await query(
      `INSERT INTO chat_messages (session_id, sender, text) VALUES ($1, $2, $3)`,
      [sessionId, 'user', userText]
    ).catch(() => {});
    await query(
      `INSERT INTO chat_messages (session_id, sender, text) VALUES ($1, $2, $3)`,
      [sessionId, 'ai', fallback.aiResponse]
    ).catch(() => {});
    res.json(fallback);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. TEXT-TO-SPEECH API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/tts', async (req, res) => {
  const { text, rate = '1.0' } = req.query;
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Text query parameter is required.' });
  }
  try {
    const voice = 'en-US-GuyNeural';
    const ttsRate = formatRate(rate);
    console.log(`[TTS] "${text.substring(0, 40)}..." voice=${voice} rate=${ttsRate}`);
    const comm = new Communicate(text, { voice, rate: ttsRate });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio') res.write(chunk.data);
    }
    res.end();
  } catch (error) {
    console.error('[TTS] Error:', error);
    res.status(500).json({ error: 'Failed to generate speech.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. VOCABULARY API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/vocabulary — all tracked words
app.get('/api/vocabulary', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, word, use_count, drill_count, mastered, mastered_at, first_used_at, last_used_at
       FROM word_usage
       ORDER BY use_count DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vocabulary.' });
  }
});

// POST /api/vocabulary — add custom word
app.post('/api/vocabulary', async (req, res) => {
  const { word } = req.body;
  if (!word || !word.trim()) return res.status(400).json({ error: 'Word is required.' });
  try {
    const cleanWord = word.trim().toLowerCase();
    const result = await query(
      `INSERT INTO word_usage (word, use_count, first_used_at, last_used_at)
       VALUES ($1, 0, NOW(), NOW())
       ON CONFLICT (word) DO UPDATE SET word = EXCLUDED.word
       RETURNING id, word, use_count, drill_count, mastered`,
      [cleanWord]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding word:', error);
    res.status(500).json({ error: 'Failed to add word.' });
  }
});

// DELETE /api/vocabulary/:id — delete a word
app.delete('/api/vocabulary/:id', async (req, res) => {
  try {
    await query('DELETE FROM word_usage WHERE id = $1', [req.params.id]);
    res.json({ message: 'Word deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete word.' });
  }
});

// GET /api/chunks — all detected chunks
app.get('/api/chunks', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, chunk, use_count, drill_count, mastered, mastered_at, first_seen_at, last_used_at
       FROM chunks
       ORDER BY use_count DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chunks.' });
  }
});

// POST /api/chunks — add custom chunk
app.post('/api/chunks', async (req, res) => {
  const { chunk } = req.body;
  if (!chunk || !chunk.trim()) return res.status(400).json({ error: 'Chunk is required.' });
  try {
    const cleanChunk = chunk.trim().toLowerCase();
    const result = await query(
      `INSERT INTO chunks (chunk, use_count, first_seen_at, last_used_at)
       VALUES ($1, 0, NOW(), NOW())
       ON CONFLICT (chunk) DO UPDATE SET chunk = EXCLUDED.chunk
       RETURNING id, chunk, use_count, drill_count, mastered`,
      [cleanChunk]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding chunk:', error);
    res.status(500).json({ error: 'Failed to add chunk.' });
  }
});

// DELETE /api/chunks/:id — delete a chunk
app.delete('/api/chunks/:id', async (req, res) => {
  try {
    await query('DELETE FROM chunks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Chunk deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete chunk.' });
  }
});

// GET /api/missions/today — top passive words to activate today
app.get('/api/missions/today', async (req, res) => {
  try {
    // Words with low use count (passive) that haven't been mastered
    const result = await query(
      `SELECT word, use_count, drill_count
       FROM word_usage
       WHERE mastered = FALSE AND use_count <= 2
       ORDER BY use_count ASC, last_used_at ASC
       LIMIT 4`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mission.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. DRILL API
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/drill/start — start a drill session with a target word/chunk
app.post('/api/drill/start', async (req, res) => {
  const { target, type = 'word' } = req.body;
  if (!target) return res.status(400).json({ error: 'target is required.' });

  try {
    // Ask Groq to generate a natural scenario for this word
    const scenarioPrompt = `A Vietnamese English learner at B1 level needs to practice using the ${type} "${target}" in natural conversation.
Generate a brief, realistic conversation scenario (1 sentence) that would naturally lead the learner to use this ${type}.
Return JSON: { "scenarioHint": "one sentence describing the conversation context" }`;

    let scenarioHint = `Talk naturally and try to use "${target}" in a real sentence.`;
    try {
      const raw = await callGroq([{ role: 'user', content: scenarioPrompt }], true);
      const parsed = cleanAndParseJSON(raw);
      scenarioHint = parsed.scenarioHint || scenarioHint;
    } catch (e) {
      console.warn('[Drill] Scenario generation failed, using default:', e.message);
    }

    // Create drill session record
    const result = await query(
      `INSERT INTO drill_sessions (target_text, target_type, scenario_hint)
       VALUES ($1, $2, $3) RETURNING id, target_text, target_type, scenario_hint`,
      [target, type, scenarioHint]
    );

    // Also create a linked chat session
    const sessionResult = await query(
      `INSERT INTO sessions (topic_description, session_type)
       VALUES ($1, 'drill') RETURNING id`,
      [`Drill: ${target}`]
    );

    res.status(201).json({
      drillId: result.rows[0].id,
      sessionId: sessionResult.rows[0].id,
      target: result.rows[0].target_text,
      type: result.rows[0].target_type,
      scenarioHint: result.rows[0].scenario_hint
    });
  } catch (error) {
    console.error('[Drill] Error starting drill:', error);
    res.status(500).json({ error: 'Failed to start drill session.' });
  }
});

// POST /api/drill/:id/complete — mark drill as done
app.post('/api/drill/:id/complete', async (req, res) => {
  const { selfRated = false, timesUsed = 0, target, type = 'word' } = req.body;

  try {
    await query(
      `UPDATE drill_sessions
       SET completed_at = NOW(), self_mastered = $1, times_target_used = $2
       WHERE id = $3`,
      [selfRated, timesUsed, req.params.id]
    );

    if (target) {
      if (type === 'chunk') {
        await query(
          `UPDATE chunks
           SET drill_count = drill_count + 1,
               mastered = $1,
               mastered_at = CASE WHEN $1 THEN NOW() ELSE mastered_at END
           WHERE chunk = $2`,
          [selfRated, target.toLowerCase()]
        );
      } else {
        await query(
          `UPDATE word_usage
           SET drill_count = drill_count + 1,
               mastered = $1,
               mastered_at = CASE WHEN $1 THEN NOW() ELSE mastered_at END
           WHERE word = $2`,
          [selfRated, target.toLowerCase()]
        );
      }
    }

    res.json({ message: selfRated ? 'Marked as mastered!' : 'Drill session saved.' });
  } catch (error) {
    console.error('[Drill] Error completing drill:', error);
    res.status(500).json({ error: 'Failed to complete drill.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. PROGRESS API
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/progress/summary
app.get('/api/progress/summary', async (req, res) => {
  try {
    const [sessionsRes, vocabRes, chunksRes, analysisRes] = await Promise.all([
      query(`SELECT COUNT(*) as total,
                    SUM(duration_seconds) as total_seconds,
                    MAX(duration_seconds) as longest_seconds
             FROM sessions WHERE status = 'completed'`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE mastered) as mastered_count FROM word_usage`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE mastered) as mastered_count FROM chunks`),
      query(`SELECT AVG(fluency_score) as avg_fluency,
                    AVG(vocab_range_score) as avg_vocab,
                    AVG(avg_response_length) as avg_response_length
             FROM session_analysis`)
    ]);

    res.json({
      sessions: {
        total: parseInt(sessionsRes.rows[0].total),
        totalMinutes: Math.round((sessionsRes.rows[0].total_seconds || 0) / 60),
        longestMinutes: Math.round((sessionsRes.rows[0].longest_seconds || 0) / 60)
      },
      vocabulary: {
        total: parseInt(vocabRes.rows[0].total),
        mastered: parseInt(vocabRes.rows[0].mastered_count)
      },
      chunks: {
        total: parseInt(chunksRes.rows[0].total),
        mastered: parseInt(chunksRes.rows[0].mastered_count)
      },
      averages: {
        fluency: Math.round(analysisRes.rows[0].avg_fluency || 0),
        vocab: Math.round(analysisRes.rows[0].avg_vocab || 0),
        responseLength: Math.round(analysisRes.rows[0].avg_response_length || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress.' });
  }
});

// GET /api/progress/errors — aggregated error patterns
app.get('/api/progress/errors', async (req, res) => {
  try {
    const result = await query(
      `SELECT error_patterns FROM session_analysis
       WHERE error_patterns IS NOT NULL AND error_patterns != '[]'::jsonb
       ORDER BY created_at DESC LIMIT 20`
    );

    // Aggregate error types
    const errorMap = {};
    for (const row of result.rows) {
      const patterns = typeof row.error_patterns === 'string'
        ? JSON.parse(row.error_patterns)
        : row.error_patterns;
      for (const p of (patterns || [])) {
        if (p.type) {
          errorMap[p.type] = (errorMap[p.type] || 0) + 1;
        }
      }
    }

    const errors = Object.entries(errorMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    res.json(errors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch error patterns.' });
  }
});

// GET /api/progress/sessions — recent sessions with analysis scores
app.get('/api/progress/sessions', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.id, s.topic_description, s.started_at, s.duration_seconds,
              sa.fluency_score, sa.vocab_range_score, sa.grammar_score,
              sa.avg_response_length, sa.summary
       FROM sessions s
       LEFT JOIN session_analysis sa ON sa.session_id = s.id
       WHERE s.status = 'completed'
       ORDER BY s.started_at DESC LIMIT 30`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session history.' });
  }
});

// ─── Start server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
