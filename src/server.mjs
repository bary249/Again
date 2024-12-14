import { Server } from 'boardgame.io/dist/cjs/server.js';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import express from 'express';
import { MyGame } from './Game/game.js';

console.error('[STARTUP] Server code starting...');

(async () => {
  try {
    console.log('Starting server setup...');
    
    // Store active games and their states
    const gameStates = new Map();

    // Create Express app
    const app = express();

    // Put request logging FIRST, before any other middleware
    app.use((req, res, next) => {
      console.error('==================================');
      console.error(`[REQUEST] Incoming ${req.method} ${req.path}`);
      console.error('[REQUEST] Headers:', req.headers);
      console.error('[REQUEST] Query:', req.query);
      console.error('[REQUEST] Body:', req.body);
      console.error('==================================');
      next();
    });

    // THEN add json parsing
    app.use(express.json());

    // Create boardgame.io server
    const server = Server({
      games: [MyGame],
      origins: ['http://localhost:3000', 'https://lively-chaja-8eb605.netlify.app']
    });

    // Handle preflight requests
    app.options('*', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.status(200).end();
    });

    // Modify the GET endpoint for game state
    app.get('/games/:name/:id/state', (req, res) => {
      const { name, id } = req.params;
      console.error(`[DEBUG] Fetching game state for game ${name}, id: ${id}`);
      
      const state = gameStates.get(id);
      const internalState = server.getState(id);
      
      console.error('[DEBUG] State check:', {
        hasState: !!state,
        hasInternalState: !!internalState,
        gameStatesSize: gameStates.size,
        availableIds: Array.from(gameStates.keys())
      });
      
      if (!state) {
        console.error(`[DEBUG] Game state not found for id: ${id}`);
        return res.status(404).json({ 
          error: 'Game not found',
          details: 'No game state found for this ID',
          availableIds: Array.from(gameStates.keys())
        });
      }

      if (!internalState) {
        console.error(`[DEBUG] Internal game state not found for id: ${id}`);
        return res.status(404).json({ 
          error: 'Game not found',
          details: 'No internal game state found for this ID'
        });
      }

      const fullState = {
        matchID: id,
        state: {
          ...state,
          G: internalState.G,
          ctx: internalState.ctx
        }
      };

      console.error('[DEBUG] Returning full state:', fullState);
      res.json(fullState);
    });

    // Add GET endpoint for list of games
    app.get('/games/list', (req, res) => {
      const games = Array.from(gameStates.entries()).map(([id, state]) => {
        // Get the internal game state for each game
        const internalState = server.getState(id);
        return {
          matchID: id,
          state: {
            ...state,
            G: internalState?.G,
            ctx: internalState?.ctx
          }
        };
      });
      
      res.json({
        matches: games
      });
    });

    // Add POST endpoint for game creation
    app.post('/games/:name/create', (req, res) => {
      const { name } = req.params;
      const matchID = `${Date.now()}`; // Generate a unique match ID
      
      // Create initial game state
      const initialState = {
        matchID,
        players: {},
        createdAt: new Date().toISOString()
      };
      
      gameStates.set(matchID, initialState);
      
      res.status(200).json({
        matchID,
        initialState
      });
    });

    // Listen for game state changes
    app.post('/games/:name/:id/update', (req, res) => {
      const { name, id } = req.params;
      const state = req.body;
      
      // Store the updated state
      gameStates.set(id, state);
      
      // Emit to all connected clients
      io.emit('gameUpdate', {
        matchID: id,
        state: state
      });
      
      res.status(200).end();
    });

    // Create HTTP server
    const httpServer = createServer(app);
    
    // Create Socket.IO server
    const io = new SocketIO(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: false
      }
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Send current game states to newly connected client
      gameStates.forEach((state, matchID) => {
        socket.emit('gameUpdate', {
          matchID,
          state
        });
      });

      socket.on('joinGame', (matchID) => {
        console.log(`Client ${socket.id} joining game ${matchID}`);
        socket.join(matchID);
        
        // Send current state if available
        const state = gameStates.get(matchID);
        if (state) {
          socket.emit('gameUpdate', {
            matchID,
            state
          });
        }
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
      });
    });

    // Get port from environment variable or fallback to 8080
    const PORT = process.env.PORT || 8080;

    // Start the Express server first
    await server.run({
      port: PORT,
      server: httpServer
    });
    console.log(`Server running on port ${PORT}`);
    
  } catch (error) {
    console.error('Server startup error:', error);
  }
})();