const crypto = require('crypto');

const requestTracer = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startNs;
    const elapsedMs = (Number(elapsedNs) / 1e6).toFixed(2);
    res.setHeader('X-Response-Time', `${elapsedMs}ms`);
  });

  next();
};

module.exports = requestTracer;
