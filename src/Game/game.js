import { generateDeck } from "./cards.js";
import { Bot } from './bot.js';
import { INVALID_MOVE } from 'boardgame.io/dist/cjs/core.js';

// Constants
export const EQUATOR = 0;    // Starting point (middle)
export const P0_BASE = -1;   // One step towards P0's side
export const P1_BASE = 1;    // One step towards P1's side
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
    if (!G.isSimulating) return;
    
    const currentTick = G.currentTick;
    const column = G.columns[columnIndex];
    const activeTier = column.activeTier;
    const tier = column.tiers[activeTier];

    // Helper function to add messages to combat log
    const logMessage = (message) => {
        G.combatLog.push(message);
    };

    // Only process if it's time for this card to act
    if (currentTick % card.tick !== 0 || card.lastTickActed === currentTick) return;

    const targetCards = tier.cards[targetPlayerID];
    const playerCards = tier.cards[playerID];

    // Only allow top cards to act
    if (playerCards.indexOf(card) !== 0) return;

    if (targetCards.length > 0) {
        const target = targetCards[0];
        
        if (currentTick % target.tick === 0 && target.lastTickActed !== currentTick) {
            logMessage(`Tick ${currentTick}, Column ${columnIndex + 1}, ${getRegionName(activeTier, columnIndex)}:`);
            logMessage(`➤ P${playerID}'s ${card.name}(${card.initialPosition}) (${card.damage} DMG, ${card.hp} HP) clashes with`);
            logMessage(`➤ P${targetPlayerID}'s ${target.name}(${target.initialPosition}) (${target.damage} DMG, ${target.hp} HP)`);
            
            // Apply damage simultaneously
            card.hp -= target.damage;
            target.hp -= card.damage;
            
            logMessage(`Results:`);
            logMessage(`➤ P${playerID}'s ${card.name}(${card.initialPosition}): ${card.hp} HP remaining`);
            logMessage(`➤ P${targetPlayerID}'s ${target.name}(${target.initialPosition}): ${target.hp} HP remaining`);

            // Only remove cards if they were actually destroyed
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
            }

            card.lastTickActed = currentTick;
            target.lastTickActed = currentTick;
        } else {
            // Normal combat
            const originalHP = target.hp;
            target.hp -= card.damage;
            logMessage(`Tick ${currentTick}, Column ${columnIndex + 1}, ${getRegionName(activeTier, columnIndex)}:`);
            logMessage(`➤ P${playerID}'s ${card.name}(${card.initialPosition}) attacks P${targetPlayerID}'s ${target.name}(${target.initialPosition})`);
            logMessage(`➤ Deals ${card.damage} damage (${originalHP} HP ➜ ${target.hp} HP)`);

            if (target.hp <= 0) {
                targetCards.shift();
                logMessage(`💥 P${targetPlayerID}'s ${target.name}(${target.initialPosition}) was destroyed!`);
            }
            
            card.lastTickActed = currentTick;
        }
    } else if ((activeTier === P0_BASE && playerID === "1") || 
               (activeTier === P1_BASE && playerID === "0")) {
        
        if (G.gameOver) return;
        
        if (targetCards.length === 0 && 
            currentTick % card.tick === 0 && 
            card.lastTickActed !== currentTick && 
            card.ticksInBase > 0) {
            
            const crystalID = activeTier === P0_BASE ? "0" : "1";
            
            console.log(`Crystal Attack:`, {
                cardName: card.name,
                damage: card.damage,
                targetCrystal: crystalID,
                crystalHPBefore: G.crystals[crystalID].hp,
                currentTick,
                cardTick: card.tick,
                ticksInBase: card.ticksInBase
            });
            
            card.lastTickActed = currentTick;
            
            G.crystals[crystalID].hp -= card.damage;
            
            console.log(`Crystal HP after attack: ${G.crystals[crystalID].hp}`);
            
            G.crystals[crystalID].lastDamagedBy = playerID;
            G.combatLog.push(`P${playerID}'s ${card.name} deals ${card.damage} damage to P${crystalID}'s crystal! (Crystal HP: ${G.crystals[crystalID].hp})`);
            
            if (G.crystals[crystalID].hp <= 0) {
                console.log(`Game Over: Crystal ${crystalID} destroyed by ${card.name}!`);
                G.isSimulating = false;
                G.gameOver = true;
                G.winner = playerID;
                G.lastAction = `Game Over: Player ${playerID} wins by destroying Player ${crystalID}'s crystal!`;
                return;
            }
        }
    }
    // Increment ticksInBase if card is in a base
    if (activeTier === P0_BASE || activeTier === P1_BASE) {
        card.ticksInBase = (card.ticksInBase || 0) + 1;
    }

    card.lastTickActed = currentTick;
};

