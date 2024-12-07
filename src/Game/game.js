// game.js
import { generateDeck } from './cards';

// Constants
export const COLUMNS = 3;
export const INITIAL_CRYSTAL_HP = 20;
export const INITIAL_AP = 20;
export const INITIAL_HAND_SIZE = 5;

// Helper function to draw cards
const drawCards = (deck, count) => {
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
};

// Initial game state
const createInitialState = () => {
  const player0Deck = generateDeck();
  const player1Deck = generateDeck();
  
  const player0Draw = drawCards(player0Deck, INITIAL_HAND_SIZE);
  const player1Draw = drawCards(player1Deck, INITIAL_HAND_SIZE);

  return {
    columns: Array(COLUMNS).fill(null).map(() => ({
      crystalHP: INITIAL_CRYSTAL_HP,
      cards: {
        '0': [],
        '1': []
      }
    })),
    players: {
      '0': {
        hand: player0Draw.drawn,
        deck: player0Draw.remaining,
        ap: INITIAL_AP,
        gold: 0,
        committed: false
      },
      '1': {
        hand: player1Draw.drawn,
        deck: player1Draw.remaining,
        ap: INITIAL_AP,
        gold: 0,
        committed: false
      }
    },
    currentRound: 1,
    combatLog: [],
    roundPhase: 'playing', // playing -> combat -> end
    lastAction: null
  };
};

// Player moves
const playerMoves = {
  playCard: ({ G, ctx, playerID }, cardId, columnIndex) => {
    // Don't allow if player has committed
    if (G.players[playerID].committed) return;
    
    const player = G.players[playerID];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex === -1) return;
    
    const card = player.hand[cardIndex];
    const column = G.columns[columnIndex];
    
    // Validate move
    if (player.ap < card.cost) return;
    if ((column.cards[playerID] || []).length >= 2) return;
    
    // Execute move
    player.ap -= card.cost;
    player.hand.splice(cardIndex, 1);
    
    if (!column.cards[playerID]) {
      column.cards[playerID] = [];
    }
    
    column.cards[playerID].push(card);
    G.lastAction = `Player ${playerID} played ${card.name} to column ${columnIndex + 1}`;
  },

  removeCard: ({ G, ctx, playerID }, cardId) => {
    if (G.players[playerID].committed) return;
    
    const player = G.players[playerID];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex === -1) return;
    player.hand.splice(cardIndex, 1);
    G.lastAction = `Player ${playerID} removed a card`;
  },

  commitPlayer: ({ G, ctx }, playerID) => {
    G.players[playerID].committed = true;
    G.lastAction = `Player ${playerID} committed their moves`;
  },

  uncommitPlayer: ({ G, ctx }, playerID) => {
    // Only allow uncommit during playing phase
    if (G.roundPhase !== 'playing') return;
    G.players[playerID].committed = false;
    G.lastAction = `Player ${playerID} uncommitted their moves`;
  }
};

// Admin moves
const adminMoves = {
  simulateRound: ({ G, ctx }) => {
    // Only allow if both players have committed and we're in playing phase
    if (!G.players['0'].committed || !G.players['1'].committed || G.roundPhase !== 'playing') {
      return;
    }

    G.roundPhase = 'combat';
    G.combatLog.push(`--- Round ${G.currentRound} Combat ---`);
    
    G.columns.forEach((column, colIndex) => {
      const player0Cards = column.cards['0'] || [];
      const player1Cards = column.cards['1'] || [];
      
      // Process combat
      player0Cards.forEach(card => {
        if (player1Cards.length > 0) {
          const target = player1Cards[player1Cards.length - 1];
          target.hp -= card.damage;
          G.combatLog.push(`Column ${colIndex + 1}: ${card.name} deals ${card.damage} damage to ${target.name}`);
          
          if (target.hp <= 0) {
            player1Cards.pop();
            G.combatLog.push(`${target.name} is destroyed!`);
          }
        } else {
          column.crystalHP -= card.damage;
          G.combatLog.push(`Column ${colIndex + 1}: ${card.name} deals ${card.damage} damage to crystal`);
        }
      });

      player1Cards.forEach(card => {
        if (player0Cards.length > 0) {
          const target = player0Cards[player0Cards.length - 1];
          target.hp -= card.damage;
          G.combatLog.push(`Column ${colIndex + 1}: ${card.name} deals ${card.damage} damage to ${target.name}`);
          
          if (target.hp <= 0) {
            player0Cards.pop();
            G.combatLog.push(`${target.name} is destroyed!`);
          }
        } else {
          column.crystalHP -= card.damage;
          G.combatLog.push(`Column ${colIndex + 1}: ${card.name} deals ${card.damage} damage to crystal`);
        }
      });
    });
    
    G.lastAction = "Combat simulated";
  },

  endRound: ({ G, ctx }) => {
    // Only allow if we're in combat phase
    if (G.roundPhase !== 'combat') {
      return;
    }

    G.currentRound++;
    G.roundPhase = 'playing';
    
    // Reset player states
    Object.keys(G.players).forEach(playerID => {
      const player = G.players[playerID];
      player.ap = INITIAL_AP;
      player.committed = false;
      
      const draw = drawCards(player.deck, 1);
      player.hand.push(...draw.drawn);
      player.deck = draw.remaining;
    });
    
    G.lastAction = "Round ended";
    G.combatLog.push("--- Round Ended ---");
  }
};

export const MyGame = {
  setup: createInitialState,
  
  moves: {
    // Player moves
    playCard: {
      move: playerMoves.playCard,
      client: false  // Allow move from any player
    },
    removeCard: {
      move: playerMoves.removeCard,
      client: false
    },
    commitPlayer: {
      move: playerMoves.commitPlayer,
      client: false
    },
    uncommitPlayer: {
      move: playerMoves.uncommitPlayer,
      client: false
    },
    
    // Admin moves
    simulateRound: adminMoves.simulateRound,
    endRound: adminMoves.endRound
  },

  turn: {
    minMoves: 0,
    maxMoves: Infinity,
    activePlayers: { all: 'play' }  // All players are active simultaneously
  },

  endIf: ({ G }) => {
    const crystalDestroyed = G.columns.some(column => column.crystalHP <= 0);
    if (crystalDestroyed) {
      const losingColumn = G.columns.findIndex(column => column.crystalHP <= 0);
      return { winner: losingColumn === 0 ? '1' : '0' };
    }
  }
};