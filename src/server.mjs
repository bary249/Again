import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

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
      console.log('🟢 Client connected:', socket.id);
      
      // Log all incoming events
      socket.onAny((eventName, ...args) => {
        console.log('📥 Incoming event:', {
          event: eventName,
          socketId: socket.id,
          args: args
        });
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
        console.log('🎲 Received requestGameState:', {
          matchID: data.matchID,
          socketId: socket.id
        });
        
        try {
          console.log('📦 Fetching state for match:', data.matchID);
          const state = await server.db.fetch(`default:${data.matchID}`);
          console.log('📦 Found state:', state ? 'yes' : 'no');
          
          if (state) {
            console.log('📤 Sending state to client:', socket.id);
            socket.emit('gameStateUpdate', {
              G: state.G,
              ctx: state.ctx
            });
            console.log('✅ State sent successfully');
          } else {
            console.log('⚠️ No state found for match:', data.matchID);
          }
        } catch (error) {
          console.error('❌ Error fetching state:', error);
          console.error('Stack:', error.stack);
        }
      });

      // Handle joining a game room
      socket.on('joinGame', (matchID) => {
        socket.join(matchID);
        console.log(`Client ${socket.id} joined game ${matchID}`);
      });
      
      socket.on('error', (error) => {
        console.error('Socket error:', error);
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