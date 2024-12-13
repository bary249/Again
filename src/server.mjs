import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

(async () => {
  const { MyGame } = await import('./Game/game.js');
  
  const server = Server({
    games: [{ name: 'Again-game', game: MyGame }],
    origins: ['http://localhost:3000'],
    apiOrigins: ['http://localhost:3000']
  });

  const httpServer = createServer(server.app);
  const io = new SocketIO(httpServer, {
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true
    }
  });

  server.run({ server: httpServer, port: 8001 });
  
  console.log('Server running on port 8001');
})();