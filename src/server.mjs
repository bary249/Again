import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import express from 'express';
import { MyGame } from './Game/game.js';

// Define allowed origins explicitly
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://lively-chaja-8eb605.netlify.app',  // Your Netlify URL
  'https://again-production-04f0.up.railway.app'  // Your Railway URL
];

(async () => {
  try {
    console.log('Starting server setup...');
    
    // Store active games and their states
    const gameStates = new Map();
    const activeConnections = new Map();

    // Create Express app
    const app = express();

    // Add security headers and CORS with proper origin handling
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Add json parsing
    app.use(express.json());

    // Add root GET endpoint for health checks
    app.get('/', (req, res) => {
      res.json({
        status: 'ok',
        message: 'Game server is running',
        timestamp: new Date().toISOString(),
        activeGames: gameStates.size,
        activeConnections: activeConnections.size,
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Add health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    // Add game creation endpoint
    app.post('/games/:name/create', async (req, res) => {
      try {
        const gameName = req.params.name;
        console.log(`Creating new game of type: ${gameName}`);
        
        const matchID = `${gameName}_${Date.now()}`;
        const initialState = {
          matchID,
          players: {},
          setupData: req.body,
          gameName,
          G: MyGame.setup(),
          ctx: {
            numPlayers: 2,
            turn: 0,
            currentPlayer: '0',
            playOrder: ['0', '1'],
            playOrderPos: 0,
            phase: 'play',
            activePlayers: null
          }
        };
        
        gameStates.set(matchID, initialState);
        res.json({ matchID });
      } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
      }
    });

    // Create HTTP server
    const httpServer = createServer(app);
    
    // Create Socket.IO server with updated CORS
    const io = new SocketIO(httpServer, {
      cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type']
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Socket.IO connection handling with enhanced error handling
    io.on('connection', (socket) => {
      console.log('[SOCKET] New client connected:', socket.id);
      console.log('[SOCKET] Client origin:', socket.handshake.headers.origin);
      
      socket.on('error', (error) => {
        console.error('[SOCKET] Socket error:', error);
      });
      
      // Enhanced connection tracking
      activeConnections.set(socket.id, { 
        connectedAt: new Date(),
        currentGame: null,
        playerID: null
      });

      socket.onAny((eventName, ...args) => {
        console.log(`[SOCKET] Event ${eventName} received from ${socket.id}:`, args);
      });

      // Enhanced join game handling with full state
      socket.on('joinGame', async ({ matchID, playerID }) => {
        try {
          console.log(`[SOCKET] Client ${socket.id} joining game ${matchID} as player ${playerID}`);
          
          // Update connection tracking
          const connection = activeConnections.get(socket.id);
          if (connection) {
            if (connection.currentGame) {
              socket.leave(connection.currentGame);
            }
            connection.currentGame = matchID;
            connection.playerID = playerID;
          }
          
          socket.join(matchID);

          // Get game state from our storage
          const gameState = gameStates.get(matchID);
          
          if (gameState) {
            // Update players in the game state
            if (!gameState.players[playerID]) {
              gameState.players[playerID] = {
                id: playerID,
                socketId: socket.id,
                joinedAt: new Date()
              };
            }

            // Send complete state including metadata
            socket.emit('gameState', {
              matchID,
              playerID,
              state: gameState,
              metadata: {
                players: Object.keys(gameState.players),
                currentPlayer: gameState.players[playerID],
                phase: 'playing'
              }
            });

            // Notify other players
            socket.to(matchID).emit('playerJoined', {
              playerID,
              timestamp: new Date().toISOString(),
              metadata: {
                totalPlayers: Object.keys(gameState.players).length
              }
            });
          } else {
            throw new Error('Game not found');
          }
        } catch (error) {
          console.error('[SOCKET] Error in joinGame:', error);
          socket.emit('error', {
            message: 'Failed to join game',
            details: error.message
          });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('[SOCKET] Client disconnected:', socket.id, 'Reason:', reason);
        const connection = activeConnections.get(socket.id);
        if (connection?.currentGame) {
          io.to(connection.currentGame).emit('playerLeft', {
            playerID: connection.playerID,
            timestamp: new Date().toISOString(),
            reason: reason,
            metadata: {
              remainingPlayers: io.sockets.adapter.rooms.get(connection.currentGame)?.size || 0
            }
          });
        }
        activeConnections.delete(socket.id);
      });
    });

    // Get port from environment variable
    const PORT = process.env.PORT || 8080;

    // Start the server with enhanced logging
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Game server running on port ${PORT}`);
      console.log('Allowed origins:', ALLOWED_ORIGINS);
    });
    
  } catch (error) {
    console.error('Server startup error:', error);
  }
})();