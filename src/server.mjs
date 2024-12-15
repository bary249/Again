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
      origins: ALLOWED_ORIGINS
    });

    // Handle preflight requests
    app.options('*', (req, res) => {
      console.error('[CORS] Handling preflight request');
      const origin = req.headers.origin;
      
      // Check if the origin is allowed
      if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      
      res.status(200).end();
    });

    // Modify the GET endpoint for game state
    app.get('/games/:name/:id/state', (req, res) => {
      try {
        const { name, id } = req.params;
        console.error(`[STATE] Request for game ${name}, id: ${id}`);
        
        const state = gameStates.get(id);
        const internalState = server.getState(id);
        
        console.error('[STATE] Debug:', {
          hasState: !!state,
          hasInternalState: !!internalState,
          gameStatesSize: gameStates.size,
          availableIds: Array.from(gameStates.keys())
        });
        
        if (!state || !internalState) {
          console.error(`[STATE] Not found - id: ${id}`);
          return res.status(404).json({ 
            error: 'Game not found',
            details: !state ? 'No game state' : 'No internal state',
            availableIds: Array.from(gameStates.keys())
          });
        }

        console.error('[STATE] Sending response');
        res.json({
          matchID: id,
          state: {
            ...state,
            G: internalState.G,
            ctx: internalState.ctx
          }
        });
      } catch (error) {
        console.error('[ERROR] State endpoint:', error);
        res.status(500).json({ error: String(error) });
      }
    });

    // Add GET endpoint for list of games
    app.get('/games/list', (req, res) => {
      console.error('[LIST] Getting game list');
      try {
        const games = Array.from(gameStates.entries()).map(([id, state]) => {
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
        
        console.error('[LIST] Found games:', games.length);
        res.json({ matches: games });
      } catch (error) {
        console.error('[ERROR] List endpoint:', error);
        res.status(500).json({ error: String(error) });
      }
    });

    // Add POST endpoint for game creation
    app.post('/games/:name/create', (req, res) => {
      console.error('[CREATE] Creating new game');
      try {
        const { name } = req.params;
        const matchID = `${Date.now()}`; 
        
        const initialState = {
          matchID,
          players: {},
          createdAt: new Date().toISOString()
        };
        
        gameStates.set(matchID, initialState);
        
        console.error('[CREATE] Created game:', matchID);
        res.status(200).json({
          matchID,
          initialState
        });
      } catch (error) {
        console.error('[ERROR] Create endpoint:', error);
        res.status(500).json({ error: String(error) });
      }
    });

    // Add error handling middleware LAST
    app.use((err, req, res, next) => {
      console.error('[ERROR] Middleware caught:', err);
      res.status(500).json({ error: String(err) });
    });

    // Get port from environment variable or fallback to 8080
    const PORT = process.env.PORT || 8080;

    // Start the Express server first
    await server.run({
      port: PORT,
      server: httpServer
    });
    console.error(`[STARTUP] Server running on port ${PORT}`);
    
  } catch (error) {
    console.error('[FATAL] Server startup error:', error);
    process.exit(1);  // Exit on fatal errors
  }
})();