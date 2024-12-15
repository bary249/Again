import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { MyGame } from './Game/game.js';

const UNITY_EVENTS = {
  STATE_UPDATE: 'unityStateUpdate',
  MOVE_MADE: 'unityMoveMade',
  REQUEST_STATE: 'requestState'
};

const server = Server({
  games: [MyGame],
  origins: ['http://localhost:3000', 'https://lively-chaja-8eb605.netlify.app'],
});

const httpServer = createServer(server.app);
const io = new SocketIO(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Track active games and their states
const gameStates = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Handle joining a game room
  socket.on('joinGame', ({ matchID, playerID }) => {
    console.log('Join game request:', { matchID, playerID, socketId: socket.id });
    socket.join(matchID);
    
    // Log room status
    const room = io.sockets.adapter.rooms.get(matchID);
    console.log('Room status:', {
      matchID,
      clients: room ? Array.from(room) : []
    });
  });

  // Handle Unity state updates
  socket.on(UNITY_EVENTS.STATE_UPDATE, (data) => {
    console.log('Unity state update:', data);
    gameStates.set(data.matchID, {
      G: data.G,
      ctx: data.ctx
    });
    // Broadcast to all clients in the room except sender
    socket.to(data.matchID).emit(UNITY_EVENTS.STATE_UPDATE, data);
  });

  // Handle Unity moves
  socket.on(UNITY_EVENTS.MOVE_MADE, (data) => {
    console.log('Unity move:', data);
    // Broadcast move to all clients in the room
    io.to(data.matchID).emit(UNITY_EVENTS.MOVE_MADE, data);
  });

  // Handle state requests
  socket.on(UNITY_EVENTS.REQUEST_STATE, ({ matchID }) => {
    const state = gameStates.get(matchID);
    if (state) {
      socket.emit(UNITY_EVENTS.STATE_UPDATE, {
        matchID,
        ...state,
        timestamp: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8080;

server.run({
  server: httpServer,
  port: PORT
});

console.log(`Server running on port ${PORT}`);