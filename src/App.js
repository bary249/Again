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
    server: 'localhost:8001',
    secure: false
  }),
  debug: true,
});

const App = () => {
  const [gameID] = React.useState('default');

  return (
    <div className="App">
      <h1>Card Game</h1>
      <div className="players">
        <GameClient playerID="0" gameID={gameID} />
        <GameClient playerID="1" gameID={gameID} />
      </div>
    </div>
  );
};

export default App;
