import React, { useState, useEffect, useRef } from 'react';
import { Client } from 'boardgame.io/dist/esm/react.js';
import { MyGame } from './Game/game.js';
import Board from './board.js';

// PieSocket configuration
const PIESOCKET_CONFIG = {
  CLUSTER: 's13859.blr1.piesocket.com',
  API_KEY: 'vUFwZHAitVqqz7zAasz9QJeICbKVn8wEECWDzHOA',
  CHANNEL: '1',
  VERSION: 'v3'
};

const createPieSocketURL = () => {
  return `wss://${PIESOCKET_CONFIG.CLUSTER}/${PIESOCKET_CONFIG.VERSION}/${PIESOCKET_CONFIG.CHANNEL}?api_key=${PIESOCKET_CONFIG.API_KEY}&notify_self=1`;
};

// Remove Socket.IO multiplayer configuration
const GameClient = Client({
  game: MyGame,
  board: Board,
  numPlayers: 2,
  debug: true
});

// Add this after your PieSocket configuration
const TEST_GAME_STATE = {
  G: {
    crystals: {
      0: { hp: 2 },
      1: { hp: 2 }
    },
    players: {
      0: { hand: ['card1', 'card2'], ap: 20 },
      1: { hand: ['card3', 'card4'], ap: 20 }
    }
  },
  ctx: {
    currentPlayer: '0',
    phase: 'play',
    turn: 1
  }
};

// Add these test functions
window.testPieSocket = {
  // Send test game state
  sendGameState: () => {
    if (window.pieSocket) {
      window.pieSocket.send(JSON.stringify({
        type: 'gameStateUpdate',
        ...TEST_GAME_STATE,
        timestamp: Date.now()
      }));
      console.log('🎮 Test game state sent');
    } else {
      console.error('❌ PieSocket not connected');
    }
  },

  // Send custom data
  sendCustomData: (data) => {
    if (window.pieSocket) {
      window.pieSocket.send(JSON.stringify({
        type: 'customData',
        data: data,
        timestamp: Date.now()
      }));
      console.log('📤 Custom data sent:', data);
    }
  },

  // Helper to check current game state
  getGameState: () => {
    console.log('Current game state:', window.gameState);
  }
};

const App = () => {
  const [matchID, setMatchID] = useState(null);
  const [showPlayer, setShowPlayer] = useState(null);
  const [joinMatchID, setJoinMatchID] = useState('');
  const wsRef = useRef(null);
  const [currentGameState, setCurrentGameState] = useState(null);

  useEffect(() => {
    if (matchID && showPlayer) {
      const ws = new WebSocket(createPieSocketURL());

      ws.onopen = () => {
        console.log('🟢 PieSocket Connected');
        ws.send(JSON.stringify({
          type: 'join',
          matchID: matchID,
          playerID: showPlayer
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 Received message:', data);

          if (data.type === 'gameStateUpdate') {
            console.log('🎮 Updating game state:', data.G);
            setCurrentGameState(data);
            // Force a re-render of the game client
            if (window.gameClient) {
              window.gameClient.updatePlayerID(showPlayer);
            }
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      wsRef.current = ws;
      window.pieSocket = ws;

      // Keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      return () => {
        clearInterval(pingInterval);
        if (wsRef.current) {
          wsRef.current.close();
          window.pieSocket = null;
        }
      };
    }
  }, [matchID, showPlayer]);

  // Function to broadcast game state
  const broadcastGameState = (G, ctx) => {
    console.log('📤 Broadcasting state:', { G, ctx });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const stateUpdate = {
        type: 'gameStateUpdate',
        G: G,
        ctx: ctx,
        matchID: matchID,
        sourcePlayer: showPlayer,
        timestamp: Date.now()
      };
      wsRef.current.send(JSON.stringify(stateUpdate));
      setCurrentGameState(stateUpdate);
    }
  };

  // Create enhanced game client
  const EnhancedGameClient = ({ ...props }) => {
    useEffect(() => {
      window.gameClient = props;
    }, [props]);

    return (
      <GameClient
        {...props}
        gameState={currentGameState}
        onStateChange={(state) => {
          console.log('🔄 Game state changed:', state);
          broadcastGameState(state.G, state.ctx);
        }}
      />
    );
  };

  const createMatch = () => {
    const newMatchID = Math.random().toString(36).substring(2, 15);
    console.log('Created match:', newMatchID);
    setMatchID(newMatchID);
    setShowPlayer('0');
  };

  if (!matchID) {
    return (
      <div className="App">
        <h1>Card Game</h1>
        <button onClick={createMatch}>Create New Match</button>
        <div style={{ marginTop: '20px' }}>
          <input 
            type="text" 
            value={joinMatchID}
            onChange={(e) => setJoinMatchID(e.target.value)}
            placeholder="Enter Match ID"
          />
          <button onClick={() => setMatchID(joinMatchID)}>Join Match</button>
        </div>
      </div>
    );
  }

  if (!showPlayer) {
    return (
      <div className="App">
        <h1>Card Game - Match {matchID}</h1>
        <button onClick={() => setShowPlayer("0")}>Join as Player 0</button>
        <button onClick={() => setShowPlayer("1")}>Join as Player 1</button>
      </div>
    );
  }

  return (
    <div className="App">
      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
        <button onClick={() => {
          if (wsRef.current) {
            wsRef.current.close();
            window.pieSocket = null;
          }
          setShowPlayer(null);
          setMatchID(null);
          setJoinMatchID('');
        }}>Leave Game</button>
      </div>
      <h1>Card Game - Match {matchID}</h1>
      <p>You are Player {showPlayer}</p>
      <EnhancedGameClient 
        playerID={showPlayer} 
        matchID={matchID}
      />
      {/* Debug panel */}
      <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h3>Debug Panel</h3>
        <button onClick={() => console.log('Current state:', currentGameState)}>
          Log Current State
        </button>
      </div>
    </div>
  );
};

// Test functions for debugging
window.testPieSocket = {
  sendTestState: () => {
    if (window.pieSocket) {
      const testState = {
        type: 'gameStateUpdate',
        G: {
          crystals: {
            0: { hp: 2 },
            1: { hp: 2 }
          },
          players: {
            0: { hand: ['card1', 'card2'], ap: 20 },
            1: { hand: ['card3', 'card4'], ap: 20 }
          }
        },
        ctx: {
          currentPlayer: '0',
          phase: 'play',
          turn: 1
        },
        timestamp: Date.now()
      };
      window.pieSocket.send(JSON.stringify(testState));
      console.log('🎮 Test state sent');
    }
  },
  getState: () => {
    console.log('Current game state:', window.gameClient?.gameState);
  }
};

export default App;
