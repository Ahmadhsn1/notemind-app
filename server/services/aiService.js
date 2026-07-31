const { getClient, markExhausted, poolSize } = require('./geminiKeyPool');

const MODEL = 'gemini-flash-latest';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_MAX_CHARS = 8000;
// Capped well below poolSize even with a large pool — each attempt is a
// real network round-trip, and a request can make two of these calls in
// sequence (embed, then generate), so scaling this linearly with pool size
// risks a multi-minute hang if many keys happen to be exhausted at once
// (e.g. keys sharing one underlying quota — see geminiKeyPool.js). 6 gives
// a real key-pool rotation a fair shot without that pathological case.
const MAX_ATTEMPTS = Math.min(6, Math.max(3, poolSize));

const errorCode = (err) => {
  try {
    return JSON.parse(err.message).error.code;
  } catch {
    return null;
  }
};

// 429 (quota exhausted on the key that was used) / 503 (Gemini overloaded,
// unrelated to any specific key) are both worth retrying; anything else
// fails fast. A SyntaxError means Gemini's reply itself was malformed/
// truncated JSON despite the strict-JSON prompt instruction — worth one more
// attempt (possibly on a different key) rather than failing the whole
// request outright.
const isTransient = (err) => [429, 503].includes(errorCode(err)) || err instanceof SyntaxError;

const withRetry = async (operation) => {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { client, key } = getClient();
    try {
      return await operation(client);
    } catch (err) {
      lastErr = err;
      const code = errorCode(err);
      if (code === 429) markExhausted(key, err);
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
      // A 429 means THIS key is out of quota — getClient() above already
      // rotates to a different (non-cooling-down) key on the next attempt,
      // no need to wait first. A 503 is Gemini's own overload, independent
      // of which key made the call, so back off before retrying.
      if (code !== 429) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  throw lastErr;
};

// Parses the reply's JSON inside the retry loop (not after it resolves), so
// a single malformed/truncated JSON reply — Gemini occasionally violates the
// strict-JSON instruction — gets retried (possibly on a different key)
// instead of failing the whole request. See isTransient's SyntaxError case.
const generateJsonWithRetry = (prompt) =>
  withRetry(async (client) => {
    const response = await client.models.generateContent({ model: MODEL, contents: prompt });
    return JSON.parse(stripJsonFences(response.text));
  });

// Streaming counterpart to withRetry, for the one caller (streamAnswerFromNotes)
// that needs tokens as they arrive rather than the full reply at once. Only
// the FIRST chunk goes through the retry/key-rotation loop — Gemini's quota
// check happens before any output is produced, so a 429 always surfaces
// there. Once a chunk has actually reached the caller there's no way to
// invisibly swap keys mid-stream without risking duplicated/garbled output,
// so a failure after that point just propagates and ends the stream instead
// of silently restarting from a different key.
const withRetryStream = async function* (operation) {
  // Every branch of this loop either `break`s (stream started, first chunk
  // in hand) or `throw`s (attempt === MAX_ATTEMPTS is unconditional on the
  // final iteration) — it can never fall through, so `iterator` is always
  // assigned by the time execution reaches the code below the loop.
  let iterator;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { client, key } = getClient();
    try {
      const stream = await operation(client);
      iterator = stream[Symbol.asyncIterator]();
      const first = await iterator.next();
      if (!first.done) yield first.value;
      break;
    } catch (err) {
      const code = errorCode(err);
      if (code === 429) markExhausted(key, err);
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
      if (code !== 429) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  for await (const chunk of iterator) yield chunk;
};

// Used for both note storage (embed on create/update, taskType
// RETRIEVAL_DOCUMENT) and query-time search (embed the question/search
// string, taskType RETRIEVAL_QUERY) — Gemini's embedding model produces
// better-matched vectors when told which side of the pair it's embedding.
// outputDimensionality trims the model's native 3072-dim output down to 768
// (still ample quality for this scale) so per-note storage stays reasonable.
// Local Mongo (not Atlas) means no native $vectorSearch, so callers do an
// in-process cosine-similarity scan — completely fine at personal-app note
// counts.
const EMBEDDING_DIMENSIONS = 768;

const embedText = async (text, taskType = 'RETRIEVAL_DOCUMENT') => {
  const input = (text || '').slice(0, EMBEDDING_MAX_CHARS);
  if (!input.trim()) return [];
  const response = await withRetry((client) =>
    client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: input,
      config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
    })
  );
  return response.embeddings?.[0]?.values || [];
};

const cosineSimilarity = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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

  const parsed = await generateJsonWithRetry(prompt);

  return {
    summary: parsed.summary || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
};

