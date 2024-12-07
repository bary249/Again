// game.js
import { generateDeck } from './cards';

// Constants
export const COLUMNS = 3;
export const TIERS = 2;
export const INITIAL_CRYSTAL_HP = 20;
export const INITIAL_AP = 20;
export const INITIAL_HAND_SIZE = 5;
export const MAX_CARDS_PER_TIER = 2;
export const MAX_TICKS_PER_ROUND = 5;

const createInitialState = () => {
  const player0Deck = generateDeck();
  const player1Deck = generateDeck();
  
  const player0Draw = drawCards(player0Deck, INITIAL_HAND_SIZE);
  const player1Draw = drawCards(player1Deck, INITIAL_HAND_SIZE);

  return {
    columns: Array(COLUMNS).fill(null).map(() => ({
      crystalHP: INITIAL_CRYSTAL_HP,
      activeTier: 0,  // Track which tier is active for each column
      controllingPlayer: null,  // Track who controls the column at the active tier
      tiers: Array(TIERS).fill(null).map(() => ({
        cards: {
          '0': [],
          '1': []
        }
      }))
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
    currentTick: 1,
    combatLog: [],
    roundPhase: 'playing',
    lastAction: null
  };
};

// Helper function to draw cards
const drawCards = (deck, count) => {
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
};

// Player moves
const playerMoves = {
  playCard: ({ G, ctx, playerID }, cardId, columnIndex) => {
    if (G.players[playerID].committed) return;
    
    const player = G.players[playerID];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex === -1) return;
    
    const card = player.hand[cardIndex];
    const column = G.columns[columnIndex];
    const activeTier = column.activeTier;
    
    // Can only play at the active tier
    const tier = column.tiers[activeTier];
    
    // Validate move
    if (player.ap < card.cost) return;
    if ((tier.cards[playerID] || []).length >= MAX_CARDS_PER_TIER) return;
    
    // Execute move
    player.ap -= card.cost;
    player.hand.splice(cardIndex, 1);
    
    if (!tier.cards[playerID]) {
      tier.cards[playerID] = [];
    }
    
    tier.cards[playerID].push({ ...card, lastTickActed: 0 });
    G.lastAction = `Player ${playerID} played ${card.name} to column ${columnIndex + 1}, tier ${activeTier + 1}`;
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
    if (G.roundPhase !== 'playing') return;
    G.players[playerID].committed = false;
    G.lastAction = `Player ${playerID} uncommitted their moves`;
  }
};

const processCardAction = (G, card, columnIndex, playerID, targetPlayerID) => {
  const currentTick = G.currentTick;
  
  // Check if card should act this tick
  if (currentTick % card.tick !== 0 || card.lastTickActed === currentTick) return;
  
  const column = G.columns[columnIndex];
  const activeTier = column.activeTier;
  const tier = column.tiers[activeTier];
  const targetCards = tier.cards[targetPlayerID] || [];
  
  if (targetCards.length > 0) {
    // Attack opposing card
    const target = targetCards[targetCards.length - 1];
    target.hp -= card.damage;
    G.combatLog.push(`Tick ${currentTick}: Column ${columnIndex + 1}, Tier ${activeTier + 1}: ${card.name} deals ${card.damage} damage to ${target.name}`);
    
    if (target.hp <= 0) {
      targetCards.pop();
      G.combatLog.push(`${target.name} is destroyed!`);
      
      // Check if tier is now empty
      if (targetCards.length === 0 && tier.cards[playerID].length > 0) {
        // This player has won the tier
        G.combatLog.push(`Player ${playerID} has won tier ${activeTier + 1} in column ${columnIndex + 1}!`);
        column.controllingPlayer = playerID;
        
        // If there's another tier, advance to it
        if (activeTier < TIERS - 1) {
          column.activeTier++;
          G.combatLog.push(`Combat advances to tier ${column.activeTier + 1} in column ${columnIndex + 1}`);
        }
      }
    }
  } else {
    // Only damage crystal if at the last tier
    if (activeTier === TIERS - 1) {
      column.crystalHP -= card.damage;
      G.combatLog.push(`Tick ${currentTick}: Column ${columnIndex + 1}: ${card.name} deals ${card.damage} damage to crystal`);
    }
  }
  
  card.lastTickActed = currentTick;
};

// Admin moves
const adminMoves = {
  simulateRound: ({ G, ctx }) => {
    if (!G.players['0'].committed || !G.players['1'].committed || G.roundPhase !== 'playing') {
      return;
    }

    G.roundPhase = 'combat';
    G.combatLog.push(`--- Round ${G.currentRound} Combat ---`);
    
    // Process each tick
    for (G.currentTick = 1; G.currentTick <= MAX_TICKS_PER_ROUND; G.currentTick++) {
      G.combatLog.push(`--- Tick ${G.currentTick} ---`);
      
      // Process each column
      G.columns.forEach((column, columnIndex) => {
        const activeTier = column.activeTier;
        const tier = column.tiers[activeTier];
        
        // Process player 0's cards first
        (tier.cards['0'] || []).forEach(card => {
          processCardAction(G, card, columnIndex, '0', '1');
        });
        
        // Then process player 1's cards
        (tier.cards['1'] || []).forEach(card => {
          processCardAction(G, card, columnIndex, '1', '0');
        });
      });
    }
    
    G.lastAction = "Combat simulated";
    G.currentTick = 1;
  },

  endRound: ({ G, ctx }) => {
    if (G.roundPhase !== 'combat') return;

    G.currentRound++;
    G.roundPhase = 'playing';
    G.currentTick = 1;
    
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
      client: false
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
    activePlayers: { all: 'play' }
  },

  endIf: ({ G }) => {
    const crystalDestroyed = G.columns.some(column => column.crystalHP <= 0);
    if (crystalDestroyed) {
      const losingColumn = G.columns.findIndex(column => column.crystalHP <= 0);
      return { winner: losingColumn === 0 ? '1' : '0' };
    }
  }
};