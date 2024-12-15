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
        console.log('[SOCKET] Game state update received:', {
          matchID: data.matchID,
          sourcePlayer: data.sourcePlayer,
          sourceSocket: data.sourceSocket
        });
        
        // Only broadcast to other clients in the same game
        if (data.sourceSocket) {
          socket.broadcast.to(data.matchID).emit('gameStateUpdate', {
            G: data.G,
            ctx: data.ctx,
            sourcePlayer: data.sourcePlayer
          });
        }
      });

      // New handler for game state requests
      socket.on('requestGameState', async (data) => {
        console.log('[SOCKET] Request State:', { 
          socketId: socket.id, 
          matchID: data.matchID 
        });
        
        try {
          const state = await server.db.fetch(`default:${data.matchID}`);
          console.log('[SOCKET] State found:', {
            hasState: !!state,
            matchID: data.matchID,
            stateKeys: state ? Object.keys(state) : null
          });
          
          if (state) {
            // Log the actual state structure
            console.log('[SOCKET] State structure:', {
              hasG: !!state.G,
              hasCtx: !!state.ctx,
              GKeys: state.G ? Object.keys(state.G) : null,
              ctxKeys: state.ctx ? Object.keys(state.ctx) : null
            });

            socket.emit('gameStateUpdate', {
              G: state.G,
              ctx: state.ctx
            });
            console.log('[SOCKET] State sent to:', socket.id);
          } else {
            console.log('[SOCKET] No state for match:', data.matchID);
          }
        } catch (error) {
          console.log('[SOCKET] Error:', error.message);
          console.log('[SOCKET] Error stack:', error.stack);
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