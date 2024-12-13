// Test if server can start locally
console.log('Testing server startup...');

import('./server.mjs')
  .then(() => {
    console.log('Server started successfully!');
  })
  .catch(error => {
    console.error('Server failed to start:', error);
    process.exit(1);
  }); 