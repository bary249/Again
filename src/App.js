import React, { useState } from 'react';
import { Client } from 'boardgame.io/dist/esm/react.js';
import { SocketIO } from 'boardgame.io/dist/esm/multiplayer.js';
import { MyGame } from './Game/game.js';
import Board from './board.js';

const { hostname } = window.location;
const serverURL = hostname === 'localhost' 
  ? 'http://localhost:8080'
  : 'https://again-production-04f0.up.railway.app';

const GameClient = Client({
  game: MyGame,
  board: Board,
  numPlayers: 2,
  multiplayer: SocketIO({ 
    server: serverURL,
    socketOpts: {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: false,
    }
  }),
  debug: true,
});

const App = () => {
  const [matchID, setMatchID] = useState(null);
  const [showPlayer, setShowPlayer] = useState(null);
  const [joinMatchID, setJoinMatchID] = useState('');

  const createMatch = async () => {
    try {
      const response = await fetch(`${serverURL}/games/default/create`, {
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
  return (
    <div className="App">
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px' 
      }}>
        <button onClick={() => {
          setShowPlayer(null);
          setMatchID(null);
          setJoinMatchID('');
        }}>Leave Game</button>
      </div>
      <h1>Card Game - Match {matchID}</h1>
      <p>You are Player {showPlayer}</p>
      <GameClient playerID={showPlayer} matchID={matchID} />
    </div>
  );
};

export default App;
