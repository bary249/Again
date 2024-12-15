import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { MyGame } from './Game/game.js';
import { instrument } from '@socket.io/admin-ui';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://lively-chaja-8eb605.netlify.app'
];

const server = Server({
  games: [MyGame],
  origins: ALLOWED_ORIGINS,
});

// Add Koa middleware for CORS
server.app.use(async (ctx, next) => {
  const origin = ctx.get('Origin');
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    ctx.set('Access-Control-Allow-Origin', origin);
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type');
    ctx.set('Access-Control-Allow-Credentials', 'true');
  }

  if (ctx.method === 'OPTIONS') {
    ctx.status = 200;
  } else {
    await next();
  }
});

const httpServer = createServer(server.app.callback());
const io = new SocketIO(httpServer, {
  cors: {
    origin: [...ALLOWED_ORIGINS, "https://admin.socket.io"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  cookie: false
});

// Add connection logging
io.engine.on("connection_error", (err) => {
  console.log("🔴 Connection Error:", {
    type: err.code,
    message: err.message,
    context: err.context,
    time: new Date().toISOString()
  });
});

// Keep track of game rooms
io.on('connection', (socket) => {
  console.log('🔌 Socket Connected:', {
    socketId: socket.id,
    rooms: Array.from(socket.rooms),
    time: new Date().toISOString()
  });

  socket.on('gameStateUpdate', (data) => {
    console.log('📥 Received game state:', {
      socketId: socket.id,
      matchID: data.matchID,
      playerID: data.ctx?.currentPlayer,
      timestamp: new Date().toISOString(),
      data: data  // Log the full data
    });
    
    // Log before broadcasting
    const room = io.sockets.adapter.rooms.get(data.matchID);
    console.log('📢 Broadcasting to room:', {
      matchID: data.matchID,
      clientCount: room ? room.size : 0,
      clients: room ? Array.from(room) : [],
      time: new Date().toISOString()
    });

    // Add acknowledgment callback
    socket.broadcast.to(data.matchID).emit('gameStateUpdate', data, (error) => {
      if (error) {
        console.error('❌ Broadcast error:', error);
      } else {
        console.log('✅ Broadcast successful to room:', data.matchID);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket Disconnected:', {
      socketId: socket.id,
      time: new Date().toISOString()
    });
  });
});

// Simplified admin UI setup with monitoring
instrument(io, {
  auth: false,
  mode: "development",
  serverId: "again-server",
  readonly: false,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2000,
    skipMiddlewares: true,
  }
});

const PORT = process.env.PORT || 8080;

server.run({
  server: httpServer,
  port: PORT
});

console.log(`Server running on port ${PORT}`);