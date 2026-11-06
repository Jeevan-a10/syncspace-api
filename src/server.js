const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const requestTracer = require('./middleware/requestTracer');
const errorHandler = require('./middleware/errorHandler');
const roomRoutes = require('./routes/roomRoutes');
const syncEngine = require('./sockets/syncEngine');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io sync engine
const io = syncEngine.init(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Security & Parsing Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestTracer);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  res.status(200).json({
    success: true,
    service: 'syncspace-api',
    version: '1.0.0',
    status: 'healthy',
    mode: isDbReady ? 'mongodb' : 'in-memory-fallback',
    activeSockets: syncEngine.getTotalConnectedSockets(),
    activeRoomsWithPresence: syncEngine.getActiveRoomsCount(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/rooms', roomRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.method} ${req.originalUrl}' not found on SyncSpace API`,
  });
});

// Centralized error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

let listeningServer = null;

const startServer = async (port = PORT) => {
  await connectDB();
  return new Promise((resolve) => {
    listeningServer = server.listen(port, () => {
      const address = listeningServer.address();
      const actualPort = typeof address === 'string' ? address : address.port;
      console.log(`[SyncSpace] Real-time collaboration server listening on port ${actualPort}`);
      resolve(listeningServer);
    });
  });
};

const closeServer = async () => {
  if (io) {
    io.close();
  }
  if (listeningServer) {
    await new Promise((resolve) => listeningServer.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  io,
  syncEngine,
  startServer,
  closeServer,
};
