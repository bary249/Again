// game.js
import { INVALID_MOVE } from 'boardgame.io/core';
import { generateDeck } from './cards';

// Helper functions
function createInitialPlayerState() {
    const deck = generateDeck();
    return {
        hand: deck.slice(0, 6),
        deck: deck.slice(6),
        ap: 20,
        gold: 0,
        discardPile: []
    };
}

function createColumn() {
    return {
        crystalHP: 20,
        playerPositions: {
            '0': 1,
            '1': 1
        },
        cards: {
            '0': [],
            '1': []
        }
    };
}

function advancePlayer(column, playerId) {
    if (column.playerPositions[playerId] < 3) {
        column.playerPositions[playerId]++;
    }
}

function pushBackPlayer(column, playerId) {
    if (column.playerPositions[playerId] < 3) {
        column.playerPositions[playerId]++;
    }
}

function processCombat(G, ctx, column, columnIndex) {
    // Process 5 ticks
    for (let tick = 1; tick <= 5; tick++) {
        const iterations = tick === 1 ? 5 : tick === 2 ? 2 : 1;
        
        for (let iteration = 0; iteration < iterations; iteration++) {
            // Get all cards that should act this tick
            const p0Cards = column.cards['0'].filter(card => card.hp > 0);
            const p1Cards = column.cards['1'].filter(card => card.hp > 0);
            const allCards = [...p0Cards, ...p1Cards].filter(card => 
                card.tick === 1 || 
                (card.tick === 2 && iteration % 2 === 0) || 
                (card.tick === tick && iteration === 0)
            );

            // Process simultaneous attacks
            const attacks = [];
            allCards.forEach(card => {
                const isPlayer0Card = column.cards['0'].includes(card);
                const playerIdx = isPlayer0Card ? '0' : '1';
                const enemyCards = isPlayer0Card ? p1Cards : p0Cards;

                if (enemyCards.length > 0) {
                    attacks.push({
                        attacker: card,
                        attackerIdx: playerIdx,
                        target: enemyCards[0],
                        damage: card.damage
                    });
                }
            });

            // Apply all attacks simultaneously
            attacks.forEach(attack => {
                const oldHP = attack.target.hp;
                attack.target.hp -= attack.damage;
                
                G.combatLog.push(
                    `Column ${columnIndex + 1}: ${attack.attacker.name} (P${attack.attackerIdx}) attacks for ${attack.damage} damage. Target HP: ${oldHP} -> ${attack.target.hp}`
                );

                if (attack.target.hp <= 0) {
                    G.combatLog.push(`${attack.target.name} is destroyed!`);
                    const excessDamage = Math.abs(attack.target.hp);
                    
                    const targetPlayerIdx = attack.attackerIdx === '0' ? '1' : '0';
                    const nextTargets = column.cards[targetPlayerIdx].filter(t => 
                        t.hp > 0 && t !== attack.target
                    );

                    if (nextTargets.length > 0 && excessDamage > 0) {
                        const nextTarget = nextTargets[0];
                        const oldNextHP = nextTarget.hp;
                        nextTarget.hp -= excessDamage;
                        G.combatLog.push(
                            `Excess damage: ${excessDamage} flows to next card. HP: ${oldNextHP} -> ${nextTarget.hp}`
                        );
                    }
                }
            });
        }
    }

    // After combat, determine column winner
    const p0Survivors = column.cards['0'].filter(card => card.hp > 0).length;
    const p1Survivors = column.cards['1'].filter(card => card.hp > 0).length;

    if (p0Survivors > 0 && p1Survivors === 0) {
        advancePlayer(column, '0');
        pushBackPlayer(column, '1');
    } else if (p1Survivors > 0 && p0Survivors === 0) {
        advancePlayer(column, '1');
        pushBackPlayer(column, '0');
    }
}

