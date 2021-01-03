class CustomError extends Error {
  constructor(message, name = null) {
    super();
    Error.captureStackTrace(this, this.constructor);
    this.name = name || 'JOSHMongoProviderError';
    this.message = message;
  }
}

module.exports = CustomError;
