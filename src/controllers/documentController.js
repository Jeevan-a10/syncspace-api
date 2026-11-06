const mongoose = require('mongoose');
const CollaborativeDoc = require('../models/CollaborativeDoc');

// In-memory fallback documents
let inMemoryDocs = {
  'general-hq': {
    roomId: 'general-hq',
    title: 'General HQ Workspace Doc',
    content: '# General Headquarters\n\nWelcome to SyncSpace. This is a real-time collaborative document.',
    version: 1,
    lastModifiedBy: 'system',
    changeHistory: [
      {
        version: 1,
        author: 'system',
        timestamp: new Date('2026-11-06T00:00:00.000Z'),
        changeType: 'init',
        deltaLength: 0,
      },
    ],
    createdAt: new Date('2026-11-06T00:00:00.000Z'),
    updatedAt: new Date('2026-11-06T00:00:00.000Z'),
  },
  'architecture-review': {
    roomId: 'architecture-review',
    title: 'Architecture RFC & Specs',
    content: '# Architecture Specification\n\n1. Socket.io WebSocket cluster\n2. Event-driven Redis pub/sub ready\n3. MongoDB document persistence',
    version: 1,
    lastModifiedBy: 'jeevan',
    changeHistory: [
      {
        version: 1,
        author: 'jeevan',
        timestamp: new Date('2026-11-06T00:00:00.000Z'),
        changeType: 'init',
        deltaLength: 0,
      },
    ],
    createdAt: new Date('2026-11-06T00:00:00.000Z'),
    updatedAt: new Date('2026-11-06T00:00:00.000Z'),
  },
};

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * @desc    Get collaborative document for a room
 * @route   GET /api/rooms/:roomId/document
 */
