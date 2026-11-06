const { Server } = require('socket.io');
const { getDocDirect, syncDocEdit } = require('../controllers/documentController');
const { saveMessageDirect } = require('../controllers/messageController');

let io = null;

// Presence state: roomId -> Map(socketId -> { id, name, color, joinedAt, cursor, isTyping })
const roomPresence = new Map();

// Generate random pleasant pastel colors for multi-user cursor tags
const CURSOR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#14b8a6', // teal
];

const getRandomColor = () => CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];

const handleConnection = (socket) => {
  socket.data = {
    joinedRooms: new Set(),
    user: null,
    color: getRandomColor(),
  };

  /**
   * Join a workspace room
   * payload: { roomId: string, user: { id: string, name: string } }
   */
  socket.on('join-room', async (payload = {}, ack) => {
    try {
      const roomId = (payload.roomId || 'general-hq').toLowerCase().trim();
      const userName = payload.user?.name || `Dev-${socket.id.substring(0, 4)}`;
      const userId = payload.user?.id || socket.id;

      const participant = {
        id: userId,
        socketId: socket.id,
        name: userName,
        color: socket.data.color,
        joinedAt: new Date(),
        cursor: null,
        isTyping: false,
      };

      socket.data.user = participant;
      socket.data.joinedRooms.add(roomId);
      socket.join(roomId);

      // Update presence map
      if (!roomPresence.has(roomId)) {
        roomPresence.set(roomId, new Map());
      }
      roomPresence.get(roomId).set(socket.id, participant);

      // Fetch current document state
      const currentDoc = await getDocDirect(roomId);

      // All participants in room
      const participants = Array.from(roomPresence.get(roomId).values());

      // Notify caller of complete initial state
      const initialState = {
        roomId,
        user: participant,
        document: currentDoc || {
          roomId,
          title: `Document for #${roomId}`,
          content: `# Room: ${roomId}\n\nStart typing collaboratively...`,
          version: 1,
          lastModifiedBy: 'system',
        },
        participants,
        timestamp: new Date(),
      };

      socket.emit('room-state', initialState);

      // Broadcast to other peers that new user has joined
      socket.to(roomId).emit('user-joined', {
        roomId,
        user: participant,
        participantsCount: participants.length,
        timestamp: new Date(),
      });

      if (typeof ack === 'function') {
        ack({ success: true, data: initialState });
      }
    } catch (err) {
      console.error(`[SyncEngine] join-room error: ${err.message}`);
      if (typeof ack === 'function') {
        ack({ success: false, error: err.message });
      }
    }
  });

  /**
   * Leave a workspace room
   * payload: { roomId: string }
   */
  socket.on('leave-room', (payload = {}, ack) => {
    const roomId = (payload.roomId || '').toLowerCase().trim();
    if (!roomId) return;

    socket.leave(roomId);
    socket.data.joinedRooms.delete(roomId);

    if (roomPresence.has(roomId)) {
      roomPresence.get(roomId).delete(socket.id);
      const remaining = Array.from(roomPresence.get(roomId).values());

      socket.to(roomId).emit('user-left', {
        roomId,
        socketId: socket.id,
        user: socket.data.user,
        participantsCount: remaining.length,
        timestamp: new Date(),
      });

      if (remaining.length === 0) {
        roomPresence.delete(roomId);
      }
    }

    if (typeof ack === 'function') {
      ack({ success: true });
    }
  });

  /**
   * Document content edit event
   * payload: { roomId: string, content: string, changeType?: string }
   */
  socket.on('doc-edit', async (payload = {}, ack) => {
    try {
      const roomId = (payload.roomId || '').toLowerCase().trim();
      const content = payload.content;

      if (!roomId || typeof content !== 'string') {
        if (typeof ack === 'function') {
          return ack({ success: false, error: 'roomId and content are required' });
        }
        return;
      }

      const author = socket.data.user?.name || 'anonymous';
      const updated = await syncDocEdit(roomId, content, author, payload.changeType || 'edit');

      // Broadcast updated document state to all other participants in the room
      socket.to(roomId).emit('doc-updated', {
        roomId,
        content: updated.content,
        version: updated.version,
        author: updated.lastModifiedBy,
        lastModifiedBy: updated.lastModifiedBy,
        timestamp: new Date(),
      });

      if (typeof ack === 'function') {
        ack({ success: true, version: updated.version });
      }
    } catch (err) {
      console.error(`[SyncEngine] doc-edit error: ${err.message}`);
      if (typeof ack === 'function') {
        ack({ success: false, error: err.message });
      }
    }
  });

  /**
   * Live cursor movement
   * payload: { roomId: string, cursor: { x: number, y: number, line?: number, ch?: number } }
   */
  socket.on('cursor-move', (payload = {}) => {
    const roomId = (payload.roomId || '').toLowerCase().trim();
    const cursor = payload.cursor;
    if (!roomId || !cursor) return;

    if (roomPresence.has(roomId) && roomPresence.get(roomId).has(socket.id)) {
      roomPresence.get(roomId).get(socket.id).cursor = cursor;
    }

    socket.to(roomId).emit('cursor-updated', {
      roomId,
      socketId: socket.id,
      user: socket.data.user,
      cursor,
      timestamp: new Date(),
    });
  });

  /**
   * Typing status indicator
   * payload: { roomId: string, isTyping: boolean }
   */
  socket.on('typing', (payload = {}) => {
    const roomId = (payload.roomId || '').toLowerCase().trim();
    const isTyping = Boolean(payload.isTyping);
    if (!roomId) return;

    if (roomPresence.has(roomId) && roomPresence.get(roomId).has(socket.id)) {
      roomPresence.get(roomId).get(socket.id).isTyping = isTyping;
    }

    socket.to(roomId).emit('user-typing', {
      roomId,
      socketId: socket.id,
      user: socket.data.user,
      isTyping,
    });
  });

  /**
   * Send chat message in workspace room
   * payload: { roomId: string, content: string }
   */
  socket.on('send-message', async (payload = {}, ack) => {
    try {
      const roomId = (payload.roomId || '').toLowerCase().trim();
      const content = (payload.content || '').trim();

      if (!roomId || !content) {
        if (typeof ack === 'function') {
          return ack({ success: false, error: 'roomId and message content required' });
        }
        return;
      }

      const sender = socket.data.user?.name || 'Anonymous';
      const message = await saveMessageDirect(roomId, sender, content, 'chat');

      // Broadcast to EVERYONE in the room including sender
      if (io) {
        io.to(roomId).emit('new-message', message);
      } else {
        socket.emit('new-message', message);
        socket.to(roomId).emit('new-message', message);
      }

      if (typeof ack === 'function') {
        ack({ success: true, message });
      }
    } catch (err) {
      console.error(`[SyncEngine] send-message error: ${err.message}`);
      if (typeof ack === 'function') {
        ack({ success: false, error: err.message });
      }
    }
  });

  /**
   * Handle client disconnect
   */
  socket.on('disconnect', () => {
    for (const roomId of socket.data.joinedRooms) {
      if (roomPresence.has(roomId)) {
        roomPresence.get(roomId).delete(socket.id);
        const remaining = Array.from(roomPresence.get(roomId).values());

        const eventPayload = {
          roomId,
          socketId: socket.id,
          user: socket.data.user,
          participantsCount: remaining.length,
          timestamp: new Date(),
        };

        if (io) {
          io.to(roomId).emit('user-left', eventPayload);
        } else {
          socket.to(roomId).emit('user-left', eventPayload);
        }

        if (remaining.length === 0) {
          roomPresence.delete(roomId);
        }
      }
    }
  });
};

const init = (httpServer, customOptions = {}) => {
  const options = {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    ...customOptions,
  };

  io = new Server(httpServer, options);
  io.on('connection', handleConnection);
  return io;
};

const getIo = () => io;

const getPresence = (roomId) => {
  const cleanId = (roomId || '').toLowerCase().trim();
  if (!roomPresence.has(cleanId)) return [];
  return Array.from(roomPresence.get(cleanId).values());
};

const getActiveRoomsCount = () => roomPresence.size;

const getTotalConnectedSockets = () => {
  if (!io) return 0;
  return io.sockets.sockets.size;
};

const _resetPresence = () => {
  roomPresence.clear();
};

module.exports = {
  init,
  handleConnection,
  getIo,
  getPresence,
  getActiveRoomsCount,
  getTotalConnectedSockets,
  _resetPresence,
};
