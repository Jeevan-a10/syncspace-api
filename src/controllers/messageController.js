const mongoose = require('mongoose');
const RoomMessage = require('../models/RoomMessage');

// In-memory fallback message storage
let inMemoryMessages = {
  'general-hq': [
    {
      _id: 'msg-seed-1',
      roomId: 'general-hq',
      sender: 'System Bot',
      content: 'Welcome to SyncSpace General Headquarters! Real-time channel active.',
      messageType: 'system',
      timestamp: new Date('2026-11-06T00:00:00.000Z'),
    },
  ],
};

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * @desc    Get message history for a room
 * @route   GET /api/rooms/:roomId/messages
 */
const getRoomMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { limit = 50 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const cleanId = roomId.toLowerCase();

    if (isDbConnected()) {
      const messages = await RoomMessage.find({ roomId: cleanId })
        .sort({ timestamp: -1 })
        .limit(limitNum)
        .lean();

      // Return in chronological order
      return res.status(200).json({
        success: true,
        count: messages.length,
        data: messages.reverse(),
      });
    }

    const list = inMemoryMessages[cleanId] || [];
    const sliced = list.slice(-limitNum);

    return res.status(200).json({
      success: true,
      count: sliced.length,
      data: sliced,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Post a message to a room via REST
 * @route   POST /api/rooms/:roomId/messages
 */
const postRoomMessage = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { sender, content, messageType = 'chat' } = req.body;
    const cleanId = roomId.toLowerCase();

    if (isDbConnected()) {
      const msg = await RoomMessage.create({
        roomId: cleanId,
        sender: sender.trim(),
        content: content.trim(),
        messageType,
        timestamp: new Date(),
      });

      return res.status(201).json({
        success: true,
        data: msg,
      });
    }

    if (!inMemoryMessages[cleanId]) {
      inMemoryMessages[cleanId] = [];
    }

    const newMsg = {
      _id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      roomId: cleanId,
      sender: sender.trim(),
      content: content.trim(),
      messageType,
      timestamp: new Date(),
    };

    inMemoryMessages[cleanId].push(newMsg);

    // Keep last 200 in-memory messages per room
    if (inMemoryMessages[cleanId].length > 200) {
      inMemoryMessages[cleanId] = inMemoryMessages[cleanId].slice(-200);
    }

    return res.status(201).json({
      success: true,
      data: newMsg,
    });
  } catch (err) {
    next(err);
  }
};

// Internal sync engine helpers
const saveMessageDirect = async (roomId, sender, content, messageType = 'chat') => {
  const cleanId = roomId.toLowerCase();

  if (isDbConnected()) {
    try {
      const msg = await RoomMessage.create({
        roomId: cleanId,
        sender,
        content,
        messageType,
        timestamp: new Date(),
      });
      return msg.toObject();
    } catch (e) {
      console.warn(`[SyncSpace Chat] Database save warning: ${e.message}`);
    }
  }

  if (!inMemoryMessages[cleanId]) {
    inMemoryMessages[cleanId] = [];
  }

  const msg = {
    _id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    roomId: cleanId,
    sender,
    content,
    messageType,
    timestamp: new Date(),
  };

  inMemoryMessages[cleanId].push(msg);
  if (inMemoryMessages[cleanId].length > 200) {
    inMemoryMessages[cleanId] = inMemoryMessages[cleanId].slice(-200);
  }

  return msg;
};

const deleteMessagesForRoom = (roomId) => {
  delete inMemoryMessages[roomId.toLowerCase()];
};

const _resetInMemoryMessages = () => {
  inMemoryMessages = {
    'general-hq': [
      {
        _id: 'msg-seed-1',
        roomId: 'general-hq',
        sender: 'System Bot',
        content: 'Welcome to SyncSpace General Headquarters! Real-time channel active.',
        messageType: 'system',
        timestamp: new Date('2026-11-06T00:00:00.000Z'),
      },
    ],
  };
};

module.exports = {
  getRoomMessages,
  postRoomMessage,
  saveMessageDirect,
  deleteMessagesForRoom,
  _resetInMemoryMessages,
};
