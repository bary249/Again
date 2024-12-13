import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import express from 'express';

(async () => {
  try {
    const { MyGame } = await import('./Game/game.js');
    
    console.log('Starting server setup...');
    
    const app = express();
    
    // Add CORS middleware
    app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true
    }));

    // Create boardgame.io server
    const server = Server({
      games: [MyGame],
      origins: ['*']
    });

    // Mount the boardgame.io server
    app.use(server.app);

    const httpServer = createServer(app);
    const io = new SocketIO(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    const PORT = process.env.PORT || 8080;
    
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('Server startup error:', error);
  }
})();