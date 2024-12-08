import React from 'react';
import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';
import { MyGame } from './Game/game';
import { Bot } from './Game/bot';
import Board from './board';

const GameClient = Client({
  game: MyGame,
  board: Board,
  numPlayers: 2,
  multiplayer: Local(),
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
      <GameClient playerID="0" />
    </div>
  );
};

export default App;
