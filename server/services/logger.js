const pino = require('pino');
const env = require('../config/env');

// Structured logging. The whole production logging surface used to be seven
// raw console.* calls with no request id, user id, latency, status or route —
// so "saving failed around 3pm" was unanswerable.
//
// It also matters *what* gets logged: the old errorHandler did
// `console.error(err)` on the raw error object, and a Mongoose validation
// error embeds the offending document. For this app that means note bodies
// and email addresses in plaintext logs. The redact list below is the
// backstop for that.
const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'body',
      '*.body',
      'contentHtml',
      '*.contentHtml',
      'embedding',
      '*.embedding',
      'credential',
      '*.credential',
      'tempPassword',
      '*.tempPassword',
    ],
    censor: '[redacted]',
  },
  // Pretty output locally; newline-delimited JSON in production, which is
  // what every log aggregator expects.
  ...(env.isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
});

module.exports = logger;
