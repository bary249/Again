import React from 'react';
import { DevTools } from './Components/DevTools';
import Board from './Components/Board';

function App() {
  console.log('App rendering');
  console.log('DevTools imported as:', DevTools);

  return (
    <div className="app">
      <Board />
      <DevTools />
      <div style={{ position: 'fixed', bottom: 0, right: 0, background: 'yellow', padding: '5px' }}>
        Debug Marker
      </div>
    </div>
  );
}

export default App; 