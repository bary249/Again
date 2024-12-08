export const Bot = {
  enumerate: (G, ctx) => {
    console.group('Bot.enumerate called');
    console.log('Input G:', G);
    console.log('Input ctx:', ctx);
    
    // Defensive check for required parameters
    if (!G || !ctx || !ctx.currentPlayer) {
      console.error('❌ Invalid parameters in Bot.enumerate:', { G, ctx });
      console.groupEnd();
      return [];
    }

    console.log('🎮 Game State:', { 
      currentPlayer: ctx.currentPlayer,
      player0Committed: G.players["0"]?.committed,
      player1Committed: G.players["1"]?.committed,
      phase: G.roundPhase,
      roundPhase: G.roundPhase,
      currentRound: G.currentRound
    });

    const moves = [];
    const playerID = ctx.currentPlayer;

    // Only generate moves if it's the bot's turn (player 1)
    if (playerID === "1" && G.players && G.players["0"] && G.players["1"]) {
      console.log('🤖 Bot is active, generating moves...');
      
      // Get the bot's hand
      const hand = G.players[playerID].hand || [];
      console.log('🎴 Bot hand:', hand);
      
      // For each card in hand
      for (let card of hand) {
        // For each column
        for (let columnIndex = 0; columnIndex < (G.columns || []).length; columnIndex++) {
          const column = G.columns[columnIndex];
          if (!column || !column.tiers || column.activeTier === undefined) {
            console.log('⚠️ Invalid column structure:', { columnIndex, column });
            continue;
          }
          
          const activeTier = column.tiers[column.activeTier];
          if (!activeTier || !activeTier.cards) {
            console.log('⚠️ Invalid tier structure:', { activeTier });
            continue;
          }
          
          // Check if we can play in this column
          if (!activeTier.cards[playerID] || activeTier.cards[playerID].length < 2) {
            moves.push({ 
              move: 'playCard', 
              args: [card.id, columnIndex] 
            });
            console.log('✅ Added possible move:', { cardId: card.id, columnIndex });
          }
        }
      }

      // Always add the commit move as a possibility
      moves.push({ 
        move: 'commitPlayer', 
        args: [] 
      });
      console.log('✅ Added commit move');
    } else {
      console.log('❌ Bot is not active:', { 
        playerID, 
        isPlayer1: playerID === "1",
        hasPlayers: Boolean(G.players && G.players["0"] && G.players["1"])
      });
    }

    console.log('📋 Available moves:', moves);
    console.groupEnd();
    return moves;
  },

  iterations: 100,
  playoutDepth: 10
};