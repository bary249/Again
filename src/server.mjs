import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

const debugLog = (...args) => {
    console.log(new Date().toISOString(), ...args);
};

(async () => {
  try {
    const { MyGame } = await import('./Game/game.js');
    
    console.log('Starting server setup...');
    
    // Create boardgame.io server
    const server = Server({
      games: [MyGame],
      origins: ['http://localhost:3000', 'https://lively-chaja-8eb605.netlify.app'],
      callback: (app) => {
        // Handle preflight requests
        app.options('*', (req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.status(200).end();
        });
      }
    });

    const httpServer = createServer(server.app);
    const io = new SocketIO(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: false
      }
    });

    // Add error handlers
    httpServer.on('error', (error) => {
      console.error('HTTP Server error:', error);
    });

    io.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    io.on('connection', (socket) => {
      debugLog('🟢 Client connected:', socket.id);
      
      // Debug middleware for all events
      socket.use((packet, next) => {
        debugLog('📨 Packet received:', {
          event: packet[0],
          data: packet[1],
          socketId: socket.id
        });
        next();
      });

      // Listen for game state updates
      socket.on('gameState', (data) => {
        console.log('🎲 Received gameState:', {
          matchID: data.matchID,
          socketId: socket.id,
          data: JSON.stringify(data)
        });
      });

      // New handler for game state requests
      socket.on('requestGameState', async (data) => {
        debugLog('🎲 Received requestGameState:', {
          matchID: data.matchID,
          socketId: socket.id
        });
        
        try {
          debugLog('📦 Fetching state for match:', data.matchID);
          const state = await server.db.fetch(`default:${data.matchID}`);
          debugLog('📦 State found:', !!state);
          
          if (state) {
            debugLog('📤 Sending state to client:', socket.id);
            socket.emit('gameStateUpdate', {
              G: state.G,
              ctx: state.ctx
            });
            debugLog('✅ State sent');
          } else {
            debugLog('⚠️ No state found for match:', data.matchID);
          }
        } catch (error) {
          debugLog('❌ Error:', error.message);
          console.error(error);
        }
      });

      // Handle joining a game room
      socket.on('joinGame', (matchID) => {
        socket.join(matchID);
        console.log(`Client ${socket.id} joined game ${matchID}`);
      });
      
      socket.on('error', (error) => {
        debugLog('❌ Socket error:', error);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('🔴 Client disconnected:', socket.id, 'Reason:', reason);
      });
    });

    const PORT = process.env.PORT || 8080;
    
    server.run({
      server: httpServer,
      port: PORT
    });
    
    console.log(`Server running on port ${PORT}`);
    
  } catch (error) {
    console.error('Server startup error:', error);
  }
})();