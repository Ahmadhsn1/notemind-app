const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-flash-latest';
const MAX_ATTEMPTS = 5;

// Gemini returns transient 429 (rate limit) / 503 (high demand) errors on the
// free tier; retry those with exponential backoff. Other errors fail fast.
const isTransient = (err) => {
  try {
    const code = JSON.parse(err.message).error.code;
    return code === 429 || code === 503;
  } catch {
    return false;
  }
};

const generateContentWithRetry = async (prompt) => {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent({ model: MODEL, contents: prompt });
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
      const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastErr;
};

// Models sometimes wrap JSON responses in markdown code fences despite being
// told not to; strip those before parsing.
const stripJsonFences = (text) =>
  text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

const summarizeAndTag = async (noteBody) => {
  const prompt = `You are a helpful assistant that summarizes notes and suggests tags.

Given the following note, return ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{"summary": "a 2-sentence summary of the note", "tags": ["tag1", "tag2", "tag3"]}

Rules:
- summary must be 2 sentences max
- tags must be an array of 3 short, lowercase, single-word tags
- respond with ONLY the JSON object, nothing else

Note:
${noteBody}`;

  const response = await generateContentWithRetry(prompt);
  const parsed = JSON.parse(stripJsonFences(response.text));

  return {
    summary: parsed.summary || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
};

const answerFromNotes = async (question, notes) => {
  const context = notes
    .map((note, i) => {
      const body = note.body.length > 800 ? `${note.body.slice(0, 800)}...` : note.body;
      return `Note ${i} — "${note.title}":\n${body}`;
    })
    .join('\n\n');

  const prompt = `You are Momo, a friendly assistant built into the Notemind notes app. Your main job is answering questions using ONLY the user's own notes provided below — no outside knowledge for note questions.

You can also exchange a little light small talk (greetings, your name, how you're doing) — keep it brief and warm, a sentence or two.

You are not a general-purpose assistant: politely decline requests to write code, do unrelated tasks, or answer general-knowledge questions that have nothing to do with the user's notes or a quick friendly exchange, and steer the conversation back to their notes.

Return ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{"answer": "your answer here", "usedNoteIndexes": [0, 2]}

Rules:
- For questions about the user's notes: answer using only information found in the notes below. If the notes don't contain enough information, say so plainly in "answer" and return an empty "usedNoteIndexes" array.
- For small talk / greetings / questions about you: respond briefly and warmly, and return an empty "usedNoteIndexes" array.
- For anything else (coding help, unrelated tasks, general knowledge): politely decline and suggest asking about their notes instead, and return an empty "usedNoteIndexes" array.
- "usedNoteIndexes" must list the Note numbers (as shown below) that your answer draws on — only when relevant.
- Keep every answer concise (a few sentences at most).
- respond with ONLY the JSON object, nothing else

Notes:
${context}

Question: ${question}`;

  const response = await generateContentWithRetry(prompt);
  const parsed = JSON.parse(stripJsonFences(response.text));

  return {
    answer: parsed.answer || '',
    usedNoteIndexes: Array.isArray(parsed.usedNoteIndexes) ? parsed.usedNoteIndexes : [],
  };
};

const generateTitle = async (noteBody) => {
  const prompt = `You are a helpful assistant that writes short titles for notes.

Given the following note body, return ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{"title": "a short descriptive title"}

Rules:
- title must be 8 words or fewer
- no surrounding quotes or trailing punctuation in the title itself
- respond with ONLY the JSON object, nothing else

Note body:
${noteBody}`;

  const response = await generateContentWithRetry(prompt);
  const parsed = JSON.parse(stripJsonFences(response.text));

  return parsed.title || '';
};

module.exports = { summarizeAndTag, answerFromNotes, generateTitle };
