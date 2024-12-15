import React, { useState, useEffect } from 'react';
import { Client } from 'boardgame.io/dist/esm/react.js';
import { SocketIO } from 'boardgame.io/dist/esm/multiplayer.js';
import { MyGame } from './Game/game.js';
import Board from './board.js';
import io from 'socket.io-client';

const serverURL = 'https://again-production-04f0.up.railway.app';
const GAME_NAME = 'MyGame';

// Create the base client
const GameClient = Client({
  game: MyGame,
  board: Board,
  debug: true,
});

const App = () => {
  const [matchID, setMatchID] = useState(null);
  const [showPlayer, setShowPlayer] = useState(null);
  const [joinMatchID, setJoinMatchID] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [multiplayer, setMultiplayer] = useState(null);
  
  // First establish direct Socket.IO connection
  useEffect(() => {
    const socket = io(serverURL, {
      transports: ['polling'],
      reconnection: true,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('Direct Socket.IO connection successful!', socket.id);
      setIsConnected(true);
    });

    socket.on('connect_error', (error) => {
      console.error('Direct Socket.IO connection error:', error);
      setIsConnected(false);
    });

    return () => socket.disconnect();
  }, []);

  // Setup multiplayer when needed
  useEffect(() => {
    if (isConnected && showPlayer && matchID) {
      console.log('Setting up multiplayer for player', showPlayer, 'in match', matchID);
      
      const multiplayerClient = SocketIO({
        server: serverURL,
        socketOpts: {
          transports: ['polling'],
          reconnection: true,
          timeout: 20000,
          query: {
            'gameID': GAME_NAME,
            'playerID': showPlayer,
            'matchID': matchID,
            'credentials': matchID
          }
        }
      });

      setMultiplayer(multiplayerClient);
    }
  }, [isConnected, showPlayer, matchID]);

  const createMatch = async () => {
    if (!isConnected) {
      console.log('Waiting for connection before creating match...');
      return;
    }

    try {
      console.log('Creating match at:', `${serverURL}/games/${GAME_NAME}/create`);
      const response = await fetch(`${serverURL}/games/${GAME_NAME}/create`, {
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
        <div>Connection Status: {isConnected ? 'Connected' : 'Connecting...'}</div>
        <button onClick={createMatch} disabled={!isConnected}>Create New Match</button>
        <div style={{ marginTop: '20px' }}>
          <input 
            type="text" 
            value={joinMatchID}
            onChange={(e) => setJoinMatchID(e.target.value)}
            placeholder="Enter Match ID"
          />
          <button onClick={() => setMatchID(joinMatchID)} disabled={!isConnected}>Join Match</button>
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
          setMultiplayer(null);
        }}>Leave Game</button>
      </div>
      <h1>Card Game - Match {matchID}</h1>
      <p>You are Player {showPlayer}</p>
      <GameClient 
        matchID={matchID}
        playerID={showPlayer}
        credentials={matchID}
        multiplayer={multiplayer}
        debug={true}
      />
    </div>
  );
};

export default App;
