import React from 'react';

export function Debug({ gamestate, moves }) {
  return (
    <div style={{ padding: '20px', background: '#f0f0f0' }}>
      <h3>Debug Panel</h3>
      <pre>
        {JSON.stringify(gamestate, null, 2)}
      </pre>
    </div>
  );
}