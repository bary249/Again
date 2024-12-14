console.log("Script started");

import { io } from "socket.io-client";
const socket = io("https://again-production-04f0.up.railway.app", {
    transports: ['websocket']
});

// Create a match when connected
socket.on("connect", () => {
    console.log("Connected to server");
    
    // First request list of matches
    console.log("Requesting match list...");
    socket.emit('list');

    // Try to create a new match
    console.log("Creating new match...");
    socket.emit('create', {
        numPlayers: 2,
        setupData: {},
        gameName: 'default'
    });
});

socket.on("disconnect", () => {
    console.log("Disconnected from server");
});

socket.on("error", (error) => {
    console.error("Socket error:", error);
});

// Listen for game state updates
socket.on('sync', (data) => {
    console.log('Game state update:', JSON.stringify(data, null, 2));
});

// Listen for match list updates with more detailed logging
socket.on('matchList', (matches) => {
    console.log('Available matches:');
    if (matches && matches.length > 0) {
        matches.forEach((match, index) => {
            console.log(`\nMatch ${index + 1}:`);
            console.log(JSON.stringify(match, null, 2));
        });
    } else {
        console.log('No matches available');
    }
});

// Listen for match creation response
socket.on('create', (matchData) => {
    console.log('Match created:', JSON.stringify(matchData, null, 2));
    if (matchData && matchData.matchID) {
        console.log('Joining match:', matchData.matchID);
        socket.emit('join', matchData.matchID, '0'); // Join as player 0
    }
});

// Listen for all events (debug)
socket.onAny((eventName, ...args) => {
    console.log(`\nReceived event '${eventName}':`);
    console.log(JSON.stringify(args, null, 2));
});

process.stdin.resume();