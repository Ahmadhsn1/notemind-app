// Thrown by controllers to signal a specific status/message; the global
// error handler (middleware/errorHandler.js) maps it straight to a response.
// Anything else thrown becomes a generic 500 there, instead of leaking
// error.message to the client.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = HttpError;
