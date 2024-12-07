// board.js
import React from 'react';
import './board.css';

// Card component for hand cards
const Card = ({ card, onPlay, onRemove, isPlayable, isRemovable }) => {
  if (!card) return null;

  return (
    <div className="card">
      <div className="card-title">{card.name}</div>
      <div className="card-stats">
        Cost: {card.cost} | Tick: {card.tick}
        <br />
        HP: {card.hp} | DMG: {card.damage}
      </div>
      {card.lastTickActed > 0 && (
        <div className="card-tick">Last acted: Tick {card.lastTickActed}</div>
      )}
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
};

// Card component for board cards
const BoardCard = ({ card, onRemove, isRemovable }) => {
  if (!card) return null;
  
  return (
    <div className="board-card">
      <div className="card-title">{card.name}</div>
      <div className="card-stats">
        Cost: {card.cost} | Tick: {card.tick}
        <br />
        HP: {card.hp} | DMG: {card.damage}
      </div>
      {card.lastTickActed > 0 && (
        <div className="card-tick">Last acted: Tick {card.lastTickActed}</div>
      )}
      {isRemovable && (
        <button
          onClick={onRemove}
          className="remove-from-board-button"
        >
          Take Back
        </button>
      )}
    </div>
  );
};

// Central Crystal component
const CentralCrystal = ({ crystal }) => (
  <div className="central-crystal">
    <div className="crystal-hp">Central Crystal HP: {crystal.hp}</div>
    {crystal.lastDamagedBy !== null && (
      <div className="crystal-info">
        Last damaged by: Player {crystal.lastDamagedBy}
      </div>
    )}
  </div>
);

// Column component
const Column = ({ column, columnIndex, currentPlayerID, opponentID, moves, isCommitted }) => {
  if (!column || !column.tiers || column.activeTier === undefined) return null;
  
  const activeTier = column.tiers[column.activeTier] || { cards: {} };
  
  return (
    <div className="column">
      {/* Active Tier */}
      <div className="tier-container active-tier">
        <div className="tier-header">
          <div className="tier-title">Tier {column.activeTier + 1}</div>
          <span className="active-badge">Active</span>
        </div>
        
        <div className="tier-sections">
          {/* Current player's cards */}
          <div className="player-section">
            <h4 className="section-title">Your Cards</h4>
            <div className="cards-container">
              {((activeTier.cards || {})[currentPlayerID] || []).map((card, index) => (
                <BoardCard
                  key={card.id}
                  card={card}
                  isRemovable={!isCommitted && index === (activeTier.cards[currentPlayerID].length - 1)}
                  onRemove={() => moves && moves.removeCardFromBoard(columnIndex)}
                />
              ))}
            </div>
          </div>

          {/* Opponent's cards */}
          <div className="opponent-section">
            <h4 className="section-title">Opponent's Cards</h4>
            <div className="cards-container">
              {((activeTier.cards || {})[opponentID] || []).map((card) => (
                <BoardCard
                  key={card.id}
                  card={card}
                  isRemovable={false}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Controls component
const AdminControls = ({ G, moves }) => {
  const canSimulateCombat = G.players['0'].committed && 
                           G.players['1'].committed && 
                           G.roundPhase === 'playing';
  
  const canEndRound = G.roundPhase === 'combat';

  return (
    <div className="admin-controls">
      <div className="game-state">
        <div className="player-states">
          <div>Player 0: {G.players['0'].committed ? 'Committed' : 'Playing'}</div>
          <div>Player 1: {G.players['1'].committed ? 'Committed' : 'Playing'}</div>
        </div>
        <div className="round-info">
          <div>Round: {G.currentRound}</div>
          <div>Current Tick: {G.currentTick}/5</div>
          <div>Phase: {G.roundPhase}</div>
        </div>
      </div>
      <div className="admin-buttons">
        <button 
          onClick={() => moves.simulateRound()}
          disabled={!canSimulateCombat}
          className="simulate-button"
        >
          Simulate Combat
        </button>
        <button 
          onClick={() => moves.endRound()}
          disabled={!canEndRound}
          className="next-round-button"
        >
          Next Round
        </button>
      </div>
    </div>
  );
};

// Main Board component
const Board = ({ G, ctx, moves, playerID }) => {
  if (!G || !G.players) return <div>Loading...</div>;
  
  const currentPlayerID = playerID || '0';
  const currentPlayer = G.players[currentPlayerID] || { hand: [], ap: 0, gold: 0, committed: false };
  const opponentID = currentPlayerID === '0' ? '1' : '0';

  const handlePlayCard = (cardId, columnIndex) => {
    if (!moves || currentPlayer.committed) return;
    moves.playCard(cardId, columnIndex);
  };

  const handleCommit = () => {
    if (!moves || currentPlayer.committed) return;
    moves.commitPlayer(currentPlayerID);
  };

  return (
    <div className="game-board">
      {/* Game State Info */}
      {G.lastAction && (
        <div className="game-info">
          Last action: {G.lastAction}
        </div>
      )}

      {/* Admin Controls */}
      <AdminControls G={G} moves={moves} />

      {/* Player Info */}
      <div className="player-info">
        <h3 className="player-title">Player {currentPlayerID}</h3>
        <div className="player-stats">
          <div>AP: {currentPlayer.ap}</div>
          <div>Gold: {currentPlayer.gold}</div>
          <div>Status: {currentPlayer.committed ? 'Committed' : 'Playing'}</div>
        </div>
        {!currentPlayer.committed ? (
          <button 
            onClick={handleCommit}
            className="commit-button"
          >
            Commit Moves
          </button>
        ) : (
          <button 
            onClick={() => moves && moves.uncommitPlayer(currentPlayerID)}
            disabled={G.roundPhase !== 'playing'}
            className="uncommit-button"
          >
            Uncommit
          </button>
        )}
      </div>

      {/* Central Crystal */}
      <div className="crystal-section">
        <CentralCrystal crystal={G.centralCrystal} />
      </div>

      {/* Columns - Horizontal Layout */}
      <div className="columns-container">
        {(G.columns || []).map((column, columnIndex) => (
          <Column
            key={columnIndex}
            column={column}
            columnIndex={columnIndex}
            currentPlayerID={currentPlayerID}
            opponentID={opponentID}
            moves={moves}
            isCommitted={currentPlayer.committed}
          />
        ))}
      </div>

      {/* Hand */}
      <div className="hand">
        <h3 className="hand-title">Your Hand</h3>
        <div className="hand-cards">
          {(currentPlayer.hand || []).map((card) => (
            <Card
              key={card.id}
              card={card}
              onPlay={handlePlayCard}
              onRemove={(cardId) => moves && moves.removeCard(cardId)}
              isPlayable={!currentPlayer.committed}
              isRemovable={!currentPlayer.committed}
            />
          ))}
        </div>
      </div>

      {/* Combat Log */}
      <div className="combat-log">
        <h4 className="log-title">Combat Log</h4>
        <div className="log-entries">
          {(G.combatLog || []).map((log, index) => (
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