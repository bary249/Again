import React, { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { LobbyClient } from 'boardgame.io/client';
import { MyGame } from './Game/game.js';
import Board from './board.js';

const SERVER_URL = 'https://games.pie.host';
const GAME_NAME = 'my-game';

const lobbyClient = new LobbyClient({ server: SERVER_URL });

const GameClient = Client({
  game: MyGame,
  board: Board,
  numPlayers: 2,
  multiplayer: SocketIO({ server: SERVER_URL }),
  debug: { impl: Debug }
});

const App = () => {
  const [matchID, setMatchID] = useState(null);
  const [playerID, setPlayerID] = useState(null);
  const [joinMatchID, setJoinMatchID] = useState('');
  const [credentials, setCredentials] = useState(null);

  const createMatch = async () => {
    try {
      const { matchID: newMatchID } = await lobbyClient.createMatch(GAME_NAME, {
        numPlayers: 2
      });
      
      const { playerCredentials } = await lobbyClient.joinMatch(
        GAME_NAME,
        newMatchID,
        { playerID: '0' }
      );
      
      setMatchID(newMatchID);
      setPlayerID('0');
      setCredentials(playerCredentials);
      
      console.log(`Created match: ${newMatchID}`);
    } catch (error) {
      console.error('Error creating match:', error);
    }
  };

  const joinMatch = async () => {
    try {
      const { playerCredentials } = await lobbyClient.joinMatch(
        GAME_NAME,
        joinMatchID,
        { playerID: '1' }
      );
      
      setMatchID(joinMatchID);
      setPlayerID('1');
      setCredentials(playerCredentials);
      
      console.log(`Joined match: ${joinMatchID}`);
    } catch (error) {
      console.error('Error joining match:', error);
    }
  };

  const leaveMatch = async () => {
    if (matchID && playerID && credentials) {
      try {
        await lobbyClient.leaveMatch(GAME_NAME, matchID, {
          playerID,
          credentials
        });
      } catch (error) {
        console.error('Error leaving match:', error);
      }
    }
    setMatchID(null);
    setPlayerID(null);
    setCredentials(null);
    setJoinMatchID('');
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
          <button onClick={joinMatch}>Join Match</button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
        <button onClick={leaveMatch}>Leave Game</button>
      </div>
      <h1>Card Game - Match {matchID}</h1>
      <p>You are Player {playerID}</p>
      <GameClient 
        playerID={playerID} 
        matchID={matchID} 
        credentials={credentials}
      />
    </div>
  );
};

export default App;
