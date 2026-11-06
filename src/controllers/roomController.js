const mongoose = require('mongoose');
const WorkspaceRoom = require('../models/WorkspaceRoom');
const CollaborativeDoc = require('../models/CollaborativeDoc');
const RoomMessage = require('../models/RoomMessage');

// In-memory fallback rooms
let inMemoryRooms = [
  {
    _id: 'room-seed-1',
    roomId: 'general-hq',
    name: 'General Headquarters',
    description: 'Central engineering and collaborative discussion room',
    topic: 'general',
    createdBy: 'system',
    maxParticipants: 100,
    isPrivate: false,
    settings: { allowAnonymous: true, readOnly: false },
    createdAt: new Date('2026-11-06T00:00:00.000Z'),
    updatedAt: new Date('2026-11-06T00:00:00.000Z'),
  },
  {
    _id: 'room-seed-2',
    roomId: 'architecture-review',
    name: 'System Architecture Review',
    description: 'Design discussions, technical specs, and RFC collaborative editing',
    topic: 'architecture',
    createdBy: 'jeevan',
    maxParticipants: 50,
    isPrivate: false,
    settings: { allowAnonymous: true, readOnly: false },
    createdAt: new Date('2026-11-06T00:00:00.000Z'),
    updatedAt: new Date('2026-11-06T00:00:00.000Z'),
  },
];

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * @desc    Get all workspace rooms with topic filter and search
 * @route   GET /api/rooms
 */
