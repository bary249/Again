import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  try {
    const { MyGame } = await import('./Game/game.js');
    
    console.log('Starting server setup...');
    
    const server = Server({
      games: [MyGame],
      origins: ['*'],
    });

    // Serve static files from the build directory
    server.app.use(express.static('build'));

    // Handle all routes by serving index.html
    server.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'build', 'index.html'));
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