import React from 'react';
import { Client } from 'boardgame.io/dist/esm/react.js';
import { SocketIO } from 'boardgame.io/dist/esm/multiplayer.js';
import { MyGame } from './Game/game.js';
import Board from './board.js';

const GameClient = Client({
  game: MyGame,
  board: Board,
  numPlayers: 2,
  multiplayer: SocketIO({ 
    server: 'https://again-production-04f0.up.railway.app',  // Your confirmed working URL
    secure: true
  }),
  debug: true,
});

const App = () => {
  const [matchID] = React.useState('match-1');

  return (
    <div className="App">
      <h1>Card Game</h1>
      <div className="players">
        <GameClient playerID="0" matchID={matchID} />
        <GameClient playerID="1" matchID={matchID} />
      </div>
    </div>
  );
};

export default App;
