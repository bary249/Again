import React, { useState } from 'react';
import { Client } from 'boardgame.io/dist/esm/react.js';
import { SocketIO } from 'boardgame.io/dist/esm/multiplayer.js';
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
});

const App = () => {
  const [matchID, setMatchID] = useState(null);
  const [showPlayer, setShowPlayer] = useState(null);

  const createMatch = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/games/default/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Initial screen - Create Match
  if (!matchID) {
    return (
      <div className="App">
        <h1>Card Game</h1>
        <button onClick={createMatch}>Create New Match</button>
      </div>
    );
  }

  // Player Selection screen
  if (!showPlayer) {
    return (
      <div className="App">
        <h1>Card Game - Match {matchID}</h1>
        <button onClick={() => setShowPlayer("0")}>Join as Player 1</button>
        <button onClick={() => setShowPlayer("1")}>Join as Player 2</button>
      </div>
    );
  }

  // Game screen
  return (
    <div className="App">
      <h1>Card Game - Match {matchID}</h1>
      <p>You are Player {parseInt(showPlayer) + 1}</p>
      <GameClient playerID={showPlayer} matchID={matchID} />
      <button onClick={() => {
        setShowPlayer(null);
        setMatchID(null);
      }}>Leave Game</button>
    </div>
  );
};

export default App;
