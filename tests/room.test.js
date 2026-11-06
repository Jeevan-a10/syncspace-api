const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  getRooms,
  getRoomById,
  createRoom,
  deleteRoom,
  getRoomStats,
  _resetInMemoryRooms,
} = require('../src/controllers/roomController');

const createMockRes = () => {
  const res = {
    statusCode: 200,
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

describe('Room Controller', () => {
  beforeEach(() => {
    _resetInMemoryRooms();
  });

  test('getRooms returns seeded workspace rooms', async () => {
    const req = { query: {} };
    const res = createMockRes();
    await getRooms(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.data));
    assert.ok(res.jsonData.total >= 2);
  });

  test('getRooms filters by topic', async () => {
    const req = { query: { topic: 'architecture' } };
    const res = createMockRes();
    await getRooms(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.length >= 1);
    assert.ok(res.jsonData.data.every((r) => r.topic === 'architecture'));
  });

  test('getRooms filters by search keyword q', async () => {
    const req = { query: { q: 'Headquarters' } };
    const res = createMockRes();
    await getRooms(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.length, 1);
    assert.equal(res.jsonData.data[0].roomId, 'general-hq');
  });

  test('getRoomById returns specific room when exists', async () => {
    const req = { params: { roomId: 'general-hq' } };
    const res = createMockRes();
    await getRoomById(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.roomId, 'general-hq');
    assert.equal(res.jsonData.data.name, 'General Headquarters');
  });

  test('getRoomById returns 404 for non-existent room', async () => {
    const req = { params: { roomId: 'non-existent-xyz' } };
    const res = createMockRes();
    await getRoomById(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /not found/i);
  });

  test('createRoom successfully adds a new workspace room', async () => {
    const req = {
      body: {
        roomId: 'frontend-standup',
        name: 'Frontend Daily Standup',
        description: 'Morning sync for UI/UX developers',
        topic: 'standup',
        createdBy: 'jeevan',
        maxParticipants: 25,
      },
    };
    const res = createMockRes();
    await createRoom(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.roomId, 'frontend-standup');
    assert.equal(res.jsonData.data.name, 'Frontend Daily Standup');
  });

  test('createRoom rejects duplicate roomId', async () => {
    const req = {
      body: {
        roomId: 'general-hq',
        name: 'Duplicate General',
      },
    };
    const res = createMockRes();
    await createRoom(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.error, /already exists/i);
  });

  test('getRoomStats aggregates room metrics and topic counts', async () => {
    const req = {};
    const res = createMockRes();
    await getRoomStats(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(res.jsonData.data.totalRooms >= 2);
    assert.ok(typeof res.jsonData.data.byTopic === 'object');
    assert.ok(res.jsonData.data.byTopic.general >= 1);
  });

  test('deleteRoom deletes existing room and returns success', async () => {
    const req = { params: { roomId: 'architecture-review' } };
    const res = createMockRes();
    await deleteRoom(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.match(res.jsonData.message, /deleted successfully/i);

    // Verify it is gone
    const verifyReq = { params: { roomId: 'architecture-review' } };
    const verifyRes = createMockRes();
    await getRoomById(verifyReq, verifyRes, () => {});
    assert.equal(verifyRes.statusCode, 404);
  });
});
