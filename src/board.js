import React from 'react';
import './board.css';

const Board = ({ G, ctx, moves, events, playerID }) => {
  console.log('Board rendering with:', { playerID, currentPlayer: ctx.currentPlayer });
  console.log('Rendering Board with ctx:', ctx);

  // Ensure playerID is always a string
  const currentPlayerID = playerID || '0';
  const currentPlayer = G.players[currentPlayerID];
  const isActive = currentPlayerID === ctx.currentPlayer;
  const opponentID = currentPlayerID === '0' ? '1' : '0';

  const handlePlayCard = (cardId, columnIndex) => {
    console.log('Attempting to play card:', {
      cardId,
      columnIndex,
      currentPlayer: ctx?.currentPlayer,
      playerID: currentPlayerID,
      isActive,
    });

    console.log('Type of cardId:', typeof cardId);
    console.log('Type of columnIndex:', typeof columnIndex);
  
    if (!isActive || !ctx?.currentPlayer) {
      console.error('Not active player or invalid context');
      return;
    }
  
    // Pass the correct arguments to moves.playCard
    console.log('Passing to playCard:', { cardId, columnIndex });
    console.log(G,ctx,cardId,columnIndex)
    moves.playCard(G,ctx, cardId, columnIndex);
  };

  return (
    <div className="game-board">
      {/* Player Info */}
      <div className="player-info">
        <h3>Player {currentPlayerID}</h3>
        <p>AP: {currentPlayer.ap}</p>
        <p>Gold: {currentPlayer.gold}</p>
        {isActive && (
          <button onClick={() => events.endTurn()}>End Turn</button>
        )}
      </div>

      {/* Game Controls */}
      <div className="game-controls">
        <button onClick={() => moves.simulateRound()}>Simulate Combat</button>
        <button onClick={() => moves.endRound()}>Next Round</button>
      </div>

      {/* Columns */}
      <div className="columns">
        {G.columns.map((column, columnIndex) => (
          <div key={columnIndex} className="column">
            {/* Crystal */}
            <div className="crystal">
              HP: {column.crystalHP}
            </div>

            {/* Display both players' cards */}
            <div className="players-area">
              {/* Current player's cards */}
              <div className="player-cards">
                <h4>Your Cards</h4>
                {(column.cards[currentPlayerID] || []).map((card, idx) => (
                  <div key={idx} className="card" style={{marginTop: idx * 20}}>
                    {card.name} (Stack: {idx + 1})
                    <br />
                    HP: {card.hp} DMG: {card.damage}
                    <br />
                    Tick: {card.tick}
                  </div>
                ))}
              </div>

              {/* Opponent's cards */}
              <div className="opponent-cards">
                <h4>Opponent's Cards</h4>
                {(column.cards[opponentID] || []).map((card, idx) => (
                  <div key={idx} className="card opponent" style={{marginTop: idx * 20}}>
                    {card.name} (Stack: {idx + 1})
                    <br />
                    HP: {card.hp} DMG: {card.damage}
                    <br />
                    Tick: {card.tick}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hand - only shown during player's turn */}
      {isActive && (
        <div className="hand">
          {currentPlayer.hand.map((card, index) => (
            <div key={index} className="card">
              {card.name}
              <br />
              Cost: {card.cost}
              <br />
              HP: {card.hp} DMG: {card.damage}
              <br />
              Tick: {card.tick}
              <div className="card-actions">
                {[0, 1, 2].map(columnIndex => {
                  const column = G.columns[columnIndex];
                  const stackSize = (column.cards[currentPlayerID] || []).length;
                  return (
                    <button 
                      key={columnIndex}
                      onClick={() => handlePlayCard(card.id, columnIndex)}
                      disabled={!isActive || stackSize >= 2}
                    >
                      Column {columnIndex + 1} ({stackSize}/2)
                    </button>
                  );
                })}
                <button 
                  onClick={() => moves.removeCard(card.id)}
                  className="remove-button"
                  disabled={!isActive}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Combat Log */}
      <div className="combat-log">
        <h4>Combat Log</h4>
        {G.combatLog && G.combatLog.map((log, index) => (
          <div key={index} className="log-entry">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Board;