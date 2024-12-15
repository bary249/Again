import React, { useState, useEffect, useRef } from 'react';
import { Client } from 'boardgame.io/dist/esm/react.js';
import { SocketIO } from 'boardgame.io/dist/esm/multiplayer.js';
import { io } from 'socket.io-client';
import { MyGame } from './Game/game.js';
import Board from './board.js';

const SERVER_URL = 'https://again-production-04f0.up.railway.app';

const GameClient = Client({
  game: MyGame,
  board: Board,
  numPlayers: 2,
  multiplayer: SocketIO({ 
    server: SERVER_URL,
    secure: true
  }),
  debug: true,
  enhancer: (game) => ({
    ...game,
    onMove: (G, ctx) => {
      if (window.socket) {
        window.socket.emit('gameState', {
          G,
          ctx,
          matchID: game.matchID
        });
      }
    },
  }),
});

const App = () => {
  const [matchID, setMatchID] = useState(null);
  const [showPlayer, setShowPlayer] = useState(null);
  const [joinMatchID, setJoinMatchID] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (matchID && showPlayer) {
      socketRef.current = io(SERVER_URL);
      window.socket = socketRef.current;

      socketRef.current.emit('joinGame', matchID);

      socketRef.current.on('gameStateUpdate', ({ G, ctx }) => {
        console.log('Received game state update:', { G, ctx });
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          window.socket = null;
        }
      };
    }
  }, [matchID, showPlayer]);

  const createMatch = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/games/default/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          numPlayers: 2
        }),
      });
      const { matchID } = await response.json();
      setMatchID(matchID);
      console.log('Created match:', matchID);
    } catch (error) {
      console.error('Error creating match:', error);
    }
  };

  // Initial screen - Create Match or Join Match
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

  // Player Selection screen
  if (!showPlayer) {
    return (
      <div className="App">
        <h1>Card Game - Match {matchID}</h1>
        <button onClick={() => setShowPlayer("0")}>Join as Player 0</button>
        <button onClick={() => setShowPlayer("1")}>Join as Player 1</button>
      </div>
    );
  }

  // Game screen
  const handleLeaveGame = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      window.socket = null;
    }
    setShowPlayer(null);
    setMatchID(null);
    setJoinMatchID('');
  };

  return (
    <div className="App">
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px' 
      }}>
        <button onClick={handleLeaveGame}>Leave Game</button>
      </div>
      <h1>Card Game - Match {matchID}</h1>
      <p>You are Player {showPlayer}</p>
      <GameClient playerID={showPlayer} matchID={matchID} />
    </div>
  );
};

export default App;
