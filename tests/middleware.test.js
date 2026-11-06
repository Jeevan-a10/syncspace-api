const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const requestTracer = require('../src/middleware/requestTracer');
const errorHandler = require('../src/middleware/errorHandler');

const mockResponse = () => {
  const res = {
    headers: {},
    statusCode: 200,
    body: null,
  };
  res.setHeader = function (key, val) {
    this.headers[key.toLowerCase()] = val;
  };
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.body = data;
    return this;
  };
  res.on = function () {};
  return res;
};

describe('Middleware & Error Handling Suite', () => {
  test('requestTracer generates UUID when no x-request-id header is provided', () => {
    const req = { headers: {} };
    const res = mockResponse();
    let nextCalled = false;

    requestTracer(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.ok(req.id);
    assert.equal(res.headers['x-request-id'], req.id);
  });

  test('requestTracer preserves existing x-request-id header', () => {
    const clientTraceId = 'trace-id-987-custom';
    const req = { headers: { 'x-request-id': clientTraceId } };
    const res = mockResponse();

    requestTracer(req, res, () => {});

    assert.equal(req.id, clientTraceId);
    assert.equal(res.headers['x-request-id'], clientTraceId);
  });

  test('errorHandler handles Mongoose duplicate key error (code 11000)', () => {
    const err = {
      code: 11000,
      keyValue: { roomId: 'existing-room' },
      message: 'Duplicate key',
    };
    const req = {};
    const res = mockResponse();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /already exists/i);
  });

  test('errorHandler handles Mongoose ValidationError', () => {
    const err = {
      name: 'ValidationError',
      errors: {
        name: { message: 'Name must be at least 2 characters' },
        topic: { message: 'Invalid topic' },
      },
    };
    const req = {};
    const res = mockResponse();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Name must be at least 2 characters'));
  });

  test('errorHandler handles Mongoose CastError for bad IDs', () => {
    const err = {
      name: 'CastError',
      path: 'roomId',
    };
    const req = {};
    const res = mockResponse();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Invalid resource format/i);
  });

  test('errorHandler handles JSON body parse SyntaxError', () => {
    const err = new SyntaxError('Unexpected token in JSON');
    err.status = 400;
    err.body = '{ malformed ';
    const req = {};
    const res = mockResponse();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Malformed JSON payload/i);
  });
});
