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
  debug: true
});

const App = () => {
  const [matchID, setMatchID] = useState(null);
  const [showPlayer, setShowPlayer] = useState(null);
  const [joinMatchID, setJoinMatchID] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (matchID && showPlayer) {
      const socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        autoConnect: true,
        withCredentials: true
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
      });

      socketRef.current = socket;
      window.socket = socket;

      socket.emit('joinGame', matchID);

      socket.on('gameStateUpdate', (data) => {
        console.log('📥 Received game state update:', {
          time: new Date().toISOString(),
          from: data.ctx.currentPlayer,
          matchID: data.matchID
        });
      });

      // Store socket reference for cleanup
      const currentSocket = socket;

      return () => {
        if (currentSocket) {
          currentSocket.disconnect();
          window.socket = null;
        }
      };
    }
  }, [matchID, showPlayer]);

  const createMatch = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/games/my-game/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numPlayers: 2
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { matchID } = await response.json();
      console.log('Created match:', { matchID });
      setMatchID(matchID);
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
