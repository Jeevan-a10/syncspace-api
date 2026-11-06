const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  getRoomMessages,
  postRoomMessage,
  saveMessageDirect,
  _resetInMemoryMessages,
} = require('../src/controllers/messageController');

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

describe('Message Controller', () => {
  beforeEach(() => {
    _resetInMemoryMessages();
  });

  test('getRoomMessages returns message history for a room', async () => {
    const req = { params: { roomId: 'general-hq' }, query: {} };
    const res = createMockRes();
    await getRoomMessages(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.data));
    assert.equal(res.jsonData.data[0].sender, 'System Bot');
  });

  test('postRoomMessage creates and returns a new chat message', async () => {
    const req = {
      params: { roomId: 'general-hq' },
      body: {
        sender: 'Jeevan',
        content: 'Hey team, reviewing the Socket.io PR now!',
        messageType: 'chat',
      },
    };
    const res = createMockRes();
    await postRoomMessage(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.data.sender, 'Jeevan');
    assert.equal(res.jsonData.data.content, 'Hey team, reviewing the Socket.io PR now!');
    assert.ok(res.jsonData.data.timestamp);
  });

  test('saveMessageDirect helper persists message directly for socket engine', async () => {
    const msg = await saveMessageDirect('general-hq', 'Socket Bot', 'Ping from socket', 'chat');

    assert.equal(msg.sender, 'Socket Bot');
    assert.equal(msg.content, 'Ping from socket');
    assert.equal(msg.roomId, 'general-hq');
  });
});
