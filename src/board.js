// board.js
import React from 'react';
import './board.css';

const AdminControls = ({ G, moves }) => {
  const canSimulateCombat = G.players['0'].committed && 
                           G.players['1'].committed && 
                           G.roundPhase === 'playing';
                           
  const canEndRound = G.roundPhase === 'combat';

  return (
    <div className="admin-controls">
      <div className="player-states">
        <div>Player 0: {G.players['0'].committed ? 'Committed' : 'Playing'}</div>
        <div>Player 1: {G.players['1'].committed ? 'Committed' : 'Playing'}</div>
      </div>
      <div className="game-state">
        <div>Round: {G.currentRound}</div>
        <div>Current Tick: {G.currentTick}/5</div>
        <div>Phase: {G.roundPhase}</div>
      </div>
      <div className="admin-buttons">
        <button 
          className="admin-button combat"
          onClick={() => moves.simulateRound()}
          disabled={!canSimulateCombat}
          title={!canSimulateCombat ? "Both players must commit their moves first" : "Simulate combat for this round"}
        >
          Simulate Combat
        </button>
        <button 
          className="admin-button next-round"
          onClick={() => moves.endRound()}
          disabled={!canEndRound}
          title={!canEndRound ? "Combat must be simulated first" : "End the current round and start the next one"}
        >
          Next Round
        </button>
      </div>
    </div>
  );
};

const Card = ({ card, onPlay, onRemove, isPlayable, isRemovable }) => (
  <div className="card">
    {card.name}
    <br />
    Cost: {card.cost} | Tick: {card.tick}
    <br />
    HP: {card.hp} | DMG: {card.damage}
    {card.lastTickActed > 0 && <div>Last acted: Tick {card.lastTickActed}</div>}
    {(isPlayable || isRemovable) && (
      <div className="card-actions">
        {isPlayable && [0, 1, 2].map(colIndex => (
          <button
            key={colIndex}
            onClick={() => onPlay(card.id, colIndex)}
            className="play-button"
          >
            Column {colIndex + 1}
          </button>
        ))}
        {isRemovable && (
          <button
            onClick={() => onRemove(card.id)}
            className="remove-button"
          >
            Remove
          </button>
        )}
      </div>
    )}
  </div>
);

const Column = ({ column, columnIndex, currentPlayerID, opponentID }) => (
  <div className="column">
    {/* Crystal */}
    <div className="crystal">
      <div>Crystal HP: {column.crystalHP}</div>
      {column.controllingPlayer && (
        <div className="controller">
          Controlled by: Player {column.controllingPlayer}
        </div>
      )}
    </div>

    {/* Tiers */}
    {column.tiers.map((tier, tierIndex) => (
      <div key={tierIndex} 
           className={`tier-container ${column.activeTier === tierIndex ? 'active-tier' : ''}`}>
        <div className="tier-header">
          Tier {tierIndex + 1} 
          {column.activeTier === tierIndex && <span className="active-badge">Active</span>}
        </div>
        <div className="tier-sections">
          {/* Current player's cards */}
          <div className="player-section">
            <h4>Your Cards</h4>
            <div className="tier-cards">
              {(tier.cards[currentPlayerID] || []).map((card, idx) => (
                <Card
                  key={card.id}
                  card={card}
                  isPlayable={false}
                />
              ))}
            </div>
          </div>

          {/* Opponent's cards */}
          <div className="opponent-section">
            <h4>Opponent's Cards</h4>
            <div className="tier-cards">
              {(tier.cards[opponentID] || []).map((card, idx) => (
                <Card
                  key={card.id}
                  card={card}
                  isPlayable={false}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const Board = ({ G, ctx, moves, playerID }) => {
  const currentPlayerID = playerID || '0';
  const currentPlayer = G.players[currentPlayerID];
  const opponentID = currentPlayerID === '0' ? '1' : '0';

  const handlePlayCard = (cardId, columnIndex) => {
    if (currentPlayer.committed) return;
    moves.playCard(cardId, columnIndex);
  };

  return (
    <div className="game-board">
      {/* Game State Info */}
      <div className="game-info">
        {G.lastAction && <p>Last action: {G.lastAction}</p>}
      </div>

      {/* Admin Controls */}
      <AdminControls G={G} moves={moves} />

      {/* Player Info */}
      <div className="player-info">
        <h3>Player {currentPlayerID}</h3>
        <p>AP: {currentPlayer.ap}</p>
        <p>Gold: {currentPlayer.gold}</p>
        <p>Status: {currentPlayer.committed ? 'Committed' : 'Playing'}</p>
        
        {!currentPlayer.committed ? (
          <button 
            className="commit-button"
            onClick={() => moves.commitPlayer(currentPlayerID)}
          >
            Commit Moves
          </button>
        ) : (
          <button 
            className="uncommit-button"
            onClick={() => moves.uncommitPlayer(currentPlayerID)}
            disabled={G.roundPhase !== 'playing'}
          >
            Uncommit
          </button>
        )}
      </div>

      {/* Columns */}
      <div className="columns">
        {G.columns.map((column, columnIndex) => (
          <Column
            key={columnIndex}
            column={column}
            columnIndex={columnIndex}
            currentPlayerID={currentPlayerID}
            opponentID={opponentID}
          />
        ))}
      </div>

      {/* Hand */}
      <div className="hand">
        <h3>Your Hand</h3>
        {currentPlayer.hand.map((card) => (
          <Card
            key={card.id}
            card={card}
            onPlay={handlePlayCard}
            onRemove={(cardId) => moves.removeCard(cardId)}
            isPlayable={!currentPlayer.committed}
            isRemovable={!currentPlayer.committed}
          />
        ))}
      </div>

      {/* Combat Log */}
      <div className="combat-log">
        <h4>Combat Log</h4>
        <div className="log-entries">
          {G.combatLog && G.combatLog.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Board;