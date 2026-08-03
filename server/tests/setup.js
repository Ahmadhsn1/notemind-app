// Pinned rather than left to default: mongodb-memory-server's current default
// (8.x) requires macOS 14+, and aborts with SIGABRT on older versions with a
// message that points nowhere useful. 7.0 supports macOS 12+ and every Linux
// distro CI runs on, so the suite works on both without per-machine setup.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';

// Runs before config/env.js is required by anything, so the suite gets a
// self-contained, valid configuration regardless of the developer's .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-to-pass-validation';
process.env.MONGO_URI = 'mongodb://placeholder/test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
// Empty on purpose: no test may make a real, billed Gemini call. The key pool
// degrades to "AI unavailable" (see services/geminiKeyPool.js), which is
// itself the behaviour the AI-adjacent tests assert against.
process.env.GEMINI_API_KEY = '';
process.env.GEMINI_API_KEYS = '';