// The model writes its answer as plain text FIRST, then this delimiter, then
// the same structured JSON the non-streaming version used to wrap
// everything in — so the caller can forward answer text to the client the
// moment it arrives, and only needs the complete response to parse the
// metadata tail. Server-controlled and never shown to the user (the
// controller strips it before forwarding text) — see noteController.askNotes.
const STREAM_META_DELIMITER = '\n<<<META>>>\n';

// noteIndex is a lightweight {id, title, tags} listing of ALL of the user's
// active (non-trashed/archived) notes — separate from the detailed `notes`
// context above, which is just the top-K retrieved-as-relevant subset. Momo
// needs the full index to reason about actions like "which of my notes have
// no tags" or "find my two notes about the same thing", since those aren't
// things semantic retrieval on the question text would surface.
//
// Returns an async generator of raw text chunks (answer text, followed by
// STREAM_META_DELIMITER, followed by the metadata JSON) — see
// noteController.askNotes for how those are split and the metadata
// half gets sanitized before anything reaches the client.
const streamAnswerFromNotes = (question, notes, noteIndex = []) => {
  const context = notes
    .map((note, i) => {
      const body = note.body.length > 800 ? `${note.body.slice(0, 800)}...` : note.body;
      return `Note ${i} — "${note.title}":\n${body}`;
    })
    .join('\n\n');

  const indexContext = noteIndex
    .map((n) => `- id=${n.id} title="${n.title}" tags=[${n.tags.join(', ')}]`)
    .join('\n');

  const prompt = `You are Momo, a friendly assistant built into the Notemind notes app. Your main job is answering questions using ONLY the user's own notes provided below — no outside knowledge for note questions.

You can also exchange a little light small talk (greetings, your name, how you're doing) — keep it brief and warm, a sentence or two.

You are not a general-purpose assistant: politely decline requests to write code, do unrelated tasks, or answer general-knowledge questions that have nothing to do with the user's notes or a quick friendly exchange, and steer the conversation back to their notes.

You can also suggest actions for the user to review and confirm — you never perform them yourself, you only propose them when the user's message clearly asks for one (e.g. "tag my untagged notes", "find duplicate notes", "draft a note about X"). Do NOT propose actions for plain questions or small talk.

Respond in exactly this format, in this order, with nothing before or after it:
1. Your answer as plain text only — no markdown, no code fences, no surrounding quotes, no JSON. This is the ONLY part shown to the user, so it must read naturally on its own.
2. On its own line, exactly: <<<META>>>
3. A JSON object (no markdown fences) with exactly these fields: {"usedNoteIndexes": [0, 2], "suggestedActions": []}

Action types you may put in "suggestedActions" (omit the array entirely, i.e. use [], when none apply):
- {"type": "add_tags", "payload": {"noteId": "<id from the note index below>", "tags": ["tag1", "tag2"]}} — only for a note in the index below that has an empty tags list; suggest 2-4 short lowercase tags based on its title.
- {"type": "merge_notes", "payload": {"noteIds": ["<id1>", "<id2>"], "reason": "why these look like duplicates"}} — only when two notes in the index below clearly cover the same topic (judge by title/tags — you don't have their full bodies here).
- {"type": "create_note", "payload": {"title": "a short title", "body": "the drafted note content, plain text, a few sentences"}} — only when the user explicitly asks you to draft/write a new note.

Rules:
- For questions about the user's notes: answer using only information found in the notes below. If the notes don't contain enough information, say so plainly in the answer and return an empty "usedNoteIndexes" array.
- For small talk / greetings / questions about you: respond briefly and warmly, and return an empty "usedNoteIndexes" array.
- For anything else (coding help, unrelated tasks, general knowledge): politely decline and suggest asking about their notes instead, and return an empty "usedNoteIndexes" array.
- "usedNoteIndexes" must list the Note numbers (as shown below) that your answer draws on — only when relevant.
- Every noteId you use in "suggestedActions" MUST come from the note index list below — never invent one.
- Keep every answer concise (a few sentences at most).
- Never omit the <<<META>>> line and the JSON object after it, even when both fields are empty.

Notes:
${context}

Note index (id, title, tags — for action suggestions only):
${indexContext || '(none)'}

Question: ${question}`;

  return withRetryStream((client) => client.models.generateContentStream({ model: MODEL, contents: prompt }));
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

  const parsed = await generateJsonWithRetry(prompt);

  return parsed.title || '';
};

const WRITING_ASSIST_INSTRUCTIONS = {
  continue: 'Continue writing from where the text leaves off, in the same tone and style. Write 1-3 more sentences.',
  improve: 'Rewrite the text to be clearer and better written, keeping the same meaning and roughly the same length.',
  shorten: 'Rewrite the text to be more concise, keeping the key meaning.',
  'fix-grammar': 'Fix any spelling and grammar mistakes in the text, changing wording as little as possible.',
};

