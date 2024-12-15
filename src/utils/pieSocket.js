export class PieSocketManager {
  constructor(cluster, apiKey, channelId) {
    this.cluster = cluster;
    this.apiKey = apiKey;
    this.channelId = channelId;
    this.ws = null;
    this.callbacks = {
      onStateUpdate: null,
      onConnect: null,
      onError: null
    };
  }

  connect() {
    this.ws = new WebSocket(
      `wss://${this.cluster}/${this.channelId}?api_key=${this.apiKey}`
    );

    this.ws.onopen = () => {
      console.log('PieSocket Connected');
      if (this.callbacks.onConnect) {
        this.callbacks.onConnect();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'gameStateUpdate' && this.callbacks.onStateUpdate) {
          this.callbacks.onStateUpdate(data);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('PieSocket error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    };

    window.pieSocket = this.ws;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      window.pieSocket = null;
    }
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  sendGameState(G, ctx) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'gameStateUpdate',
        G,
        ctx,
        timestamp: Date.now()
      }));
    }
  }
} 