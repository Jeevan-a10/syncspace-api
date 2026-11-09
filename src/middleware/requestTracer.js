const crypto = require('crypto');

/**
 * Request Tracing Middleware
 * Injects X-Request-Id and attaches high-resolution X-Response-Time header
 */
const requestTracer = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = process.hrtime.bigint();

  // Calculate and set X-Response-Time before headers are sent
  const originalEnd = res.end;
  res.end = function (...args) {
    if (!res.headersSent) {
      const elapsedNs = process.hrtime.bigint() - start;
      const elapsedMs = (Number(elapsedNs) / 1e6).toFixed(2);
      res.setHeader('X-Response-Time', `${elapsedMs}ms`);
    }
    return originalEnd.apply(this, args);
  };

  next();
};

module.exports = requestTracer;
