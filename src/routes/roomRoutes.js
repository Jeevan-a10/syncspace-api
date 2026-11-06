const express = require('express');
const router = express.Router();
const {
  getRooms,
  getRoomById,
  createRoom,
  deleteRoom,
  getRoomStats,
} = require('../controllers/roomController');
const {
  getDocument,
  updateDocument,
  getDocumentHistory,
} = require('../controllers/documentController');
const {
  getRoomMessages,
  postRoomMessage,
} = require('../controllers/messageController');
const {
  validateCreateRoom,
  validateRoomIdParam,
  validateUpdateDocument,
  validateCreateMessage,
} = require('../middleware/validate');
const { getPresence } = require('../sockets/syncEngine');

// Room stats endpoint (must precede :roomId parameter route)
router.get('/stats', getRoomStats);

// Rooms root collection endpoints
router.route('/')
  .get(getRooms)
  .post(validateCreateRoom, createRoom);

// Single room resource endpoints
router.route('/:roomId')
  .get(validateRoomIdParam, getRoomById)
  .delete(validateRoomIdParam, deleteRoom);

// Room real-time presence endpoint
router.get('/:roomId/presence', validateRoomIdParam, (req, res) => {
  const presence = getPresence(req.params.roomId);
  res.status(200).json({
    success: true,
    roomId: req.params.roomId,
    count: presence.length,
    data: presence,
  });
});

// Collaborative Document sub-resource endpoints
router.route('/:roomId/document')
  .get(validateRoomIdParam, getDocument)
  .put(validateRoomIdParam, validateUpdateDocument, updateDocument);

router.get('/:roomId/document/history', validateRoomIdParam, getDocumentHistory);

// Room Chat Messages sub-resource endpoints
router.route('/:roomId/messages')
  .get(validateRoomIdParam, getRoomMessages)
  .post(validateRoomIdParam, validateCreateMessage, postRoomMessage);

module.exports = router;
