import React, { useState } from "react";
import { Client } from "boardgame.io/react";
import { MyGame } from "./Game/game";
import Board from "./board";
import "./App.css";

const GameClient = Client({
  game: MyGame,
  numPlayers: 2,
  board: Board,
  debug: true,
});

const App = () => {
  console.log("App rendering"); // Add this line here
  const [playerID, setPlayerID] = useState("0");
  console.log('App rendering GameClient with playerID:', playerID);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <h1>Card Game</h1>
      <div style={{ marginBottom: "20px" }}>
        <select
          value={playerID}
          onChange={(e) => setPlayerID(e.target.value)}
          style={{ fontSize: "16px", padding: "5px" }}
        >
          <option value="0">Player 0</option>
          <option value="1">Player 1</option>
        </select>
      </div>
      <GameClient playerID={playerID} />
    </div>
  );

};

export default App;
