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
        app.use((req, res, next) => {
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
          
          // Handle OPTIONS preflight requests
          if (req.method === 'OPTIONS') {
              return res.status(200).end();
          }
          
          next();
        });
      }
    });

    const httpServer = createServer(server.app);
    const io = new SocketIO(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
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
      console.log('[SOCKET] Connected:', socket.id);
      
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
        console.log('[SOCKET] Game state update FULL DATA:', {
          matchID: data.matchID,
          sourcePlayer: data.sourcePlayer,
          sourceSocket: socket.id,
          hasG: !!data.G,
          hasCtx: !!data.ctx,
          G: data.G,  // Log the full G object
          ctx: data.ctx  // Log the full ctx object
        });
        
        // Broadcast to ALL clients in the room (including sender)
        io.in(data.matchID).emit('gameStateUpdate', {
          G: data.G,
          ctx: data.ctx,
          matchID: data.matchID,
          sourcePlayer: data.sourcePlayer,
          timestamp: data.timestamp
        });

        // Log what was emitted
        console.log('[SOCKET] Emitted state update to room:', data.matchID);
      });

      // New handler for game state requests
      socket.on('requestGameState', async (data) => {
        console.log('[SOCKET] Request State FULL DATA:', { 
          socketId: socket.id, 
          matchID: data.matchID,
          data: data
        });
        
        try {
          // Fetch game state from boardgame.io server
          const state = await server.db.fetch(`default:${data.matchID}`);
          console.log('[SOCKET] State found:', {
            hasState: !!state,
            matchID: data.matchID,
            fullState: state  // Log the full state
          });
          
          if (state) {
            socket.emit('gameStateUpdate', {
              G: state.G,
              ctx: state.ctx,
              matchID: data.matchID
            });
            console.log('[SOCKET] State sent to:', socket.id);
          } else {
            console.log('[SOCKET] No state found for match:', data.matchID);
          }
        } catch (error) {
          console.error('[SOCKET] Error fetching state:', error);
        }
      });

      // Handle joining a game room
      socket.on('joinGame', (matchID) => {
        console.log('[SOCKET] Join Game:', { socketId: socket.id, matchID });
        socket.join(matchID);
      });
      
      socket.on('error', (error) => {
        debugLog('❌ Socket error:', error);
      });
      
      socket.on('disconnect', () => {
        console.log('[SOCKET] Disconnected:', socket.id);
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