const ROOM_ID_REGEX = /^[a-z0-9-_]+$/;
const VALID_TOPICS = ['general', 'engineering', 'design', 'architecture', 'standup'];

const validateCreateRoom = (req, res, next) => {
  const { roomId, name, topic, maxParticipants } = req.body;

  if (!roomId || typeof roomId !== 'string' || roomId.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Room ID is required and must be at least 3 characters',
    });
  }

  const cleanRoomId = roomId.trim().toLowerCase();
  if (cleanRoomId.length > 40) {
    return res.status(400).json({
      success: false,
      error: 'Room ID cannot exceed 40 characters',
    });
  }

  if (!ROOM_ID_REGEX.test(cleanRoomId)) {
    return res.status(400).json({
      success: false,
      error: 'Room ID may only contain lowercase alphanumeric characters, dashes, and underscores',
    });
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Room name is required and must be at least 2 characters',
    });
  }

  if (name.trim().length > 80) {
    return res.status(400).json({
      success: false,
      error: 'Room name cannot exceed 80 characters',
    });
  }

  if (topic && !VALID_TOPICS.includes(topic)) {
    return res.status(400).json({
      success: false,
      error: `Topic must be one of: ${VALID_TOPICS.join(', ')}`,
    });
  }

  if (maxParticipants !== undefined) {
    const num = Number(maxParticipants);
    if (isNaN(num) || num < 2 || num > 500) {
      return res.status(400).json({
        success: false,
        error: 'maxParticipants must be a number between 2 and 500',
      });
    }
  }

  req.body.roomId = cleanRoomId;
  req.body.name = name.trim();
  next();
};

const validateRoomIdParam = (req, res, next) => {
  const { roomId } = req.params;
  if (!roomId || typeof roomId !== 'string' || !ROOM_ID_REGEX.test(roomId.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid roomId parameter format',
    });
  }
  req.params.roomId = roomId.toLowerCase();
  next();
};

const validateUpdateDocument = (req, res, next) => {
  const { content, author, changeType } = req.body;

  if (content === undefined || typeof content !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Document content is required and must be a string',
    });
  }

  if (changeType && !['init', 'edit', 'replace', 'reset'].includes(changeType)) {
    return res.status(400).json({
      success: false,
      error: 'changeType must be one of: init, edit, replace, reset',
    });
  }

  if (author && typeof author !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Author must be a string',
    });
  }

  next();
};

const validateCreateMessage = (req, res, next) => {
  const { sender, content, messageType } = req.body;

  if (!sender || typeof sender !== 'string' || sender.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Sender name is required',
    });
  }

  if (sender.trim().length > 50) {
    return res.status(400).json({
      success: false,
      error: 'Sender name cannot exceed 50 characters',
    });
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message content cannot be empty',
    });
  }

  if (content.trim().length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Message content cannot exceed 1000 characters',
    });
  }

  if (messageType && !['chat', 'system', 'announcement'].includes(messageType)) {
    return res.status(400).json({
      success: false,
      error: 'messageType must be one of: chat, system, announcement',
    });
  }

  req.body.sender = sender.trim();
  req.body.content = content.trim();
  next();
};

module.exports = {
  validateCreateRoom,
  validateRoomIdParam,
  validateUpdateDocument,
  validateCreateMessage,
};