// Player moves
// In game.js, the complete playerMoves object:

const playerMoves = {
  playCard: ({ G, ctx, playerID }, cardId, columnIndex) => {
    if (checkGameOver(G)) return G;
    
    console.group('playCard');
    const newG = JSON.parse(JSON.stringify(G));
    console.log('Initial state:', G);
    console.log('Playing card:', cardId, 'to column:', columnIndex);
    
    // Get the active tier and cards before any changes
    const column = newG.columns[columnIndex];
    const activeTier = column?.activeTier;
    const currentCards = column?.tiers[activeTier]?.cards[playerID] || [];
    
    console.log(`Current cards in tier ${activeTier} for player ${playerID}:`, currentCards);
    
    // Strict validation checks
    if (!column) {
        console.error('Invalid column');
        console.groupEnd();
        return INVALID_MOVE;
    }
    
    if (newG.players[playerID].committed) {
        console.log('Player already committed');
        console.groupEnd();
        return INVALID_MOVE;
    }
    
    if (currentCards.length >= 2) {
        console.log(`BLOCKED: Already has ${currentCards.length} cards in tier ${activeTier}`);
        console.groupEnd();
        return INVALID_MOVE;
    }
    
    // Initialize tier if needed
    if (!column.tiers[activeTier]) {
        console.log('Creating new tier at', activeTier);
        column.tiers[activeTier] = {
            cards: {
                0: [],
                1: []
            }
        };
    }
    
    // Find and validate card
    const cardIndex = newG.players[playerID].hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
        console.error('Card not found in hand');
        console.groupEnd();
        return INVALID_MOVE;
    }
    
    const card = newG.players[playerID].hand[cardIndex];
    
    // Check AP
    if (newG.players[playerID].ap < card.cost) {
        console.log('Not enough AP');
        console.groupEnd();
        return INVALID_MOVE;
    }
    
    // Process the move
    newG.players[playerID].hand.splice(cardIndex, 1);
    newG.players[playerID].ap -= card.cost;
    column.tiers[activeTier].cards[playerID].push(card);
    
    // Final validation
    const finalCards = column.tiers[activeTier].cards[playerID];
    console.log(`After play: ${finalCards.length} cards in tier`);
    if (finalCards.length > 2) {
        console.error('ERROR: Somehow exceeded card limit!');
        console.groupEnd();
        return INVALID_MOVE;
    }
    
    newG.lastAction = `Player ${playerID} played ${card.name}(${cardId}) in column ${columnIndex}`;
    console.log('Final state:', newG);
    console.groupEnd();
    emitGameState(newG, ctx);
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

    // Process all ticks immediately
    while (newG.currentTick <= MAX_TICKS_PER_ROUND && newG.isSimulating) {
        adminMoves.processTick({ G: newG });
    }

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
        
        if (!tier) return;

        // Process player 0's cards first
        (tier.cards["0"] || []).forEach((card) => {
            processCardAction(G, card, columnIndex, "0", "1");
        });

        // Then process player 1's cards
        (tier.cards["1"] || []).forEach((card) => {
            processCardAction(G, card, columnIndex, "1", "0");
        });

        // Process crystal damage for cards in bases
        if (activeTier === P0_BASE || activeTier === P1_BASE) {
            const crystalID = activeTier === P0_BASE ? "0" : "1";
            const attackingPlayerID = activeTier === P0_BASE ? "1" : "0";
            
            // Check attacking cards
            (tier.cards[attackingPlayerID] || []).forEach(card => {
                if (G.currentTick % card.tick === 0 && card.lastTickActed !== G.currentTick) {
                    G.crystals[crystalID].hp -= card.damage;
                    G.crystals[crystalID].lastDamagedBy = attackingPlayerID;
                    G.combatLog.push(`P${attackingPlayerID}'s ${card.name} deals ${card.damage} damage to P${crystalID}'s crystal! (Crystal HP: ${G.crystals[crystalID].hp})`);
                    
                    card.lastTickActed = G.currentTick;
                    
                    // Check for game over
                    if (G.crystals[crystalID].hp <= 0) {
                        G.isSimulating = false;
                        G.gameOver = true;
                        G.winner = attackingPlayerID;
                        G.lastAction = `Game Over: Player ${attackingPlayerID} wins by destroying Player ${crystalID}'s crystal!`;
                    }
                }
            });
        }
    });

    G.currentTick++;
    if (G.currentTick > MAX_TICKS_PER_ROUND) {
        G.isSimulating = false;
    }
  },

  endRound: ({ G }) => {
    console.group('endRound');
    const newG = JSON.parse(JSON.stringify(G));
    
    if (newG.isProcessingEndRound) {
        console.log('Already processing end round, skipping');
        console.groupEnd();
        return newG;
    }
    newG.isProcessingEndRound = true;

    if (newG.roundPhase !== "combat") {
        console.log('Not in combat phase, returning');
        console.groupEnd();
        return newG;
    }

    // Process end of round logic
    newG.columns.forEach((column, columnIndex) => {
        console.log(`\nProcessing column ${columnIndex}:`);
        const activeTier = column.activeTier;
        const tier = column.tiers[activeTier];
        
        if (tier) {
            // Reset lastTickActed for all cards
            Object.values(tier.cards).forEach(playerCards => {
                playerCards.forEach(card => {
                    card.lastTickActed = null;
                });
            });

            const player0Cards = tier.cards["0"]?.length || 0;
            const player1Cards = tier.cards["1"]?.length || 0;

            console.log(`Current tier: ${activeTier}`);
            console.log(`Cards in tier - P0: ${player0Cards}, P1: ${player1Cards}`);
            console.log('P0 cards:', tier.cards["0"]);
            console.log('P1 cards:', tier.cards["1"]);

            // Check for lane control and pushing
            if (activeTier === EQUATOR) {
                if (player0Cards > 0 && player1Cards === 0) {
                    console.log('P0 controls Equator - pushing to P1 Base');
                    column.controllingPlayer = "0";
                    
                    // Initialize P1_BASE tier if needed
                    if (!column.tiers[P1_BASE]) {
                        console.log(`Initializing P1 Base tier at index ${P1_BASE}`);
                        column.tiers[P1_BASE] = { cards: { "0": [], "1": [] } };
                    }
                    
                    // Get surviving cards and log them
                    const survivingCards = [...tier.cards["0"]].map(card => {
                        const newCard = {...card};
                        const currentHP = card.hp;  // Get current HP
                        newCard.hp = Math.floor(currentHP / 2);  // Halve from current HP
                        console.log(`${card.name} HP halved from ${currentHP} to ${newCard.hp} during push`);
                        return newCard;
                    });
                    console.log('Surviving cards before push:', survivingCards);
                    
                    newG.combatLog.push(`Column ${columnIndex + 1}: P0 wins Equator - pushing to P1's Base with ${survivingCards.length} cards:`);
                    survivingCards.forEach(card => {
                        newG.combatLog.push(`➤ ${card.name} (${card.hp} HP remaining)`);
                    });
                    
                    // Move cards to P1_BASE (-1)
                    column.tiers[P1_BASE].cards["0"] = [...survivingCards];
                    console.log(`Cards after push to P1 Base (tier ${P1_BASE}):`, column.tiers[P1_BASE].cards["0"]);
                    
                    // Update active tier
                    column.activeTier = P1_BASE;
                    console.log('New active tier:', column.activeTier);
                    
                    // Clear old tier
                    tier.cards["0"] = [];
                    tier.cards["1"] = [];
                    
                    survivingCards.forEach(card => {
                        card.ticksInBase = 0;
                    });

                    // Verify the move
                    console.log('Column state after push:', {
                        activeTier: column.activeTier,
                        equatorCards: column.tiers[EQUATOR].cards,
                        baseCards: column.tiers[P1_BASE].cards
                    });
                } else if (player1Cards > 0 && player0Cards === 0) {
                    console.log('P1 controls Equator - pushing to P0 Base');
                    column.controllingPlayer = "1";
                    
                    // Get surviving cards and log them
                    const survivingCards = [...tier.cards["1"]].map(card => {
                        const newCard = {...card};
                        const currentHP = card.hp;  // Get current HP
                        newCard.hp = Math.floor(currentHP / 2);  // Halve from current HP
                        console.log(`${card.name} HP halved from ${currentHP} to ${newCard.hp} during push`);
                        return newCard;
                    });
                    newG.combatLog.push(`Column ${columnIndex + 1}: P1 wins Equator - pushing to P0's Base with ${survivingCards.length} cards:`);
                    survivingCards.forEach(card => {
                        newG.combatLog.push(`➤ ${card.name} (${card.hp} HP remaining)`);
                    });
                    
                    // Initialize P0_BASE tier if needed
                    if (!column.tiers[P0_BASE]) {
                        column.tiers[P0_BASE] = { cards: { "0": [], "1": [] } };
                    }
                    
                    // Move cards to P0_BASE
                    column.tiers[P0_BASE].cards["1"] = [...survivingCards];
                    column.activeTier = P0_BASE;
                    
                    // Clear old tier
                    tier.cards["0"] = [];
                    tier.cards["1"] = [];
                    
                    survivingCards.forEach(card => {
                        card.ticksInBase = 0;
                    });
                }
            }

            // Check for cards in bases that need to return to equator
            if (activeTier === P1_BASE || activeTier === P0_BASE) {
                const baseOwner = activeTier === P1_BASE ? "1" : "0";
                const attacker = baseOwner === "1" ? "0" : "1";
                
                // Only push back if base owner has cards and attacker doesn't
                if (tier.cards[baseOwner].length > 0 && tier.cards[attacker].length === 0) {
                    // Get surviving defender's cards
                    const defendingCards = [...tier.cards[baseOwner]].map(card => ({...card}));
                    
                    // Move cards back to equator
                    column.tiers[EQUATOR].cards[baseOwner] = defendingCards;
                    
                    // Clear the base
                    tier.cards[baseOwner] = [];
                    tier.cards[attacker] = [];
                    
                    // Reset active tier to equator
                    column.activeTier = EQUATOR;
                    
                    // Log the successful defense
                    newG.combatLog.push(
                        `Column ${columnIndex + 1}: P${baseOwner} successfully defended their base - cards returning to Equator`
                    );
                }
            }
        }
    });

    // Reset for next round
    newG.roundPhase = "playing";
    newG.isSimulating = false;
    newG.isProcessingEndRound = false;
    newG.currentRound += 1;
    newG.currentTick = 1;
    
    // Reset player states and draw new cards
    Object.keys(newG.players).forEach(playerID => {
        newG.players[playerID].committed = false;
        newG.players[playerID].ap = INITIAL_AP;
        
        // Draw 2 new cards
        const draw = drawCards(newG.players[playerID].deck, 2);
        newG.players[playerID].hand.push(...draw.drawn);
        newG.players[playerID].deck = draw.remaining;
        
        console.log(`Player ${playerID} drew ${draw.drawn.length} cards`);
    });

    console.log('Final state:', newG);
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
  name: 'my-game',

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
    if (G.crystals['0'].hp <= 0) {
        return { winner: '1', reason: 'crystal' };
    }
    if (G.crystals['1'].hp <= 0) {
        return { winner: '0', reason: 'crystal' };
    }
    return undefined;  // Return undefined instead of false when game should continue
  },

  onEnd: ({ G }, ctx) => {
    // Handle case where ctx might be undefined
    if (!ctx) return G;

    const newG = JSON.parse(JSON.stringify(G));
    const winner = ctx.gameover?.winner;
    
    if (winner === '1') {
        newG.lastAction = "Game Over: Player 1 wins by destroying Player 0's crystal!";
    } else if (winner === '0') {
        newG.lastAction = "Game Over: Player 0 wins by destroying Player 1's crystal!";
    } else {
        newG.lastAction = "Game Over!";
    }
    
    return newG;
  },
};

// Add this helper function at the top of the file
const checkGameOver = (G) => {
    if (G.gameOver) {
        console.log('Game is already over, move rejected');
        return true;
    }
    return false;
};
// In your emitGameState function
function emitGameState(G, ctx) {
  if (typeof window !== 'undefined' && window.socket) {
    const data = {
      G,
      ctx,
      timestamp: Date.now(),
      matchID: ctx.matchID  // Make sure to include matchID
    };

    console.log('📤 Emitting game state:', {
      time: new Date().toISOString(),
      type: 'gameStateUpdate',
      playerId: ctx.currentPlayer,
      matchID: ctx.matchID
    });
    
    // Add acknowledgment callback
    window.socket.emit('gameStateUpdate', data, (error) => {
      if (error) {
        console.error('❌ Emit error:', error);
      } else {
        console.log('✅ Game state sent successfully');
      }
    });
  }
}