const getDocument = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const cleanId = roomId.toLowerCase();

    if (isDbConnected()) {
      let doc = await CollaborativeDoc.findOne({ roomId: cleanId });
      if (!doc) {
        doc = await CollaborativeDoc.create({
          roomId: cleanId,
          title: `Document for #${cleanId}`,
          content: `# Room: ${cleanId}\n\nStart typing collaboratively...`,
          version: 1,
          lastModifiedBy: 'system',
        });
      }
      return res.status(200).json({
        success: true,
        data: doc,
      });
    }

    // In-memory fallback
    if (!inMemoryDocs[cleanId]) {
      inMemoryDocs[cleanId] = {
        roomId: cleanId,
        title: `Document for #${cleanId}`,
        content: `# Room: ${cleanId}\n\nStart typing collaboratively...`,
        version: 1,
        lastModifiedBy: 'system',
        changeHistory: [
          {
            version: 1,
            author: 'system',
            timestamp: new Date(),
            changeType: 'init',
            deltaLength: 0,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return res.status(200).json({
      success: true,
      data: inMemoryDocs[cleanId],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update document content via REST API
 * @route   PUT /api/rooms/:roomId/document
 */
const updateDocument = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { content, author = 'anonymous', changeType = 'edit' } = req.body;
    const cleanId = roomId.toLowerCase();

    if (isDbConnected()) {
      let doc = await CollaborativeDoc.findOne({ roomId: cleanId });
      if (!doc) {
        doc = new CollaborativeDoc({
          roomId: cleanId,
          title: `Document for #${cleanId}`,
        });
      }

      doc.applyRevision(content, author, changeType);
      await doc.save();

      return res.status(200).json({
        success: true,
        data: doc,
      });
    }

    // In-memory fallback
    if (!inMemoryDocs[cleanId]) {
      inMemoryDocs[cleanId] = {
        roomId: cleanId,
        title: `Document for #${cleanId}`,
        content: '',
        version: 1,
        lastModifiedBy: 'system',
        changeHistory: [
          {
            version: 1,
            author: 'system',
            timestamp: new Date(),
            changeType: 'init',
            deltaLength: 0,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const prevDoc = inMemoryDocs[cleanId];
    const prevLength = (prevDoc.content || '').length;
    const nextVersion = prevDoc.version + 1;
    const historyItem = {
      version: nextVersion,
      author,
      timestamp: new Date(),
      changeType: changeType || 'edit',
      deltaLength: content.length - prevLength,
    };

    prevDoc.content = content;
    prevDoc.version = nextVersion;
    prevDoc.lastModifiedBy = author;
    prevDoc.updatedAt = new Date();
    prevDoc.changeHistory.push(historyItem);
    if (prevDoc.changeHistory.length > 100) {
      prevDoc.changeHistory = prevDoc.changeHistory.slice(-100);
    }

    return res.status(200).json({
      success: true,
      data: prevDoc,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get revision history of document
 * @route   GET /api/rooms/:roomId/document/history
 */
const getDocumentHistory = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const cleanId = roomId.toLowerCase();

    if (isDbConnected()) {
      const doc = await CollaborativeDoc.findOne({ roomId: cleanId }).select('version lastModifiedBy changeHistory');
      if (!doc) {
        return res.status(404).json({
          success: false,
          error: `Document for room '${cleanId}' not found`,
        });
      }
      return res.status(200).json({
        success: true,
        count: doc.changeHistory.length,
        version: doc.version,
        data: doc.changeHistory,
      });
    }

    const doc = inMemoryDocs[cleanId];
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: `Document for room '${cleanId}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      count: doc.changeHistory.length,
      version: doc.version,
      data: doc.changeHistory,
    });
  } catch (err) {
    next(err);
  }
};

// Internal sync engine helpers
const syncDocEdit = async (roomId, newContent, author = 'anonymous', changeType = 'edit') => {
  const cleanId = roomId.toLowerCase();

  if (isDbConnected()) {
    try {
      let doc = await CollaborativeDoc.findOne({ roomId: cleanId });
      if (!doc) {
        doc = new CollaborativeDoc({ roomId: cleanId });
      }
      doc.applyRevision(newContent, author, changeType);
      await doc.save();
      return {
        content: doc.content,
        version: doc.version,
        lastModifiedBy: doc.lastModifiedBy,
      };
    } catch (e) {
      console.warn(`[SyncSpace Doc] Database sync warning: ${e.message}`);
    }
  }

  // In-memory fallback
  if (!inMemoryDocs[cleanId]) {
    inMemoryDocs[cleanId] = {
      roomId: cleanId,
      title: `Document for #${cleanId}`,
      content: '',
      version: 1,
      lastModifiedBy: 'system',
      changeHistory: [
        {
          version: 1,
          author: 'system',
          timestamp: new Date(),
          changeType: 'init',
          deltaLength: 0,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const prevDoc = inMemoryDocs[cleanId];
  const prevLength = (prevDoc.content || '').length;
  const nextVersion = prevDoc.version + 1;
  prevDoc.content = newContent;
  prevDoc.version = nextVersion;
  prevDoc.lastModifiedBy = author;
  prevDoc.updatedAt = new Date();
  prevDoc.changeHistory.push({
    version: nextVersion,
    author,
    timestamp: new Date(),
    changeType,
    deltaLength: newContent.length - prevLength,
  });

  return {
    content: prevDoc.content,
    version: prevDoc.version,
    lastModifiedBy: prevDoc.lastModifiedBy,
  };
};

const getDocDirect = async (roomId) => {
  const cleanId = roomId.toLowerCase();
  if (isDbConnected()) {
    try {
      const doc = await CollaborativeDoc.findOne({ roomId: cleanId }).lean();
      if (doc) return doc;
    } catch (_) {}
  }
  return inMemoryDocs[cleanId] || null;
};

const initDocumentForRoom = (roomId, title, content, author) => {
  const cleanId = roomId.toLowerCase();
  inMemoryDocs[cleanId] = {
    roomId: cleanId,
    title: title || `Document for #${cleanId}`,
    content: content || `# Room: ${cleanId}`,
    version: 1,
    lastModifiedBy: author || 'system',
    changeHistory: [
      {
        version: 1,
        author: author || 'system',
        timestamp: new Date(),
        changeType: 'init',
        deltaLength: 0,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

const deleteDocumentForRoom = (roomId) => {
  delete inMemoryDocs[roomId.toLowerCase()];
};

const _resetInMemoryDocs = () => {
  inMemoryDocs = {
    'general-hq': {
      roomId: 'general-hq',
      title: 'General HQ Workspace Doc',
      content: '# General Headquarters\n\nWelcome to SyncSpace. This is a real-time collaborative document.',
      version: 1,
      lastModifiedBy: 'system',
      changeHistory: [
        {
          version: 1,
          author: 'system',
          timestamp: new Date('2026-11-06T00:00:00.000Z'),
          changeType: 'init',
          deltaLength: 0,
        },
      ],
      createdAt: new Date('2026-11-06T00:00:00.000Z'),
      updatedAt: new Date('2026-11-06T00:00:00.000Z'),
    },
  };
};

module.exports = {
  getDocument,
  updateDocument,
  getDocumentHistory,
  syncDocEdit,
  getDocDirect,
  initDocumentForRoom,
  deleteDocumentForRoom,
  _resetInMemoryDocs,
};
