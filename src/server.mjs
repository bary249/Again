import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import express from 'express';
import { MyGame } from './Game/game.js';

// Define allowed origins explicitly
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://lively-chaja-8eb605.netlify.app',  // Your Netlify domain
  'https://again-production-04f0.up.railway.app',  // Your Railway URL
  'null',
  undefined  // Add this to handle undefined origin
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
      console.log('[CORS] Request from origin:', origin);
      
      // More permissive CORS handling
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      console.log('[CORS] Headers set for origin:', origin);
      
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }
      
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
        origin: '*',  // More permissive during development
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type']
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 30000,
      allowEIO3: true,
      path: '/socket.io'  // Explicitly set the path
    });

    // Add connection logging
    io.engine.on('connection_error', (err) => {
      console.log('[Socket.IO] Connection error:', err);
    });

    // Socket.IO connection handling with enhanced error handling
    io.on('connection', (socket) => {
      console.log('[Socket.IO] New connection:', {
        id: socket.id,
        transport: socket.conn.transport.name,
        headers: socket.handshake.headers
      });

      console.log('[SOCKET] New client connected:', socket.id);
      console.log('[SOCKET] Client origin:', socket.handshake.headers.origin);
      
      socket.on('error', (error) => {
        console.error('[Socket.IO] Socket error:', error);
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
          console.log(`[SOCKET] Client ${socket.id} joining game ${matchID} as ${playerID}`);
          
          // Join the game room regardless of player type
          socket.join(matchID);

          // Get game state
          const gameState = gameStates.get(matchID);
          
          if (gameState) {
            // If it's an observer, don't add them to players list
            if (playerID !== 'observer') {
              if (!gameState.players[playerID]) {
                gameState.players[playerID] = {
                  id: playerID,
                  socketId: socket.id,
                  joinedAt: new Date()
                };
              }
            }

            // Send current state to the client
            socket.emit('gameState', {
              matchID,
              playerID,
              state: gameState
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

      socket.on('move', async (data) => {
        try {
          const { matchID, move, args, playerID } = data;
          console.log(`[SOCKET] Move received for game ${matchID}:`, { move, args, playerID });
          
          const gameState = gameStates.get(matchID);
          if (!gameState) {
            throw new Error('Game state not found');
          }

          // Special handling for admin/test moves
          if (playerID === 'admin') {
            switch (move) {
              case 'simulateCombat':
                // Example combat simulation
                gameState.G = {
                  ...gameState.G,
                  combatResult: {
                    timestamp: new Date(),
                    damage: Math.floor(Math.random() * 10),
                    // Add more combat-related data
                  }
                };
                break;

              case 'resetGame':
                // Reset game to initial state
                gameState.G = MyGame.setup();
                gameState.ctx = {
                  numPlayers: 2,
                  turn: 0,
                  currentPlayer: '0',
                  playOrder: ['0', '1'],
                  playOrderPos: 0,
                  phase: 'play',
                  activePlayers: null
                };
                break;

              // Add more admin commands as needed
              default:
                throw new Error(`Unknown admin command: ${move}`);
            }

            // Save state and broadcast update
            gameStates.set(matchID, gameState);
            io.to(matchID).emit('gameUpdate', {
              state: {
                G: gameState.G,
                ctx: gameState.ctx,
                lastMove: {
                  type: move,
                  args,
                  playerID: 'admin',
                  timestamp: new Date()
                }
              }
            });
          } else {
            // Initialize G if it doesn't exist
            if (!gameState.G) {
              gameState.G = MyGame.setup();
            }

            // Initialize ctx if it doesn't exist
            if (!gameState.ctx) {
              gameState.ctx = {
                numPlayers: 2,
                turn: 0,
                currentPlayer: '0',
                playOrder: ['0', '1'],
                playOrderPos: 0,
                phase: 'play',
                activePlayers: null
              };
            }

            // Apply the move
            try {
              const moveFunction = MyGame.moves[move];
              if (!moveFunction) {
                throw new Error(`Move '${move}' not found`);
              }

              const moveCtx = {
                ...gameState.ctx,
                playerID,
                random: {
                  Die: (spotValue) => Math.floor(Math.random() * spotValue) + 1,
                  Number: () => Math.random(),
                  Shuffle: (deck) => {
                    let shuffled = [...deck];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    return shuffled;
                  }
                }
              };

              const newG = moveFunction({ G: gameState.G, ctx: moveCtx }, ...args);
              
              // Update game state
              gameState.G = newG;
              gameState.ctx.turn += 1;
              gameState.ctx.currentPlayer = gameState.ctx.playOrder[
                gameState.ctx.turn % gameState.ctx.numPlayers
              ];
              gameState.lastMove = {
                type: move,
                args,
                playerID,
                timestamp: new Date()
              };

              // Save updated state
              gameStates.set(matchID, gameState);

              // Broadcast update
              io.to(matchID).emit('gameUpdate', {
                state: {
                  G: gameState.G,
                  ctx: gameState.ctx,
                  lastMove: gameState.lastMove
                }
              });

            } catch (moveError) {
              console.error('[MOVE] Error applying move:', moveError);
              throw new Error(`Failed to apply move: ${moveError.message}`);
            }
          }

        } catch (error) {
          console.error('[SOCKET] Error processing move:', error);
          socket.emit('error', {
            message: 'Failed to process move',
            details: error.message
          });
        }
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