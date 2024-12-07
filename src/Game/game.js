// game.js
import { generateDeck } from "./cards";

// Constants
export const COLUMNS = 3;
export const TIERS = 2;
export const INITIAL_AP = 20;
export const INITIAL_HAND_SIZE = 5;
export const MAX_CARDS_PER_TIER = 2;
export const MAX_TICKS_PER_ROUND = 5;
export const INITIAL_CRYSTAL_HP = 2; // Shared crystal HP

const createInitialState = () => {
  const player0Deck = generateDeck();
  const player1Deck = generateDeck();

  const player0Draw = drawCards(player0Deck, INITIAL_HAND_SIZE);
  const player1Draw = drawCards(player1Deck, INITIAL_HAND_SIZE);

  return {
    centralCrystal: {
      hp: INITIAL_CRYSTAL_HP,
      lastDamagedBy: null,
    },
    columns: Array(COLUMNS)
      .fill(null)
      .map(() => ({
        activeTier: 0,
        controllingPlayer: null,
        tiers: Array(TIERS)
          .fill(null)
          .map(() => ({
            cards: {
              0: [],
              1: [],
            },
          })),
      })),
    players: {
      0: {
        hand: player0Draw.drawn,
        deck: player0Draw.remaining,
        ap: INITIAL_AP,
        gold: 0,
        committed: false,
      },
      1: {
        hand: player1Draw.drawn,
        deck: player1Draw.remaining,
        ap: INITIAL_AP,
        gold: 0,
        committed: false,
      },
    },
    currentRound: 1,
    currentTick: 1,
    combatLog: [],
    roundPhase: "playing",
    lastAction: null,
  };
};

// Helper function to draw cards
const drawCards = (deck, count) => {
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
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
    const target = targetCards[0];  // Get top defending card
    
    // If both cards are acting on the same tick and neither has acted yet
    if (currentTick % target.tick === 0 && target.lastTickActed !== currentTick) {
      // Handle simultaneous combat
      const cardDamage = card.damage;
      const targetDamage = target.damage;
      const oldCardHP = card.hp;
      const oldTargetHP = target.hp;
      
      // Apply damage
      card.hp -= targetDamage;
      target.hp -= cardDamage;
      
      // Record simultaneous combat exactly as shown
      G.combatLog.push(
        `Tick ${currentTick}: Column ${columnIndex + 1}, Tier ${activeTier + 1}: Simultaneous combat!`
      );
      G.combatLog.push(
        `${card.name} (${cardDamage} dmg) vs ${target.name} (${targetDamage} dmg)`
      );
      G.combatLog.push(
        `${card.name} HP: ${card.hp}, ${target.name} HP: ${target.hp}`
      );

      // Check for destroyed cards
      if (card.hp <= 0) {
        tier.cards[playerID].shift();
        G.combatLog.push(`${card.name} is destroyed!`);
      }

      if (target.hp <= 0) {
        targetCards.shift();
        G.combatLog.push(`${target.name} is destroyed!`);
      }

      card.lastTickActed = currentTick;
      target.lastTickActed = currentTick;
    } else {
      // Normal non-simultaneous combat
      const oldTargetHP = target.hp;
      target.hp -= card.damage;
      
      G.combatLog.push(
        `Tick ${currentTick}: Column ${columnIndex + 1}, Tier ${activeTier + 1}: ${card.name} deals ${card.damage} damage to ${target.name}`
      );

      if (target.hp <= 0) {
        targetCards.shift();
        G.combatLog.push(`${target.name} is destroyed!`);
      }
    }

    // Check if tier is now empty for either player
    if (targetCards.length === 0 && tier.cards[playerID].length > 0) {
      G.combatLog.push(
        `Player ${playerID} has won tier ${activeTier + 1} in column ${columnIndex + 1}!`
      );
      column.controllingPlayer = playerID;

      // If this was the last tier, damage the crystal
      if (activeTier === TIERS - 1) {
        G.centralCrystal.hp -= card.damage;
        G.centralCrystal.lastDamagedBy = playerID;
        G.combatLog.push(
          `Player ${playerID} deals ${card.damage} damage to the central crystal! Crystal HP: ${G.centralCrystal.hp}`
        );
      } else {
        // If there's another tier, advance to it
        tier.cards = { 0: [], 1: [] };
        column.activeTier++;
        G.combatLog.push(
          `Combat advances to tier ${column.activeTier + 1} in column ${columnIndex + 1}`
        );
      }
    }
  } else if (activeTier === TIERS - 1) {
    // Only damage crystal if at the last tier and no opposing cards
    G.centralCrystal.hp -= card.damage;
    G.centralCrystal.lastDamagedBy = playerID;
    G.combatLog.push(
      `Tick ${currentTick}: Column ${columnIndex + 1}, Tier ${activeTier + 1}: ${card.name} deals ${card.damage} damage to central crystal (HP: ${G.centralCrystal.hp})`
    );
  }

  card.lastTickActed = currentTick;
};

