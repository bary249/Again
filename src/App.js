import React from 'react';
import { Client } from 'boardgame.io/dist/esm/react.js';
import { SocketIO } from 'boardgame.io/dist/esm/multiplayer.js';
import { MyGame } from './Game/game.js';
import { Bot } from './Game/bot.js';
import Board from './board.js';

const GameClient = Client({
  game: MyGame,
  board: Board,
  numPlayers: 2,
  multiplayer: SocketIO({ server: 'localhost:8001' }),
  debug: true,
  ai: {
    enumerate: Bot.enumerate,
    iterations: Bot.iterations,
    playoutDepth: Bot.playoutDepth,
  },
});

const App = () => {
  return (
    <div className="App">
      <h1>Card Game</h1>
      <div className="players">
        <GameClient playerID="0" />
        <GameClient playerID="1" />
      </div>
    </div>
  );
};

export default App;
