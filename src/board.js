// board.js
import React, { useEffect } from 'react';
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
const Column = ({ G, column, columnIndex, currentPlayerID, opponentID, moves, isCommitted }) => {
  // State for active cards
  const [activeCard, setActiveCard] = React.useState({
    player: 'top',
    opponent: 'top'
  });

  if (!column || !column.tiers || column.activeTier === undefined) return null;
  
  const activeTier = column.tiers[column.activeTier] || { cards: {} };

  // Helper function to toggle card view on click
  const toggleCardView = (section) => {
    setActiveCard(prev => ({
      ...prev,
      [section]: prev[section] === 'top' ? 'bottom' : 'top'
    }));
  };

  // Get the current sequence of logs
  const columnLogs = Array.isArray(G?.combatLog) 
    ? G.combatLog.filter((log, index, array) => {
        // If it's a tick or round marker, always include it
        if (log.startsWith('---') || log.startsWith('===')) {
          return true;
        }
        
        // If this log mentions the column directly, it belongs here
        if (log.includes(`Column ${columnIndex + 1}`)) {
          return true;
        }

        // For other logs, check if they belong to the current column's sequence
        // by looking at the previous column declaration
        for (let i = index; i >= 0; i--) {
          const previousLog = array[i];
          if (previousLog.includes('Column')) {
            return previousLog.includes(`Column ${columnIndex + 1}`);
          }
        }
        
        return false;
      })
    : [];

  return (
    <div className="column">
      <div className="tier-container active-tier">
        <div className="tier-header">
          <div className="tier-title">Tier {column.activeTier + 1}</div>
          <span className="active-badge">Active</span>
        </div>
        
        <div className="tier-sections">
          {/* Current player's cards */}
          <div className="player-section">
            <h4 className="section-title">Your Cards</h4>
            <div className="cards-stack" style={{ position: 'relative', height: '250px' }}>
              {((activeTier.cards || {})[currentPlayerID] || []).map((card, index) => {
                const isTop = index === 0;
                const isActive = (isTop && activeCard.player === 'top') || 
                               (!isTop && activeCard.player === 'bottom');
                
                return (
                  <div 
                    key={card.id} 
                    onClick={() => toggleCardView('player')}
                    style={{ 
                      position: 'absolute',
                      top: isTop ? '0' : '125px', // Bottom card shows 50% below top card
                      left: '0',
                      right: '0',
                      zIndex: isActive ? 10 : 1,
                      opacity: isActive ? 1 : 0.1,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div className={`board-card ${isTop ? 'top-card' : 'bottom-card'}`}
                         style={{
                           border: isTop ? '3px solid #4CAF50' : '2px solid #9E9E9E',
                           boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                           background: 'white',
                           borderRadius: '8px',
                           padding: '10px'
                         }}>
                      <div className="card-title">{card.name}</div>
                      <div className="card-stats">
                        Cost: {card.cost} | Tick: {card.tick}
                        <br />
                        HP: {card.hp} | DMG: {card.damage}
                      </div>
                      {card.lastTickActed > 0 && (
                        <div className="card-tick">Last acted: Tick {card.lastTickActed}</div>
                      )}
                      {isTop && !isCommitted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card toggle
                            moves && moves.removeCardFromBoard(columnIndex);
                          }}
                          className="remove-from-board-button"
                        >
                          Take Back
                        </button>
                      )}
                      <div className="stack-position" style={{
                        backgroundColor: isTop ? '#e8f5e9' : '#f5f5f5',
                        padding: '4px',
                        marginTop: '8px',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        {isTop ? '▲ TOP' : '▼ BOTTOM'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column Combat Log */}
          <div className="column-combat-log">
            <h4 className="log-title">Column {columnIndex + 1} Combat</h4>
            <div className="column-log-entries">
              {columnLogs.map((log, index) => (
                <div key={index} className="column-log-entry">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Opponent's cards */}
          <div className="opponent-section">
            <h4 className="section-title">Opponent's Cards</h4>
            <div className="cards-stack" style={{ position: 'relative', height: '250px' }}>
              {((activeTier.cards || {})[opponentID] || []).map((card, index) => {
                const isTop = index === 0;
                const isActive = (isTop && activeCard.opponent === 'top') || 
                               (!isTop && activeCard.opponent === 'bottom');
                
                return (
                  <div 
                    key={card.id} 
                    onClick={() => toggleCardView('opponent')}
                    style={{ 
                      position: 'absolute',
                      top: isTop ? '0' : '125px',
                      left: '0',
                      right: '0',
                      zIndex: isActive ? 10 : 1,
                      opacity: isActive ? 1 : 0.1,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div className={`board-card ${isTop ? 'top-card' : 'bottom-card'}`}
                         style={{
                           border: isTop ? '3px solid #4CAF50' : '2px solid #9E9E9E',
                           boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                           background: 'white',
                           borderRadius: '8px',
                           padding: '10px'
                         }}>
                      <div className="card-title">{card.name}</div>
                      <div className="card-stats">
                        Cost: {card.cost} | Tick: {card.tick}
                        <br />
                        HP: {card.hp} | DMG: {card.damage}
                      </div>
                      {card.lastTickActed > 0 && (
                        <div className="card-tick">Last acted: Tick {card.lastTickActed}</div>
                      )}
                      <div className="stack-position" style={{
                        backgroundColor: isTop ? '#e8f5e9' : '#f5f5f5',
                        padding: '4px',
                        marginTop: '8px',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        {isTop ? '▲ TOP' : '▼ BOTTOM'}
                      </div>
                    </div>
                  </div>
                );
              })}
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
  
  const canEndRound = G.roundPhase === 'combat' && !G.isSimulating;

  // Add ticker effect
  useEffect(() => {
    let tickInterval;
    if (G.isSimulating) {
      tickInterval = setInterval(() => {
        moves.processTick();
      }, 1000); // 1 second per tick
    }
    return () => clearInterval(tickInterval);
  }, [G.isSimulating, moves]);

  return (
    <div className="admin-controls">
      <div className="game-state">
        <div className="player-states">
          <div>Player 0: {G.players['0'].committed ? 'Committed' : 'Playing'}</div>
          <div>Player 1: {G.players['1'].committed ? 'Committed' : 'Playing'}</div>
        </div>
        <div className="round-info">
          <div>Round: {G.currentRound}</div>
          <div className={G.isSimulating ? 'tick-active' : ''}>
            Current Tick: {G.currentTick}/5
          </div>
          <div>Phase: {G.roundPhase}</div>
        </div>
      </div>
      <div className="admin-buttons">
        <button 
          onClick={() => moves.simulateRound()}
          disabled={!canSimulateCombat || G.isSimulating}
          className="simulate-button"
        >
          {G.isSimulating ? 'Simulating...' : 'Simulate Combat'}
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

// Add this new component near the top of the file
const WinnerDisplay = ({ winner }) => {
  if (!winner) return null;
  
  return (
    <div className="winner-overlay">
      <div className="winner-message">
        🎉 Player {winner} Wins! 🎉
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

  return (
    <div className="game-board">
      {/* Winner Display */}
      <WinnerDisplay winner={ctx.gameover?.winner} />

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

      {/* Game State Info */}
      {G.lastAction && (
        <div className="game-info">
          Last action: {G.lastAction}
        </div>
      )}

      {/* Admin Controls */}
      <AdminControls G={G} moves={moves} />

      {/* Central Crystal */}
      <div className="crystal-section">
        <CentralCrystal crystal={G.centralCrystal} />
      </div>

      {/* Columns */}
      <div className="columns-container">
        {(G.columns || []).map((column, columnIndex) => (
          <Column
            key={columnIndex}
            G={G}
            column={column}
            columnIndex={columnIndex}
            currentPlayerID={currentPlayerID}
            opponentID={opponentID}
            moves={moves}
            isCommitted={currentPlayer.committed}
          />
        ))}
      </div>

      {/* Player Info - Moved above hand */}
      <div className="player-info">
        <h3 className="player-title">Player {currentPlayerID}</h3>
        <div className="player-stats">
          <div>AP: {currentPlayer.ap}</div>
          <div>Gold: {currentPlayer.gold}</div>
          <div>Status: {currentPlayer.committed ? 'Committed' : 'Playing'}</div>
        </div>
        {!currentPlayer.committed ? (
          <button 
            onClick={() => moves && moves.commitPlayer(currentPlayerID)}
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

      {/* Hand */}
      <div className="hand">
        <h3 className="hand-title">Your Hand</h3>
        <div className="hand-cards">
          {(currentPlayer.hand || []).map((card) => (
            <Card
              key={card.id}
              card={card}
              onPlay={(cardId, columnIndex) => moves && moves.playCard(cardId, columnIndex)}
              onRemove={(cardId) => moves && moves.removeCard(cardId)}
              isPlayable={!currentPlayer.committed}
              isRemovable={!currentPlayer.committed}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Board;