// Player moves
// In game.js, the complete playerMoves object:

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

  removeCardFromBoard: ({ G, playerID }, columnIndex) => {
    if (G.players[playerID].committed) return;
    
    const column = G.columns[columnIndex];
    const activeTier = column.activeTier;
    const tier = column.tiers[activeTier];
    const playerCards = tier.cards[playerID];
    
    // Check if player has any cards in this tier
    if (!playerCards || playerCards.length === 0) return;
    
    // Get the last card (most recently played)
    const card = playerCards[playerCards.length - 1];
    
    // Remove card from tier
    playerCards.pop();
    
    // Add card back to hand
    G.players[playerID].hand.push(card);
    
    // Refund AP cost
    G.players[playerID].ap += card.cost;
    
    G.lastAction = `Player ${playerID} took back ${card.name} from column ${columnIndex + 1}`;
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
// Admin moves
const adminMoves = {
  simulateRound: ({ G, ctx }) => {
    if (
      !G.players["0"].committed ||
      !G.players["1"].committed ||
      G.roundPhase !== "playing"
    ) {
      return;
    }

    G.roundPhase = "combat";
    G.combatLog.push(`--- Round ${G.currentRound} Combat ---`);
    G.currentTick = 1;  // Reset to 1
    G.isSimulating = true;  // Add this flag
  },

  processTick: ({ G, ctx }) => {
    if (!G.isSimulating || G.currentTick > MAX_TICKS_PER_ROUND) {
      G.isSimulating = false;
      return;
    }

    G.combatLog.push(`--- Tick ${G.currentTick} ---`);

    // Process each column
    G.columns.forEach((column, columnIndex) => {
      const activeTier = column.activeTier;
      const tier = column.tiers[activeTier];

      // Process player 0's cards first
      (tier.cards["0"] || []).forEach((card) => {
        processCardAction(G, card, columnIndex, "0", "1");
      });

      // Then process player 1's cards
      (tier.cards["1"] || []).forEach((card) => {
        processCardAction(G, card, columnIndex, "1", "0");
      });
    });

    G.currentTick++;
    if (G.currentTick > MAX_TICKS_PER_ROUND) {
      G.isSimulating = false;
    }
  },

  endRound: ({ G, ctx }) => {
    if (G.roundPhase !== "combat") return;

    // Check for unopposed cards before ending round
    G.columns.forEach((column, columnIndex) => {
      const activeTier = column.activeTier;
      const tier = column.tiers[activeTier];
      
      const player0Cards = tier.cards["0"]?.length || 0;
      const player1Cards = tier.cards["1"]?.length || 0;

      // If one player has cards and the other doesn't
      if (player0Cards > 0 && player1Cards === 0) {
        column.controllingPlayer = "0";
        G.combatLog.push(
          `Round End: Player 0 wins tier ${activeTier + 1} in column ${columnIndex + 1} (unopposed)`
        );

        // If this was the last tier, damage the crystal
        if (activeTier === TIERS - 1) {
          const damage = tier.cards["0"][0].damage; // Use the first card's damage
          G.centralCrystal.hp -= damage;
          G.centralCrystal.lastDamagedBy = "0";
          G.combatLog.push(
            `Player 0 deals ${damage} damage to the central crystal! Crystal HP: ${G.centralCrystal.hp}`
          );
        } else {
          // Advance to next tier
          tier.cards = { 0: [], 1: [] };
          column.activeTier++;
          G.combatLog.push(
            `Combat advances to tier ${column.activeTier + 1} in column ${columnIndex + 1}`
          );
        }
      } else if (player1Cards > 0 && player0Cards === 0) {
        column.controllingPlayer = "1";
        G.combatLog.push(
          `Round End: Player 1 wins tier ${activeTier + 1} in column ${columnIndex + 1} (unopposed)`
        );

        // If this was the last tier, damage the crystal
        if (activeTier === TIERS - 1) {
          const damage = tier.cards["1"][0].damage; // Use the first card's damage
          G.centralCrystal.hp -= damage;
          G.centralCrystal.lastDamagedBy = "1";
          G.combatLog.push(
            `Player 1 deals ${damage} damage to the central crystal! Crystal HP: ${G.centralCrystal.hp}`
          );
        } else {
          // Advance to next tier
          tier.cards = { 0: [], 1: [] };
          column.activeTier++;
          G.combatLog.push(
            `Combat advances to tier ${column.activeTier + 1} in column ${columnIndex + 1}`
          );
        }
      }
    });

    // Continue with normal round end logic
    G.currentRound++;
    G.roundPhase = "playing";
    G.currentTick = 1;

    // Reset player states but keep cards on board
    Object.keys(G.players).forEach((playerID) => {
      const player = G.players[playerID];
      player.ap = INITIAL_AP;
      player.committed = false;

      const draw = drawCards(player.deck, 1);
      player.hand.push(...draw.drawn);
      player.deck = draw.remaining;
    });

    // Reset lastTickActed for all cards on the board
    G.columns.forEach(column => {
      column.tiers.forEach(tier => {
        Object.values(tier.cards).forEach(playerCards => {
          playerCards.forEach(card => {
            card.lastTickActed = 0;
          });
        });
      });
    });

    G.lastAction = "Round ended";
    G.combatLog.push("--- Round Ended ---");
  },
};

export const MyGame = {
  setup: () => ({
    ...createInitialState(),
    isSimulating: false,  // Add this to initial state
  }),

  moves: {
    playCard: playerMoves.playCard,
    removeCard: playerMoves.removeCard,
    removeCardFromBoard: playerMoves.removeCardFromBoard,  // Simplified format
    commitPlayer: playerMoves.commitPlayer,
    uncommitPlayer: playerMoves.uncommitPlayer,
    simulateRound: adminMoves.simulateRound,
    endRound: adminMoves.endRound,
    processTick: adminMoves.processTick,  // Add this new move
  },
  turn: {
    minMoves: 0,
    maxMoves: Infinity,
    activePlayers: { all: "play" },
  },

  endIf: ({ G }) => {
    // Check if crystal is destroyed
    if (G.centralCrystal.hp <= 0) {
      return { winner: G.centralCrystal.lastDamagedBy };
    }
  },
};
