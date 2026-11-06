const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const {
  handleConnection,
  getPresence,
  getActiveRoomsCount,
  _resetPresence,
} = require('../src/sockets/syncEngine');
const { _resetInMemoryDocs } = require('../src/controllers/documentController');
const { _resetInMemoryMessages } = require('../src/controllers/messageController');

class MockSocket extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    this.rooms = new Set();
    this.emitted = [];
    this.broadcasts = [];
  }

  join(room) {
    this.rooms.add(room);
  }

  leave(room) {
    this.rooms.delete(room);
  }

  emit(event, ...args) {
    this.emitted.push({ event, args });
    return super.emit(event, ...args);
  }

  to(room) {
    return {
      emit: (event, ...args) => {
        this.broadcasts.push({ room, event, args });
      },
    };
  }
}

describe('Socket.io Real-Time Synchronization Engine', () => {
  beforeEach(() => {
    _resetPresence();
    _resetInMemoryDocs();
    _resetInMemoryMessages();
  });

  test('handleConnection initializes socket with user metadata and palette color', () => {
    const socket = new MockSocket('socket-alpha');
    handleConnection(socket);

    assert.ok(socket.data);
    assert.ok(socket.data.joinedRooms instanceof Set);
    assert.ok(socket.data.color);
    assert.match(socket.data.color, /^#[0-9a-f]{6}$/i);
  });

  test('join-room event joins socket room, registers presence, and emits room-state', async () => {
    const socket = new MockSocket('socket-alpha');
    handleConnection(socket);

    let ackData = null;
    await new Promise((resolve) => {
      socket.emit('join-room', {
        roomId: 'realtime-room',
        user: { id: 'usr-1', name: 'Alpha Dev' },
      }, (res) => {
        ackData = res;
        resolve();
      });
    });

    assert.ok(socket.rooms.has('realtime-room'));
    assert.equal(socket.data.joinedRooms.has('realtime-room'), true);

    const presence = getPresence('realtime-room');
    assert.equal(presence.length, 1);
    assert.equal(presence[0].name, 'Alpha Dev');
    assert.equal(presence[0].socketId, 'socket-alpha');

    assert.ok(ackData);
    assert.equal(ackData.success, true);
    assert.equal(ackData.data.roomId, 'realtime-room');
    assert.ok(ackData.data.document);
  });

  test('join-room broadcasts user-joined event to room peers', async () => {
    const socketA = new MockSocket('socket-a');
    const socketB = new MockSocket('socket-b');
    handleConnection(socketA);
    handleConnection(socketB);

    // Socket A joins first
    await new Promise((resolve) => {
      socketA.emit('join-room', { roomId: 'collab-room', user: { name: 'Alice' } }, resolve);
    });

    // Socket B joins next
    await new Promise((resolve) => {
      socketB.emit('join-room', { roomId: 'collab-room', user: { name: 'Bob' } }, resolve);
    });

    // Check Socket B broadcasted user-joined to room
    const broadcast = socketB.broadcasts.find((b) => b.event === 'user-joined');
    assert.ok(broadcast);
    assert.equal(broadcast.room, 'collab-room');
    assert.equal(broadcast.args[0].user.name, 'Bob');
    assert.equal(broadcast.args[0].participantsCount, 2);
  });

  test('doc-edit broadcasts doc-updated event to room peers with revision version', async () => {
    const socket = new MockSocket('socket-editor');
    handleConnection(socket);

    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: 'editor-room', user: { name: 'Lead Dev' } }, resolve);
    });

    let ackData = null;
    const newContent = '# RFC Document\n\n- Socket events verified\n- High velocity';
    await new Promise((resolve) => {
      socket.emit('doc-edit', {
        roomId: 'editor-room',
        content: newContent,
      }, (res) => {
        ackData = res;
        resolve();
      });
    });

    assert.ok(ackData);
    assert.equal(ackData.success, true);
    assert.ok(ackData.version >= 2);

    const broadcast = socket.broadcasts.find((b) => b.event === 'doc-updated');
    assert.ok(broadcast);
    assert.equal(broadcast.room, 'editor-room');
    assert.equal(broadcast.args[0].content, newContent);
    assert.equal(broadcast.args[0].author, 'Lead Dev');
    assert.ok(broadcast.args[0].version >= 2);
  });

  test('cursor-move broadcasts cursor coordinates to peers and updates presence', async () => {
    const socket = new MockSocket('socket-cursor');
    handleConnection(socket);

    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: 'canvas-room', user: { name: 'Designer' } }, resolve);
    });

    socket.emit('cursor-move', {
      roomId: 'canvas-room',
      cursor: { x: 320, y: 480, line: 15, ch: 8 },
    });

    const presence = getPresence('canvas-room');
    assert.equal(presence[0].cursor.x, 320);
    assert.equal(presence[0].cursor.y, 480);
    assert.equal(presence[0].cursor.line, 15);

    const broadcast = socket.broadcasts.find((b) => b.event === 'cursor-updated');
    assert.ok(broadcast);
    assert.equal(broadcast.room, 'canvas-room');
    assert.equal(broadcast.args[0].cursor.line, 15);
  });

  test('typing indicator broadcasts user-typing and updates presence state', async () => {
    const socket = new MockSocket('socket-typing');
    handleConnection(socket);

    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: 'chat-room', user: { name: 'Typer' } }, resolve);
    });

    socket.emit('typing', {
      roomId: 'chat-room',
      isTyping: true,
    });

    const presence = getPresence('chat-room');
    assert.equal(presence[0].isTyping, true);

    const broadcast = socket.broadcasts.find((b) => b.event === 'user-typing');
    assert.ok(broadcast);
    assert.equal(broadcast.room, 'chat-room');
    assert.equal(broadcast.args[0].isTyping, true);
    assert.equal(broadcast.args[0].user.name, 'Typer');
  });

  test('send-message persists message and broadcasts new-message event', async () => {
    const socket = new MockSocket('socket-messenger');
    handleConnection(socket);

    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: 'team-room', user: { name: 'Carol' } }, resolve);
    });

    let ackData = null;
    await new Promise((resolve) => {
      socket.emit('send-message', {
        roomId: 'team-room',
        content: 'Deployment to staging complete!',
      }, (res) => {
        ackData = res;
        resolve();
      });
    });

    assert.ok(ackData);
    assert.equal(ackData.success, true);
    assert.equal(ackData.message.content, 'Deployment to staging complete!');
    assert.equal(ackData.message.sender, 'Carol');

    // Verify self and peer emissions
    const directEmit = socket.emitted.find((e) => e.event === 'new-message');
    assert.ok(directEmit);
    assert.equal(directEmit.args[0].content, 'Deployment to staging complete!');
  });

  test('leave-room removes participant from presence and broadcasts user-left', async () => {
    const socket = new MockSocket('socket-leaver');
    handleConnection(socket);

    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: 'temp-room', user: { name: 'Guest' } }, resolve);
    });

    assert.equal(getPresence('temp-room').length, 1);

    await new Promise((resolve) => {
      socket.emit('leave-room', { roomId: 'temp-room' }, resolve);
    });

    assert.equal(getPresence('temp-room').length, 0);
    assert.equal(getActiveRoomsCount(), 0);

    const broadcast = socket.broadcasts.find((b) => b.event === 'user-left');
    assert.ok(broadcast);
    assert.equal(broadcast.room, 'temp-room');
    assert.equal(broadcast.args[0].participantsCount, 0);
  });

  test('disconnect automatically cleans up user across multiple joined rooms', async () => {
    const socket = new MockSocket('socket-multiroon');
    handleConnection(socket);

    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: 'room-1', user: { name: 'MultiUser' } }, resolve);
    });
    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: 'room-2', user: { name: 'MultiUser' } }, resolve);
    });

    assert.equal(getPresence('room-1').length, 1);
    assert.equal(getPresence('room-2').length, 1);

    socket.emit('disconnect');

    assert.equal(getPresence('room-1').length, 0);
    assert.equal(getPresence('room-2').length, 0);
  });
});
