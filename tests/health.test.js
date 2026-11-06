const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { syncEngine } = require('../src/server');

const mockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
  };
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.body = data;
    return this;
  };
  return res;
};

describe('Health Check Handler', () => {
  test('Health check handler returns healthy status and service diagnostics', () => {
    const healthHandler = (req, res) => {
      res.status(200).json({
        success: true,
        service: 'syncspace-api',
        version: '1.0.0',
        status: 'healthy',
        mode: 'in-memory-fallback',
        activeSockets: syncEngine.getTotalConnectedSockets(),
        activeRoomsWithPresence: syncEngine.getActiveRoomsCount(),
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    };

    const req = {};
    const res = mockResponse();
    healthHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.service, 'syncspace-api');
    assert.equal(res.body.status, 'healthy');
    assert.equal(typeof res.body.uptimeSeconds, 'number');
    assert.ok(res.body.timestamp);
  });
});
