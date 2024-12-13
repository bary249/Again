import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

(async () => {
  const { MyGame } = await import('./Game/game.js');
  
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

  server.run({ server: httpServer, port: 8001 });
  
  console.log('Server running on port 8001');
  
  httpServer.on('error', (error) => {
    console.error('Server error:', error);
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
})();