// Game definition
export const MyGame = {
    name: 'card-game',

    setup: () => ({
        players: {
            '0': createInitialPlayerState(),
            '1': createInitialPlayerState()
        },
        columns: [
            createColumn(),
            createColumn(),
            createColumn()
        ],
        currentTick: 1,
        combatLog: []
    }),

    turn: {
        minMoves: 0,
        maxMoves: 10,
        order: {
            first: () => 0,
            next: (G, ctx) => (ctx.playOrderPos + 1) % ctx.numPlayers
        }
    },

    moves: {
        playCard: {
            move: (e,G, ctx, cardId, columnIndex) => {
                
                // Debug logging
                console.log('PlayCard called with:', {
                    cardId,
                    columnIndex,
                    currentPlayer: ctx?.currentPlayer,
                    cardIdType: typeof cardId,
                    columnIndexType: typeof columnIndex,
                  });
                
                  // Early return for invalid args
                  if (typeof cardId !== 'number' || typeof columnIndex !== 'number') {
                    console.error('Invalid argument types:', { cardId, columnIndex });
                    return INVALID_MOVE;
                  }
                
                  if (!ctx?.currentPlayer) {
                    console.error('Invalid context or current player:', ctx);
                    return INVALID_MOVE;
                  }
                // Get player state
                const player = G.players[ctx.currentPlayer];
                if (!player) {
                    console.error('Player not found');
                    return INVALID_MOVE;
                }

                // Find card
                const card = player.hand.find(c => c.id === cardId);
                if (!card) {
                    console.error('Card not found:', cardId);
                    return INVALID_MOVE;
                }

                // Check column
                const column = G.columns[columnIndex];
                if (!column) {
                    console.error('Invalid column:', columnIndex);
                    return INVALID_MOVE;
                }

                // Initialize cards array if needed
                if (!column.cards[ctx.currentPlayer]) {
                    column.cards[ctx.currentPlayer] = [];
                }

                const playerCards = column.cards[ctx.currentPlayer];

                // Check stack limit
                if (playerCards.length >= 2) {
                    console.error('Stack limit reached');
                    return INVALID_MOVE;
                }

                // Check AP
                if (player.ap < card.cost) {
                    console.error('Not enough AP');
                    return INVALID_MOVE;
                }

                // Play card
                player.hand = player.hand.filter(c => c.id !== cardId);
                playerCards.push({...card});
                player.ap -= card.cost;

                console.log('Card played successfully:', {
                    cardId,
                    columnIndex,
                    remainingHand: player.hand.length,
                    remainingAP: player.ap
                });
            },
            client: false
        },

        removeCard: {
            move: (G, ctx, cardId) => {
                if (!ctx?.currentPlayer) return INVALID_MOVE;
                
                const player = G.players[ctx.currentPlayer];
                const cardIndex = player.hand.findIndex(c => c.id === cardId);
                
                if (cardIndex === -1) return INVALID_MOVE;
                
                const [removedCard] = player.hand.splice(cardIndex, 1);
                player.discardPile.push(removedCard);
            },
            client: false
        },

        simulateRound: {
            move: (G, ctx) => {
                G.combatLog = [];
                G.columns.forEach((column, columnIndex) => {
                    processCombat(G, ctx, column, columnIndex);
                });
            },
            client: false
        },

        endRound: {
            move: (G, ctx) => {
                G.combatLog = [];
                G.columns.forEach((column, columnIndex) => {
                    processCombat(G, ctx, column, columnIndex);
                });
                
                Object.values(G.players).forEach(player => {
                    player.ap = 20;
                    if (player.hand.length < 8) {
                        for (let i = 0; i < 2 && player.deck.length > 0; i++) {
                            player.hand.push(player.deck.pop());
                        }
                    }
                });
                
                G.columns.forEach(column => {
                    column.cards['0'] = [];
                    column.cards['1'] = [];
                });
            },
            client: false
        }
    },

    phases: {
        play: {
            start: true,
            next: 'combat',
            turn: {
                minMoves: 0,
                maxMoves: 10,
                order: {
                    first: () => 0,
                    next: (G, ctx) => (ctx.playOrderPos + 1) % ctx.numPlayers
                }
            }
        },
        combat: {
            next: 'roundEnd',
            onBegin: (G, ctx) => {
                G.combatLog = [];
                G.columns.forEach((column, columnIndex) => {
                    processCombat(G, ctx, column, columnIndex);
                });
            }
        },
        roundEnd: {
            next: 'play',
            onBegin: (G, ctx) => {
                Object.values(G.players).forEach(player => {
                    player.ap = 20;
                    if (player.hand.length < 8) {
                        for (let i = 0; i < 2 && player.deck.length > 0; i++) {
                            player.hand.push(player.deck.pop());
                        }
                    }
                });
                G.columns.forEach(column => {
                    column.cards['0'] = [];
                    column.cards['1'] = [];
                });
            }
        }
    }
};