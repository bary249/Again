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
    
    // Create Express app
    const app = express();
    
    // Serve static files from the build directory
    app.use(express.static(path.join(__dirname, '../build')));

    // Create boardgame.io server
    const server = Server({
      games: [MyGame],
      origins: ['*'],
    });

    // Mount the boardgame.io server
    app.use(server.app);

    // Serve index.html for all other routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../build', 'index.html'));
    });

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