const getRooms = async (req, res, next) => {
  try {
    const { topic, q, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    if (isDbConnected()) {
      const query = {};
      if (topic) query.topic = topic;
      if (q) {
        query.$or = [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { roomId: { $regex: q, $options: 'i' } },
        ];
      }

      const total = await WorkspaceRoom.countDocuments(query);
      const rooms = await WorkspaceRoom.find(query)
        .sort({ updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

      return res.status(200).json({
        success: true,
        count: rooms.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        data: rooms,
      });
    }

    // In-memory fallback
    let filtered = [...inMemoryRooms];
    if (topic) {
      filtered = filtered.filter((r) => r.topic === topic);
    }
    if (q) {
      const term = q.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.roomId.toLowerCase().includes(term) ||
          (r.description && r.description.toLowerCase().includes(term))
      );
    }

    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      count: paginated.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: paginated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get single room by roomId
 * @route   GET /api/rooms/:roomId
 */
const getRoomById = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    if (isDbConnected()) {
      const room = await WorkspaceRoom.findOne({ roomId: roomId.toLowerCase() }).lean();
      if (!room) {
        return res.status(404).json({
          success: false,
          error: `Workspace room '${roomId}' not found`,
        });
      }
      return res.status(200).json({
        success: true,
        data: room,
      });
    }

    const room = inMemoryRooms.find((r) => r.roomId === roomId.toLowerCase());
    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Workspace room '${roomId}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new workspace room
 * @route   POST /api/rooms
 */
const createRoom = async (req, res, next) => {
  try {
    const { roomId, name, description, topic, createdBy, maxParticipants, isPrivate, settings } = req.body;
    const cleanRoomId = roomId.toLowerCase().trim();

    if (isDbConnected()) {
      const existing = await WorkspaceRoom.findOne({ roomId: cleanRoomId });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: `Room '${cleanRoomId}' already exists`,
        });
      }

      const room = await WorkspaceRoom.create({
        roomId: cleanRoomId,
        name: name.trim(),
        description: (description || '').trim(),
        topic: topic || 'general',
        createdBy: (createdBy || 'anonymous').trim(),
        maxParticipants: maxParticipants ? Number(maxParticipants) : 50,
        isPrivate: Boolean(isPrivate),
        settings: settings || { allowAnonymous: true, readOnly: false },
      });

      // Automatically initialize document for room
      await CollaborativeDoc.create({
        roomId: cleanRoomId,
        title: `${name} Document`,
        content: `# ${name}\n\nCollaborative document created for #${cleanRoomId}.`,
        version: 1,
        lastModifiedBy: createdBy || 'system',
      });

      return res.status(201).json({
        success: true,
        data: room,
      });
    }

    // In-memory fallback
    const exists = inMemoryRooms.some((r) => r.roomId === cleanRoomId);
    if (exists) {
      return res.status(400).json({
        success: false,
        error: `Room '${cleanRoomId}' already exists`,
      });
    }

    const newRoom = {
      _id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      roomId: cleanRoomId,
      name: name.trim(),
      description: (description || '').trim(),
      topic: topic || 'general',
      createdBy: (createdBy || 'anonymous').trim(),
      maxParticipants: maxParticipants ? Number(maxParticipants) : 50,
      isPrivate: Boolean(isPrivate),
      settings: settings || { allowAnonymous: true, readOnly: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryRooms.unshift(newRoom);

    // Initialize in-memory document via documentController store
    const { initDocumentForRoom } = require('./documentController');
    initDocumentForRoom(cleanRoomId, `${name} Document`, `# ${name}\n\nCollaborative document created for #${cleanRoomId}.`, createdBy || 'system');

    return res.status(201).json({
      success: true,
      data: newRoom,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a workspace room
 * @route   DELETE /api/rooms/:roomId
 */
const deleteRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const cleanId = roomId.toLowerCase();

    if (isDbConnected()) {
      const room = await WorkspaceRoom.findOneAndDelete({ roomId: cleanId });
      if (!room) {
        return res.status(404).json({
          success: false,
          error: `Room '${cleanId}' not found`,
        });
      }

      await CollaborativeDoc.deleteMany({ roomId: cleanId });
      await RoomMessage.deleteMany({ roomId: cleanId });

      return res.status(200).json({
        success: true,
        message: `Room '${cleanId}' and associated resources deleted successfully`,
      });
    }

    const index = inMemoryRooms.findIndex((r) => r.roomId === cleanId);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: `Room '${cleanId}' not found`,
      });
    }

    inMemoryRooms.splice(index, 1);

    const { deleteDocumentForRoom } = require('./documentController');
    const { deleteMessagesForRoom } = require('./messageController');
    deleteDocumentForRoom(cleanId);
    deleteMessagesForRoom(cleanId);

    return res.status(200).json({
      success: true,
      message: `Room '${cleanId}' and associated resources deleted successfully`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get aggregate workspace metrics
 * @route   GET /api/rooms/stats
 */
const getRoomStats = async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const total = await WorkspaceRoom.countDocuments();
      const topicAgg = await WorkspaceRoom.aggregate([
        { $group: { _id: '$topic', count: { $sum: 1 } } },
      ]);
      const byTopic = {};
      topicAgg.forEach((item) => {
        byTopic[item._id] = item.count;
      });

      return res.status(200).json({
        success: true,
        data: {
          totalRooms: total,
          byTopic,
        },
      });
    }

    // In-memory fallback
    const byTopic = {};
    inMemoryRooms.forEach((r) => {
      byTopic[r.topic] = (byTopic[r.topic] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        totalRooms: inMemoryRooms.length,
        byTopic,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Test helper: reset in-memory rooms
const _resetInMemoryRooms = () => {
  inMemoryRooms = [
    {
      _id: 'room-seed-1',
      roomId: 'general-hq',
      name: 'General Headquarters',
      description: 'Central engineering and collaborative discussion room',
      topic: 'general',
      createdBy: 'system',
      maxParticipants: 100,
      isPrivate: false,
      settings: { allowAnonymous: true, readOnly: false },
      createdAt: new Date('2026-11-06T00:00:00.000Z'),
      updatedAt: new Date('2026-11-06T00:00:00.000Z'),
    },
    {
      _id: 'room-seed-2',
      roomId: 'architecture-review',
      name: 'System Architecture Review',
      description: 'Design discussions, technical specs, and RFC collaborative editing',
      topic: 'architecture',
      createdBy: 'jeevan',
      maxParticipants: 50,
      isPrivate: false,
      settings: { allowAnonymous: true, readOnly: false },
      createdAt: new Date('2026-11-06T00:00:00.000Z'),
      updatedAt: new Date('2026-11-06T00:00:00.000Z'),
    },
  ];
};

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  deleteRoom,
  getRoomStats,
  _resetInMemoryRooms,
};
