const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreateRoom,
  validateRoomIdParam,
  validateUpdateDocument,
  validateCreateMessage,
} = require('../src/middleware/validate');

const createMockRes = () => {
  const res = {
    statusCode: null,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
};

describe('Validation Middleware', () => {
  test('validateCreateRoom rejects missing or short roomId (<3 chars)', () => {
    const req = { body: { roomId: 'ab', name: 'Valid Name' } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateRoom(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /at least 3 characters/i);
    assert.equal(nextCalled, false);
  });

  test('validateCreateRoom rejects invalid roomId characters (uppercase, spaces, special chars)', () => {
    const req = { body: { roomId: 'invalid room!@#', name: 'Valid Name' } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateRoom(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /lowercase alphanumeric/i);
    assert.equal(nextCalled, false);
  });

  test('validateCreateRoom rejects missing or short room name', () => {
    const req = { body: { roomId: 'valid-room', name: ' ' } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateRoom(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /at least 2 characters/i);
    assert.equal(nextCalled, false);
  });

  test('validateCreateRoom rejects invalid topic enum', () => {
    const req = { body: { roomId: 'valid-room', name: 'Valid Name', topic: 'unsupported-topic' } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateRoom(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /Topic must be one of/i);
    assert.equal(nextCalled, false);
  });

  test('validateCreateRoom rejects invalid maxParticipants (< 2 or > 500)', () => {
    const req = { body: { roomId: 'valid-room', name: 'Valid Name', maxParticipants: 1 } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateRoom(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /between 2 and 500/i);
    assert.equal(nextCalled, false);
  });

  test('validateCreateRoom succeeds with valid payload and sanitizes roomId', () => {
    const req = { body: { roomId: 'My-Cool-Room_01', name: '  Engineering Core  ', topic: 'engineering' } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateRoom(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.body.roomId, 'my-cool-room_01');
    assert.equal(req.body.name, 'Engineering Core');
  });

  test('validateRoomIdParam rejects malformed roomId', () => {
    const req = { params: { roomId: 'bad room!' } };
    const res = createMockRes();
    let nextCalled = false;
    validateRoomIdParam(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /Invalid roomId parameter format/i);
    assert.equal(nextCalled, false);
  });

  test('validateUpdateDocument rejects non-string content', () => {
    const req = { body: { content: 12345 } };
    const res = createMockRes();
    let nextCalled = false;
    validateUpdateDocument(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /must be a string/i);
    assert.equal(nextCalled, false);
  });

  test('validateUpdateDocument rejects invalid changeType', () => {
    const req = { body: { content: 'New text', changeType: 'invalid-type' } };
    const res = createMockRes();
    let nextCalled = false;
    validateUpdateDocument(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /changeType must be one of/i);
    assert.equal(nextCalled, false);
  });

  test('validateCreateMessage rejects empty sender or empty content', () => {
    const req = { body: { sender: '', content: '' } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateMessage(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /Sender name is required/i);
    assert.equal(nextCalled, false);
  });

  test('validateCreateMessage rejects message content exceeding 1000 characters', () => {
    const req = { body: { sender: 'Jeevan', content: 'x'.repeat(1001) } };
    const res = createMockRes();
    let nextCalled = false;
    validateCreateMessage(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /cannot exceed 1000 characters/i);
    assert.equal(nextCalled, false);
  });
});
