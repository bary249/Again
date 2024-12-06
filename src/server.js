const { Server } = require('boardgame.io/server');
const { MyGame } = require('./game'); // Ensure this path is correct

const server = Server({ games: [MyGame] });
console.log(Server);
server.run(8000);