import { runGameTest } from '../Game/testUtils';

export const DevTools = () => {
  console.log('DevTools component is being rendered'); // Debug log

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        backgroundColor: 'red', // Temporary bright color for visibility
        padding: '20px',
      }}
    >
      <button 
        onClick={() => {
          console.log('Button clicked!'); // Debug log
          runGameTest();
        }}
        style={{
          padding: '8px 16px',
          background: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Run Game Test
      </button>
    </div>
  );
};

// Optional: Add some basic styling
const styles = `
.dev-tools {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

.dev-button {
  padding: 8px 16px;
  background: #333;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.dev-button:hover {
  background: #444;
}
`; 