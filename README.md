# SyncSpace API ⚡

![CI Status](https://github.com/Jeevan-a10/syncspace-api/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-44%20passing-brightgreen)
![Node.js](https://img.shields.io/badge/node-v20%2B-blue)
![Socket.io](https://img.shields.io/badge/socket.io-v4.8-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

High-performance real-time collaborative workspace and document synchronization engine built with **Node.js**, **Express**, **Socket.io**, and **MongoDB**.

SyncSpace powers real-time team collaboration with conflict-free collaborative text editing, multi-user cursor tracking, typing indicators, room chat channels, and persistent revision trails.

---

## 🏗️ System Architecture

SyncSpace operates on a hybrid dual-protocol architecture:

```
                      ┌────────────────────────────────────────┐
                      │        Web & Client Applications       │
                      └──────────────┬──────────────────┬──────┘
                                     │                  │
                      HTTP REST API  │                  │ WebSocket (Socket.io)
                    (JSON Endpoints) │                  │ (Full-Duplex Events)
                                     ▼                  ▼
              ┌────────────────────────────────────────────────────────┐
              │                    SyncSpace API Server                │
              │                                                        │
              │   ┌────────────────────┐      ┌────────────────────┐   │
              │   │   Express Router   │      │ Socket Sync Engine │   │
              │   │  • /api/health     │      │  • join-room       │   │
              │   │  • /api/rooms      │◄────►│  • doc-edit        │   │
              │   │  • /api/rooms/:id/ │      │  • cursor-move     │   │
              │   │    document        │      │  • typing          │   │
              │   │  • /api/rooms/:id/ │      │  • send-message    │   │
              │   │    messages        │      │  • disconnect      │   │
              │   └─────────┬──────────┘      └─────────┬──────────┘   │
              │             │                           │              │
              │             ▼                           ▼              │
              │   ┌───────────────────────────────────────────────┐    │
              │   │        Data Layer & Graceful Fallback         │    │
              │   │  MongoDB (Mongoose) ◄──► In-Memory Fast Store │    │
              │   └───────────────────────────────────────────────┘    │
              └────────────────────────────────────────────────────────┘
```

---

## ✨ Features

- **⚡ Real-Time Collaborative Document Sync**: Synchronize document content across all connected peers in a room with monotonic revision incrementing and delta length tracking.
- **👥 Multi-User Presence & Awareness**: Track connected users, auto-assigned aesthetic cursor colors, join timestamps, and active participant counts.
- **🖱️ Live Multi-User Cursors**: Stream pixel coordinates and editor line/character cursor locations across peers with low latency.
- **⌨️ Live Typing Indicators**: Broadcast instant typing states to give immediate visual feedback during collaborative discussions.
- **💬 Real-Time Workspace Channel Chat**: Full-duplex room messaging alongside documents for continuous team communication.
- **📜 Document Version History**: Maintain an audit trail of changes, authors, change types (`init`, `edit`, `replace`, `reset`), and timestamps.
- **🛡️ Observability & Security**: Request tracing (`X-Request-Id`, `X-Response-Time`), HTTP security headers (`nosniff`, `frame-deny`, `xss-protection`), and strict input validation.
- **🔄 Zero-Dependency In-Memory Fallback**: Runs with full functionality in memory if MongoDB is offline or unavailable.
- **🐳 Multi-Stage Docker Container**: Alpine-based minimal image with health checks and non-root execution.
- **🧪 100% Automated Testing**: 44 tests covering validation, rooms, documents, chat messages, middleware, and the real-time Socket.io engine.

---

## 📡 Socket.io Event Protocol Specification

### Client-to-Server Events (Emit)

| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomId: string, user: { id, name } }` | Joins a room, registers presence, receives `room-state` |
| `leave-room` | `{ roomId: string }` | Leaves room, updates presence, broadcasts `user-left` |
| `doc-edit` | `{ roomId: string, content: string, changeType?: string }` | Emits document update, increments version, broadcasts `doc-updated` |
| `cursor-move`| `{ roomId: string, cursor: { x, y, line, ch } }` | Streams live cursor position to peers |
| `typing` | `{ roomId: string, isTyping: boolean }` | Notifies peers of typing status |
| `send-message` | `{ roomId: string, content: string }` | Posts chat message to room, broadcasts `new-message` |

### Server-to-Client Events (Listen)

| Event | Payload | Description |
|---|---|---|
| `room-state` | `{ roomId, user, document, participants, timestamp }` | Initial state emitted to newly joined socket |
| `user-joined` | `{ roomId, user, participantsCount, timestamp }` | Broadcast to peers when new user enters room |
| `user-left` | `{ roomId, socketId, user, participantsCount, timestamp }` | Broadcast to peers when user leaves or disconnects |
| `doc-updated` | `{ roomId, content, version, author, timestamp }` | Broadcast to peers when document is edited |
| `cursor-updated`| `{ roomId, socketId, user, cursor, timestamp }` | Broadcast to peers on cursor movement |
| `user-typing` | `{ roomId, socketId, user, isTyping }` | Broadcast to peers on typing state change |
| `new-message` | `{ _id, roomId, sender, content, messageType, timestamp }` | Broadcast to room members on new chat message |

---

## 🔌 REST API Reference

### Health & Diagnostics
- `GET /api/health` — Service health, database connection mode, active socket count, active rooms count, and uptime.

### Workspace Rooms
- `GET /api/rooms` — List rooms with optional `topic`, search query `q`, and pagination (`page`, `limit`).
- `GET /api/rooms/stats` — Metrics overview with room counts grouped by topic.
- `GET /api/rooms/:roomId` — Fetch single workspace room details.
- `POST /api/rooms` — Create a new workspace room (automatically provisions collaborative document).
- `DELETE /api/rooms/:roomId` — Delete a room and its associated document and chat history.
- `GET /api/rooms/:roomId/presence` — Get real-time connected users and presence details.

### Collaborative Documents
- `GET /api/rooms/:roomId/document` — Get current document content and revision number.
- `PUT /api/rooms/:roomId/document` — Update document via REST (increments version and appends to history).
- `GET /api/rooms/:roomId/document/history` — Get chronological revision log of edits and authors.

### Room Chat Messages
- `GET /api/rooms/:roomId/messages` — Fetch paginated chat history for a room.
- `POST /api/rooms/:roomId/messages` — Post a chat message via REST API.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (optional; defaults seamlessly to high-speed in-memory store)

### Installation

```bash
cd syncspace-api
npm install
```

### Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/syncspace
NODE_ENV=development
```

### Running Locally

```bash
# Production start
npm start

# Development mode with hot-reloading
npm run dev
```

### Running Automated Tests

```bash
npm test
```

Executes 44 tests with sub-second execution speed using Node.js native test runner.

---

## 🐳 Docker Deployment

### Build and Run with Docker

```bash
# Build Docker image
docker build -t syncspace-api .

# Run container on port 5001
docker run -p 5001:5001 --name syncspace syncspace-api
```

---

## 📄 License

MIT © [Jeevan](https://github.com/Jeevan-a10)
