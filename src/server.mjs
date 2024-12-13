import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

(async () => {
  try {
    const { MyGame } = await import('./Game/game.js');
    
    console.log('Starting server setup...');
    
    const server = Server({
      games: [MyGame],
      origins: ['*'],
    });

    const httpServer = createServer(server.app);
    const io = new SocketIO(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
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
      console.log('Client connected:', socket.id);
      
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
      });
    });

    // Add process error handlers
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    server.run({ 
      server: httpServer, 
      port: process.env.PORT || 8001  // Use environment port for Railway
    });
    
    console.log(`Server running on port ${process.env.PORT || 8001}`);
  } catch (error) {
    console.error('Server startup error:', error);
  }
})();