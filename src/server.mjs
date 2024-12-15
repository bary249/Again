import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import express from 'express';
import { MyGame } from './Game/game.js';

(async () => {
  try {
    console.log('Starting server setup...');
    
    // Store active games and their states
    const gameStates = new Map();
    const activeConnections = new Map();

    // Create Express app
    const app = express();

    // Add security headers and CORS
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Add json parsing
    app.use(express.json());

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
    
    // Create Socket.IO server
    const io = new SocketIO(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET, POST, OPTIONS'],
        credentials: false
      }
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('[SOCKET] New client connected:', socket.id);
      
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
                phase: 'playing'  // or whatever phase system you're using
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

      socket.on('move', async (data) => {
        try {
          const { matchID, move, args, playerID } = data;
          console.log(`[SOCKET] Move received for game ${matchID}:`, { move, args, playerID });
          
          const gameState = gameStates.get(matchID);
          if (!gameState) {
            throw new Error('Game state not found');
          }

          // Apply the move using your game's move functions
          if (MyGame.moves && MyGame.moves[move]) {
            const context = {
              G: gameState.G,
              ctx: gameState.ctx,
              playerID: playerID
            };
            
            // Apply the move
            gameState.G = MyGame.moves[move](context, ...args);
            
            // Update turn/player if needed
            gameState.ctx.turn += 1;
            gameState.ctx.currentPlayer = gameState.ctx.playOrder[
              gameState.ctx.turn % gameState.ctx.numPlayers
            ];
          }

          // Record the move
          gameState.lastMove = {
            type: move,
            args: args,
            playerID: playerID,
            timestamp: new Date()
          };

          // Broadcast state update to all players
          io.to(matchID).emit('gameUpdate', {
            matchID,
            state: gameState,
            metadata: {
              move: gameState.lastMove,
              G: gameState.G,
              ctx: gameState.ctx
            }
          });
        } catch (error) {
          console.error('[SOCKET] Error processing move:', error);
          socket.emit('error', {
            message: 'Failed to process move',
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

      socket.on('error', (error) => {
        console.error('[SOCKET] Socket error for client', socket.id, ':', error);
        socket.emit('error', {
          message: 'Socket error occurred',
          details: error.message,
          timestamp: new Date().toISOString()
        });
      });
    });

    // Get port from environment variable
    const PORT = process.env.PORT || 8080;

    // Start the server
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Game server running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('Server startup error:', error);
  }
})();