// game.js
import { generateDeck } from "./cards";
import { Bot } from './bot';
import { INVALID_MOVE } from 'boardgame.io/core';

// Constants
export const EQUATOR = 0;    // Starting point (middle)
export const P0_BASE = 1;    // One step towards P0's side
export const P1_BASE = -1;   // One step towards P1's side
export const COLUMNS = 3;
export const TIERS = 3;      // Total number of tiers (equator + 2 bases)
export const INITIAL_AP = 20;
export const INITIAL_HAND_SIZE = 5;
export const MAX_CARDS_PER_TIER = 2;
export const MAX_TICKS_PER_ROUND = 5;
export const INITIAL_CRYSTAL_HP = 2; // Shared crystal HP

const getRegionName = (tierIndex, columnIndex) => {
  const section = columnIndex === 0 ? "North" : 
                 columnIndex === 1 ? "Center" : "South";
                 
  if (tierIndex === EQUATOR) {
    return `Equator ${section}`;
  } else if (tierIndex === P0_BASE) {
    return `P0's ${section} Base`;
  } else if (tierIndex === P1_BASE) {
    return `P1's ${section} Base`;
  }
  return "Unknown Region";
};

const createInitialState = () => {
  const player0Deck = generateDeck();
  const player1Deck = generateDeck();

  const player0Draw = drawCards(player0Deck, INITIAL_HAND_SIZE);
  const player1Draw = drawCards(player1Deck, INITIAL_HAND_SIZE);

  return {
    crystals: {
      0: {  // Player 0's crystal
        hp: INITIAL_CRYSTAL_HP,
        lastDamagedBy: null,
      },
      1: {  // Player 1's crystal
        hp: INITIAL_CRYSTAL_HP,
        lastDamagedBy: null,
      }
    },
    columns: Array(COLUMNS)
      .fill(null)
      .map(() => ({
        activeTier: EQUATOR,
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
  const logMessage = (msg) => {
    const formattedMsg = `[Round ${G.currentRound}] ${msg}`;
    G.combatLog.push(formattedMsg);
  };

  // Helper to get current position (still needed for logic)
  const getCardPosition = (cards, cardToFind) => {
    const index = cards.indexOf(cardToFind);
    return index === 0 ? "T" : "B";
  };

  // Check if card should act this tick
  if (currentTick % card.tick !== 0 || card.lastTickActed === currentTick) return;

  const column = G.columns[columnIndex];
  const activeTier = column.activeTier;
  const tier = column.tiers[activeTier];
  const targetCards = tier.cards[targetPlayerID] || [];
  const playerCards = tier.cards[playerID] || [];

  const currentPosition = getCardPosition(playerCards, card);

  // Only allow top cards to act
  if (currentPosition !== "T") return;

  if (targetCards.length > 0) {
    const target = targetCards[0];
    
    if (currentTick % target.tick === 0 && target.lastTickActed !== currentTick) {
      const cardDamage = card.damage;
      const targetDamage = target.damage;
      
      logMessage(`Tick ${currentTick}, Column ${columnIndex + 1}, ${getRegionName(activeTier, columnIndex)}:`);
      logMessage(`➤ P${playerID}'s ${card.name}(${card.initialPosition}) (${cardDamage} DMG, ${card.hp} HP) clashes with`);
      logMessage(`➤ P${targetPlayerID}'s ${target.name}(${target.initialPosition}) (${targetDamage} DMG, ${target.hp} HP)`);
      
      // Apply damage
      card.hp -= targetDamage;
      target.hp -= cardDamage;
      
      logMessage(`Results:`);
      logMessage(`➤ P${playerID}'s ${card.name}(${card.initialPosition}): ${card.hp} HP remaining`);
      logMessage(`➤ P${targetPlayerID}'s ${target.name}(${target.initialPosition}): ${target.hp} HP remaining`);

      // Check for destroyed cards
      if (card.hp <= 0 && target.hp <= 0) {
        tier.cards[playerID].shift();
        targetCards.shift();
        logMessage(`💥 Both cards were destroyed in the clash!`);
      } else if (card.hp <= 0) {
        tier.cards[playerID].shift();
        logMessage(`💥 P${playerID}'s ${card.name}(${card.initialPosition}) was destroyed!`);
      } else if (target.hp <= 0) {
        targetCards.shift();
        logMessage(`💥 P${targetPlayerID}'s ${target.name}(${target.initialPosition}) was destroyed!`);
      } else {
        logMessage(`⚔️ Both cards survived the clash!`);
      }

      card.lastTickActed = currentTick;
      target.lastTickActed = currentTick;
    } else {
      // Normal non-simultaneous combat
      target.hp -= card.damage;
      
      logMessage(`Tick ${currentTick}, Column ${columnIndex + 1}, ${getRegionName(activeTier, columnIndex)}:`);
      logMessage(`➤ P${playerID}'s ${card.name}(${card.initialPosition}) attacks P${targetPlayerID}'s ${target.name}(${target.initialPosition})`);
      logMessage(`➤ Deals ${card.damage} damage (${target.hp + card.damage} HP ➜ ${target.hp} HP)`);

      if (target.hp <= 0) {
        targetCards.shift();
        logMessage(`💥 P${targetPlayerID}'s ${target.name}(${target.initialPosition}) was destroyed!`);
      }
    }

    // Check if tier is now empty for either player
    if (targetCards.length === 0 && tier.cards[playerID].length > 0) {
      logMessage(`Player ${playerID} has won ${getRegionName(activeTier, columnIndex)} in column ${columnIndex + 1}!`);
      column.controllingPlayer = playerID;

      // If this was the last tier, damage the crystal
      if (activeTier === TIERS - 1) {
        G.centralCrystal.hp -= card.damage;
        G.centralCrystal.lastDamagedBy = playerID;
        logMessage(`Player ${playerID} deals ${card.damage} damage to the central crystal! Crystal HP: ${G.centralCrystal.hp}`);
      } else {
        // If there's another tier, advance to it
        tier.cards = { 0: [], 1: [] };
        column.activeTier++;
        logMessage(`Combat advances to ${getRegionName(column.activeTier, columnIndex)} in column ${columnIndex + 1}`);
      }
    }
  } else if (activeTier === TIERS - 1) {
    // Only damage crystal if attacking the opponent's base
    if ((playerID === "0" && activeTier === 2) || (playerID === "1" && activeTier === 0)) {
      G.centralCrystal.hp -= card.damage;
      G.centralCrystal.lastDamagedBy = playerID;
      logMessage(`${card.name} breaches ${getRegionName(activeTier, columnIndex)} and deals ${card.damage} damage to the crystal! Crystal HP: ${G.centralCrystal.hp}`);
    }
  }

  card.lastTickActed = currentTick;
};

// Player moves
// In game.js, the complete playerMoves object:

const playerMoves = {
  playCard: ({ G, playerID }, cardId, columnIndex) => {
    console.group('playCard');
    console.log('Initial state:', G);
    console.log('Playing card:', cardId, 'to column:', columnIndex);
    
    const newG = JSON.parse(JSON.stringify(G));
    
    if (newG.players[playerID].committed) {
      console.log('Player committed, invalid move');
      console.groupEnd();
      return INVALID_MOVE;
    }
    
    const column = newG.columns[columnIndex];
    if (!column) {
      console.error('Invalid column');
      console.groupEnd();
      return INVALID_MOVE;
    }

    // Make sure the tier exists
    const activeTier = column.activeTier;
    if (!column.tiers[activeTier]) {
      console.log('Creating new tier');
      column.tiers[activeTier] = {
        cards: {
          0: [],
          1: []
        }
      };
    }

    // Find the card in the player's hand
    const cardIndex = newG.players[playerID].hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      console.error('Card not found in hand');
      console.groupEnd();
      return INVALID_MOVE;
    }
    
    const card = newG.players[playerID].hand[cardIndex];
    
    // Set the initial position based on current cards in the tier
    const currentTierCards = column.tiers[activeTier].cards[playerID] || [];
    card.initialPosition = currentTierCards.length === 0 ? "T" : "B";
    
    // Check if player has enough AP
    if (newG.players[playerID].ap < card.cost) {
      console.log('Not enough AP');
      console.groupEnd();
      return INVALID_MOVE;
    }

    // Remove card from hand and add to column
    newG.players[playerID].hand.splice(cardIndex, 1);
    newG.players[playerID].ap -= card.cost;
    
    // Ensure the cards array exists for this player
    if (!column.tiers[activeTier].cards[playerID]) {
      column.tiers[activeTier].cards[playerID] = [];
    }
    
    column.tiers[activeTier].cards[playerID].push(card);
    
    newG.lastAction = `Player ${playerID} played ${card.name} in column ${columnIndex + 1}`;
    
    console.log('Final state:', newG);
    console.groupEnd();
    return newG;
  },

  commitPlayer: ({ G, playerID }) => {
    const newG = JSON.parse(JSON.stringify(G));
    newG.players[playerID].committed = true;
    newG.lastAction = `Player ${playerID} committed their moves`;
    return newG;
  },

  uncommitPlayer: ({ G, playerID }) => {
    if (G.roundPhase !== 'playing') return G;
    const newG = JSON.parse(JSON.stringify(G));
    newG.players[playerID].committed = false;
    newG.lastAction = `Player ${playerID} uncommitted their moves`;
    return newG;
  },

  removeCard: ({ G, playerID }, cardId) => {
    const newG = JSON.parse(JSON.stringify(G));
    if (newG.players[playerID].committed) return newG;
    
    const player = newG.players[playerID];
    const cardIndex = player.hand.findIndex(card => card.id === cardId);
    
    if (cardIndex === -1) return newG;
    player.hand.splice(cardIndex, 1);
    newG.lastAction = `Player ${playerID} removed a card`;
    return newG;
  },

  removeCardFromBoard: ({ G, playerID }, columnIndex) => {
    const newG = JSON.parse(JSON.stringify(G));
    if (newG.players[playerID].committed) return newG;
    
    const column = newG.columns[columnIndex];
    const activeTier = column.activeTier;
    const tier = column.tiers[activeTier];
    const playerCards = tier.cards[playerID];
    
    if (!playerCards || playerCards.length === 0) return newG;
    
    const card = playerCards[playerCards.length - 1];
    
    playerCards.pop();
    newG.players[playerID].hand.push(card);
    newG.players[playerID].ap += card.cost;
    
    newG.lastAction = `Player ${playerID} took back ${card.name} from column ${columnIndex + 1}`;
    return newG;
  }
};
// Admin moves
const adminMoves = {
  simulateRound: ({ G }) => {
    const newG = JSON.parse(JSON.stringify(G));
    if (newG.roundPhase !== "playing") return newG;
    if (!newG.players["0"].committed || !newG.players["1"].committed) return newG;

    newG.roundPhase = "combat";
    newG.isSimulating = true;
    newG.currentTick = 1;
    newG.lastAction = "Combat simulation started";
    return newG;
  },

  processTick: ({ G }) => {
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

  endRound: ({ G }) => {
    console.group('endRound');
    const newG = JSON.parse(JSON.stringify(G));
    console.log('Initial state:', newG);
    
    if (newG.roundPhase !== "combat") {
      console.log('Not in combat phase, returning');
      console.groupEnd();
      return newG;
    }

    // Process end of round logic
    newG.columns.forEach((column, columnIndex) => {
      const activeTier = column.activeTier;
      const tier = column.tiers[activeTier];
      
      console.log(`Processing column ${columnIndex}:`, column);
      
      if (tier) {
        // Reset lastTickActed for all cards
        Object.values(tier.cards).forEach(playerCards => {
          playerCards.forEach(card => {
            card.lastTickActed = null;
          });
        });

        const player0Cards = tier.cards["0"]?.length || 0;
        const player1Cards = tier.cards["1"]?.length || 0;

        console.log(`Column ${columnIndex} cards - P0: ${player0Cards}, P1: ${player1Cards}`);

        // Check for lane control and pushing
        if (activeTier === EQUATOR) {
          if (player0Cards > 0 && player1Cards === 0) {
            column.controllingPlayer = "0";
            newG.combatLog.push(
              `Column ${columnIndex + 1}: P0 wins Equator - pushing to P1's Base`
            );
            column.activeTier = P1_BASE;
          } else if (player1Cards > 0 && player0Cards === 0) {
            column.controllingPlayer = "1";
            newG.combatLog.push(
              `Column ${columnIndex + 1}: P1 wins Equator - pushing to P0's Base`
            );
            column.activeTier = P0_BASE;
          }
          // Clear the current tier's cards after pushing
          if (player0Cards !== player1Cards) {
            tier.cards = { 0: [], 1: [] };
          }
        }
      }
    });

    // Reset for next round
    newG.roundPhase = "playing";
    newG.isSimulating = false;
    newG.currentRound += 1;
    newG.currentTick = 1;
    
    // Reset player states
    Object.keys(newG.players).forEach(playerID => {
      newG.players[playerID].committed = false;
      newG.players[playerID].ap = INITIAL_AP;
      
      // Make sure the cards array exists for each player in each column and tier
      newG.columns.forEach(column => {
        column.tiers.forEach(tier => {
          if (!tier.cards[playerID]) {
            tier.cards[playerID] = [];
          }
        });
      });
    });

    // Verify column structure
    newG.columns.forEach((column, columnIndex) => {
      if (!column.tiers || !Array.isArray(column.tiers)) {
        console.error(`Invalid tiers in column ${columnIndex}`);
        column.tiers = Array(TIERS).fill(null).map(() => ({
          cards: { 0: [], 1: [] }
        }));
      }
    });

    console.log('Final state:', newG);
    newG.lastAction = "Round ended, starting new round";
    console.groupEnd();
    return newG;
  },

  autoRun: ({ G, ctx }) => {
    try {
      // Start with a clean copy of the state
      let newG = JSON.parse(JSON.stringify(G));
      
      // 1. Play first card from P0's hand to north column (index 0)
      if (newG.players['0'].hand.length > 0) {
        const firstCard = newG.players['0'].hand[0];
        const playResult = playerMoves.playCard({ 
          G: newG, 
          ctx, 
          playerID: '0' 
        }, firstCard.id, 0);
        
        if (playResult !== INVALID_MOVE) {
          newG = playResult;
        }
      }

      // 2. Commit P0
      const commitResult = playerMoves.commitPlayer({ 
        G: newG, 
        ctx, 
        playerID: '0' 
      });
      
      if (commitResult) {
        newG = commitResult;
      }

      // 3. Run bot play all for P1
      const botResult = adminMoves.botPlayAll.move({ 
        G: newG, 
        ctx 
      });
      
      if (botResult) {
        newG = botResult;
      }

      // 4. Simulate combat
      const simulateResult = adminMoves.simulateRound({ 
        G: newG, 
        ctx 
      });
      
      if (simulateResult) {
        newG = simulateResult;
      }

      // 5. End round
      const endResult = adminMoves.endRound({ 
        G: newG, 
        ctx 
      });
      
      if (endResult) {
        newG = endResult;
      }

      // Add a log for debugging
      newG.lastAction = "Auto-run sequence completed";
      
      return newG;
      
    } catch (error) {
      console.error("Error in autoRun:", error);
      return G; // Return original state if there's an error
    }
  },

  botPlayAll: {
    move: ({ G, ctx }) => {
      console.group('botPlayAll move');
      console.log('🎮 Initial game state:', G);
      console.log('🎯 Context:', ctx);

      let newG = JSON.parse(JSON.stringify(G));
      
      if (!ctx || !ctx.currentPlayer) {
        console.error('❌ Invalid context in botPlayAll:', ctx);
        console.groupEnd();
        return newG;
      }

      const botContext = {
        currentPlayer: "1",
        playOrder: ctx.playOrder || ["0", "1"],
        playOrderPos: ctx.playOrderPos || 0,
        numPlayers: ctx.numPlayers || 2,
        turn: ctx.turn || 1,
        phase: ctx.phase || 'play'
      };
      console.log('🤖 Bot context:', botContext);

      let moveCount = 0;
      while (!newG.players["1"].committed) {
        console.log(`🔄 Move iteration ${moveCount + 1}`);
        
        const moves = Bot.enumerate(newG, botContext);
        if (!moves || moves.length === 0) {
          console.log('❌ No more moves available');
          break;
        }
        
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        console.log('🎲 Selected random move:', randomMove);

        let tempG = newG;
        if (randomMove.move === 'playCard' && randomMove.args) {
          console.log('🎴 Executing playCard move with args:', randomMove.args);
          tempG = MyGame.moves.playCard({ 
            G: newG, 
            ctx: botContext, 
            playerID: "1" 
          }, ...randomMove.args);
        } else if (randomMove.move === 'commitPlayer') {
          console.log('✅ Executing commit move');
          tempG = MyGame.moves.commitPlayer({ 
            G: newG, 
            ctx: botContext, 
            playerID: "1" 
          });
        }
        
        // Only update newG if the move returned a valid state
        if (tempG) {
          newG = tempG;
        } else {
          console.warn('⚠️ Move returned undefined, skipping update');
        }
        
        moveCount++;
        console.log('🎮 Current game state after move:', newG);
      }

      console.log(`✨ Bot finished after ${moveCount} moves`);
      console.groupEnd();
      return newG;
    },
    client: false
  },
};

export const MyGame = {
  setup: createInitialState,

  moves: {
    playCard: playerMoves.playCard,
    removeCard: playerMoves.removeCard,
    removeCardFromBoard: playerMoves.removeCardFromBoard,
    commitPlayer: playerMoves.commitPlayer,
    uncommitPlayer: playerMoves.uncommitPlayer,
    simulateRound: adminMoves.simulateRound,
    endRound: adminMoves.endRound,
    processTick: adminMoves.processTick,  // Add this new move
    botPlaySingle: {
      move: ({ G, ctx }) => {
        console.group('botPlaySingle move');
        console.log('🎮 Initial game state:', G);
        console.log('🎯 Context:', ctx);
        
        // Create a clean copy of G to ensure it's serializable
        let newG = JSON.parse(JSON.stringify(G));
        
        // Ensure we have valid context
        if (!ctx || !ctx.currentPlayer) {
          console.error('❌ Invalid context in botPlaySingle:', ctx);
          console.groupEnd();
          return newG;
        }

        // Create a serializable context object
        const botContext = {
          currentPlayer: "1",
          playOrder: ctx.playOrder || ["0", "1"],
          playOrderPos: ctx.playOrderPos || 0,
          numPlayers: ctx.numPlayers || 2,
          turn: ctx.turn || 1,
          phase: ctx.phase || 'play'
        };
        console.log('🤖 Bot context:', botContext);

        const moves = Bot.enumerate(newG, botContext);
        console.log('📋 Available moves:', moves);

        if (moves && moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          console.log('🎲 Selected random move:', randomMove);

          if (randomMove.move === 'playCard' && randomMove.args) {
            console.log('🎴 Executing playCard move with args:', randomMove.args);
            newG = MyGame.moves.playCard({ 
              G: newG, 
              ctx: botContext, 
              playerID: "1" 
            }, ...randomMove.args);
          } else if (randomMove.move === 'commitPlayer') {
            console.log('✅ Executing commit move');
            newG = MyGame.moves.commitPlayer({ 
              G: newG, 
              ctx: botContext, 
              playerID: "1" 
            });
          }
          
          // If newG is undefined, return the original state
          if (!newG) {
            console.warn('⚠️ Move returned undefined, using original state');
            return G;
          }
        }
        
        console.log('🎮 Final game state:', newG);
        console.groupEnd();
        return newG;
      },
      client: false
    },

    botPlayAll: {
      move: ({ G, ctx }) => {
        console.group('botPlayAll move');
        console.log('🎮 Initial game state:', G);
        console.log('🎯 Context:', ctx);

        let newG = JSON.parse(JSON.stringify(G));
        
        if (!ctx || !ctx.currentPlayer) {
          console.error('❌ Invalid context in botPlayAll:', ctx);
          console.groupEnd();
          return newG;
        }

        const botContext = {
          currentPlayer: "1",
          playOrder: ctx.playOrder || ["0", "1"],
          playOrderPos: ctx.playOrderPos || 0,
          numPlayers: ctx.numPlayers || 2,
          turn: ctx.turn || 1,
          phase: ctx.phase || 'play'
        };
        console.log('🤖 Bot context:', botContext);

        let moveCount = 0;
        while (!newG.players["1"].committed) {
          console.log(`🔄 Move iteration ${moveCount + 1}`);
          
          const moves = Bot.enumerate(newG, botContext);
          if (!moves || moves.length === 0) {
            console.log('❌ No more moves available');
            break;
          }
          
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          console.log('🎲 Selected random move:', randomMove);

          let tempG = newG;
          if (randomMove.move === 'playCard' && randomMove.args) {
            console.log('🎴 Executing playCard move with args:', randomMove.args);
            tempG = MyGame.moves.playCard({ 
              G: newG, 
              ctx: botContext, 
              playerID: "1" 
            }, ...randomMove.args);
          } else if (randomMove.move === 'commitPlayer') {
            console.log('✅ Executing commit move');
            tempG = MyGame.moves.commitPlayer({ 
              G: newG, 
              ctx: botContext, 
              playerID: "1" 
            });
          }
          
          // Only update newG if the move returned a valid state
          if (tempG) {
            newG = tempG;
          } else {
            console.warn('⚠️ Move returned undefined, skipping update');
          }
          
          moveCount++;
          console.log('🎮 Current game state after move:', newG);
        }

        console.log(`✨ Bot finished after ${moveCount} moves`);
        console.groupEnd();
        return newG;
      },
      client: false
    },

    autoRun: adminMoves.autoRun,
  },
  turn: {
    minMoves: 0,
    maxMoves: Infinity,
    activePlayers: { all: "play" },
  },

  endIf: ({ G }) => {
    // Check if either crystal is destroyed
    if (G.crystals['0'].hp <= 0) {
      return { winner: '1' };
    }
    if (G.crystals['1'].hp <= 0) {
      return { winner: '0' };
    }
    return false; // Game continues
  },
};
