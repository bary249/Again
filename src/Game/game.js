const { Game } = require('boardgame.io/core');
const { INVALID_MOVE } = require('boardgame.io/core');
const { generateDeck } = require('./cards');

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
            '0': 1,  // Start at tier 1
            '1': 1   // Start at tier 1
        },
        cards: {
            '0': [],  // Player 0's cards in this column
            '1': []   // Player 1's cards in this column
        }
    };
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

                // Handle excess damage if target dies
                if (attack.target.hp <= 0) {
                    G.combatLog.push(`${attack.target.name} is destroyed!`);
                    const excessDamage = Math.abs(attack.target.hp);
                    
                    // Find next target for excess damage
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
        // Player 0 wins the column
        advancePlayer(column, '0');
        pushBackPlayer(column, '1');
    } else if (p1Survivors > 0 && p0Survivors === 0) {
        // Player 1 wins the column
        advancePlayer(column, '1');
        pushBackPlayer(column, '0');
    }
    // If both have survivors or neither does, positions stay the same
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

const MyGame = Game({
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

    moves: {
        playCard: (G, ctx, cardId, columnIndex) => {
            // Can only play cards during your turn
            if (ctx.currentPlayer !== ctx.playerID) return INVALID_MOVE;
            
            const player = G.players[ctx.currentPlayer];
            const card = player.hand.find(c => c.id === cardId);
            
            if (!card) return INVALID_MOVE;
            if (player.ap < card.cost) return INVALID_MOVE;
            
            const column = G.columns[columnIndex];
            const playerCards = column.cards[ctx.currentPlayer];
            
            // Enforce 2-card stack limit
            if (playerCards.length >= 2) return INVALID_MOVE;
            
            // Add card and deduct AP
            player.hand = player.hand.filter(c => c.id !== cardId);
            playerCards.push(card);
            player.ap -= card.cost;
        },

        removeCard: (G, ctx, cardId) => {
            // Can only remove cards during your turn
            if (ctx.currentPlayer !== ctx.playerID) return INVALID_MOVE;
            
            const player = G.players[ctx.currentPlayer];
            const cardIndex = player.hand.findIndex(c => c.id === cardId);
            
            if (cardIndex === -1) return INVALID_MOVE;
            
            const [removedCard] = player.hand.splice(cardIndex, 1);
            player.discardPile.push(removedCard);
        },

        simulateRound: (G, ctx) => {
            // This is a game-level move, anyone can trigger it
            G.combatLog = [];
            G.columns.forEach((column, columnIndex) => {
                processCombat(G, ctx, column, columnIndex);
            });
        },

        endRound: (G, ctx) => {
            // This is a game-level move, anyone can trigger it
            G.combatLog = [];
            G.columns.forEach((column, columnIndex) => {
                processCombat(G, ctx, column, columnIndex);
            });
            
            // Reset for next round
            Object.values(G.players).forEach(player => {
                player.ap = 20;
                // Draw 2 cards if possible
                if (player.hand.length < 8) {
                    for (let i = 0; i < 2 && player.deck.length > 0; i++) {
                        player.hand.push(player.deck.pop());
                    }
                }
            });
            
            // Clear all columns
            G.columns.forEach(column => {
                column.cards['0'] = [];
                column.cards['1'] = [];
            });
        }
    },

    turn: {
        minMoves: 0,
        maxMoves: 10,
        order: {
            first: () => 0,
            next: (G, ctx) => (ctx.playOrderPos + 1) % ctx.numPlayers
        },
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
                },
            },
        },
        combat: {
            next: 'roundEnd',
            onBegin: (G, ctx) => {
                // Process combat
                G.combatLog = [];
                G.columns.forEach((column, columnIndex) => {
                    processCombat(G, ctx, column, columnIndex);
                });
            }
        },
        roundEnd: {
            next: 'play',
            onBegin: (G, ctx) => {
                // Reset for next round
                Object.values(G.players).forEach(player => {
                    player.ap = 20;
                    // Draw 2 cards if possible
                    if (player.hand.length < 8) {
                        for (let i = 0; i < 2 && player.deck.length > 0; i++) {
                            player.hand.push(player.deck.pop());
                        }
                    }
                });
                // Clear all columns
                G.columns.forEach(column => {
                    column.cards['0'] = [];
                    column.cards['1'] = [];
                });
            }
        }
    }
});

module.exports = { MyGame };