const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/syncspace';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[SyncSpace DB] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn(`[SyncSpace DB] MongoDB connection warning: ${err.message}. Operating in high-speed in-memory fallback mode.`);
    return null;
  }
};

module.exports = connectDB;