const assistWriting = async (action, text) => {
  const instruction = WRITING_ASSIST_INSTRUCTIONS[action];
  if (!instruction) throw new Error(`Unknown writing assist action: ${action}`);

  const prompt = `You are a writing assistant embedded in a notes app. ${instruction}

Return ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{"result": "the rewritten or continued text"}

Rules:
- "result" must be plain text only — no markdown formatting, no HTML tags
- respond with ONLY the JSON object, nothing else

Text:
${text}`;

  const parsed = await generateJsonWithRetry(prompt);

  return parsed.result || '';
};

const generateFlashcards = async (noteBody) => {
  const prompt = `You are a study assistant that creates flashcards from notes.

Given the following note, return ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{"cards": [{"question": "a question testing a key fact or idea", "answer": "the concise answer"}]}

Rules:
- Generate 4 to 8 flashcards covering the most important facts or ideas in the note
- Each question must be answerable using only the note content below — no outside knowledge
- Keep both question and answer concise (1-2 sentences each)
- Skip trivial or filler content — only test genuinely useful recall
- respond with ONLY the JSON object, nothing else

Note:
${noteBody}`;

  const parsed = await generateJsonWithRetry(prompt);

  if (!Array.isArray(parsed.cards)) return [];
  return parsed.cards.filter((c) => c && typeof c.question === 'string' && typeof c.answer === 'string' && c.question.trim() && c.answer.trim());
};

// "Momo's Recap" — a short weekly summary of what the user's been writing
// about, shown on the Dashboard. Same persona as answerFromNotes but no
// question to answer, just an observation over the week's notes.
const generateWeeklyDigest = async (notes) => {
  const context = notes
    .map((note, i) => {
      const body = note.body.length > 500 ? `${note.body.slice(0, 500)}...` : note.body;
      const meta = [note.folder, ...(note.tags || [])].filter(Boolean).join(', ');
      return `Note ${i + 1} — "${note.title}"${meta ? ` [${meta}]` : ''}:\n${body}`;
    })
    .join('\n\n');

  const prompt = `You are Momo, a friendly assistant built into the Notemind notes app. Write a short, warm recap of the notes the user created or edited this week.

Return ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{"recap": "a short 2-4 sentence recap in a warm, encouraging tone"}

Rules:
- Reference at least two concrete, specific details from the notes below (an actual topic, term, folder, or tag) — never generic filler like "your notes" or "your progress"
- Vary your opening line every time — do not default to "You made progress on..." or any other fixed template phrase
- Keep it to 2-4 sentences, written in second person ("you")
- Close with one specific, forward-looking nudge tied to what they actually wrote — not a generic "keep it up"
- respond with ONLY the JSON object, nothing else

This week's notes (${notes.length} total):
${context}`;

  const parsed = await generateJsonWithRetry(prompt);

  return parsed.recap || '';
};

// The daily resurfacing engine's reflection line — Momo commenting on an old
// note being resurfaced, optionally tying it to whatever the user's been
// writing about recently (the "anchor" note that made this old note surface
// in the first place). Same best-effort convention as generateWeeklyDigest:
// callers wrap this in try/catch and treat a thrown error as "no reflection
// today," never as a reason to fail the whole resurfacing endpoint.
const generateResurfaceReflection = async (oldNote, anchorNote) => {
  const oldBody = oldNote.body.length > 600 ? `${oldNote.body.slice(0, 600)}...` : oldNote.body;
  const anchorContext = anchorNote
    ? `\n\nFor context, here's what the user has been writing about recently — "${anchorNote.title}":\n${anchorNote.body.length > 400 ? `${anchorNote.body.slice(0, 400)}...` : anchorNote.body}`
    : '';

  const prompt = `You are Momo, a friendly assistant built into the Notemind notes app. The user is being shown an old note they wrote a while back, resurfaced by the app to help them reconnect with their own past thinking.

Return ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{"reflection": "a short 1-2 sentence reflective comment or question"}

Rules:
- Reference at least one concrete, specific detail actually present in the old note below (an actual topic, term, or phrase) — never generic filler like "this note" or "your thoughts"
- Write in second person ("you"), as a gentle observation or question inviting reflection — not a summary
- If recent context is provided below, you may naturally tie the old note to it, but only if it feels genuine — don't force a connection
- Keep it to 1-2 sentences
- respond with ONLY the JSON object, nothing else

Old note — "${oldNote.title}" (written ${Math.round((Date.now() - new Date(oldNote.createdAt).getTime()) / (24 * 60 * 60 * 1000))} days ago):
${oldBody}${anchorContext}`;

  const parsed = await generateJsonWithRetry(prompt);

  return parsed.reflection || '';
};

module.exports = { summarizeAndTag, streamAnswerFromNotes, STREAM_META_DELIMITER, stripJsonFences, generateTitle, assistWriting, embedText, cosineSimilarity, generateFlashcards, generateWeeklyDigest, generateResurfaceReflection };
