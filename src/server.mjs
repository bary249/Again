import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { MyGame } from './Game/game.js';

const debugLog = (...args) => {
    console.log(new Date().toISOString(), ...args);
};

(async () => {
  try {
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
          res.header('Access-Control-Allow-Origin', 'https://lively-chaja-8eb605.netlify.app');
          res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
          res.header('Access-Control-Allow-Credentials', 'true');
          
          if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
          }
          next();
        });
      }
    });

    // Add Koa middleware for CORS
    server.app.use(async (ctx, next) => {
      ctx.set('Access-Control-Allow-Origin', 'https://lively-chaja-8eb605.netlify.app');
      ctx.set('Access-Control-Allow-Origin', 'http://localhost:3000');
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
      ctx.set('Access-Control-Allow-Credentials', 'true');

      if (ctx.method === 'OPTIONS') {
        ctx.status = 200;
        return;
      }
      
      await next();
    });

    const httpServer = createServer(server.app);
    const io = new SocketIO(httpServer, {
      cors: {
        origin: [
          'http://localhost:3000',
          'https://lively-chaja-8eb605.netlify.app'
        ],
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ['Content-Type', 'Accept'],
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
      console.log('🔌 Socket Connected:', socket.id);
      
      // Track rooms the socket is in
      let currentRooms = new Set();

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
          sourceSocket: socket.id,
          hasG: !!data.G,
          hasCtx: !!data.ctx
        });
        
        if (!data.matchID) {
          console.error('[SOCKET] No matchID in game state update');
          return;
        }

        // Broadcast to all clients in the room
        const room = io.sockets.adapter.rooms.get(data.matchID);
        console.log('[SOCKET] Broadcasting to room:', {
          matchID: data.matchID,
          clientCount: room ? room.size : 0,
          clients: room ? Array.from(room) : []
        });

        socket.to(data.matchID).emit('gameStateUpdate', {
          G: data.G,
          ctx: data.ctx,
          matchID: data.matchID,
          sourcePlayer: data.sourcePlayer,
          timestamp: data.timestamp
        });
      });

      // New handler for game state requests
      socket.on('requestGameState', async (data) => {
        console.log('[SOCKET] Game state requested:', {
          socketId: socket.id,
          matchID: data.matchID
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
            console.log('[SOCKET] State sent to requester:', socket.id);
          } else {
            console.log('[SOCKET] No state found for match:', data.matchID);
          }
        } catch (error) {
          console.error('[SOCKET] Error fetching state:', error);
        }
      });

      // Handle joining a game room
      socket.on('joinGame', (matchID) => {
        console.log('[SOCKET] Join Game Request:', { 
          socketId: socket.id, 
          matchID: matchID 
        });
        
        socket.join(matchID);
        currentRooms.add(matchID);
        
        // Log all clients in this room
        const room = io.sockets.adapter.rooms.get(matchID);
        console.log('[SOCKET] Room status:', {
          matchID: matchID,
          clientCount: room ? room.size : 0,
          clients: room ? Array.from(room) : []
        });
      });
      
      socket.on('error', (error) => {
        debugLog('❌ Socket error:', error);
      });
      
      socket.on('disconnect', () => {
        console.log('❌ Socket Disconnected:', socket.id);
      });

      socket.on('gameStateUpdate', (data) => {
        console.log('📤 Emitting game state:', {
          socketId: socket.id,
          matchID: data.matchID,
          type: data.type,
          timestamp: new Date().toISOString()
        });
        
        // Log the number of clients in the room
        const room = io.sockets.adapter.rooms.get(data.matchID);
        console.log('📢 Broadcasting to room:', {
          matchID: data.matchID,
          clientCount: room ? room.size : 0,
          clients: room ? Array.from(room) : []
        });
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