// Socket.IO Collaboration Debug Utility
export class SocketDebugger {
  constructor(socket) {
    this.socket = socket;
    this.logs = [];
    this.isDebugMode = process.env.NODE_ENV === 'development';
    
    if (this.isDebugMode) {
      this.setupDebugListeners();
    }
  }
  
  log(type, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : null
    };
    
    this.logs.push(logEntry);
    
    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    if (this.isDebugMode) {
      const emoji = this.getTypeEmoji(type);
      console.log(`${emoji} [SocketDebug] ${message}`, data || '');
    }
  }
  
  getTypeEmoji(type) {
    const emojis = {
      'connect': '✅',
      'disconnect': '❌',
      'emit': '📤',
      'receive': '📥',
      'error': '🔴',
      'warning': '⚠️',
      'info': 'ℹ️',
      'success': '✅'
    };
    return emojis[type] || '📝';
  }
  
  setupDebugListeners() {
    // Log all emitted events
    const originalEmit = this.socket.emit.bind(this.socket);
    this.socket.emit = (...args) => {
      if (args[0] !== 'joinTemplateEditor' && args[0] !== 'cursorMove') {
        this.log('emit', `Emitting: ${args[0]}`, args[1]);
      }
      return originalEmit(...args);
    };
    
    // Log connection events
    this.socket.on('connect', () => {
      this.log('connect', 'Socket connected', { socketId: this.socket.id });
    });
    
    this.socket.on('disconnect', (reason) => {
      this.log('disconnect', 'Socket disconnected', { reason });
    });
    
    this.socket.on('connect_error', (error) => {
      this.log('error', 'Connection error', { error: error.message });
    });
  }
  
  // Method to get debug info for troubleshooting
  getDebugInfo() {
    return {
      connected: this.socket.connected,
      socketId: this.socket.id,
      transport: this.socket.io.engine?.transport?.name,
      logs: this.logs.slice(-20), // Last 20 logs
      timestamp: new Date().toISOString()
    };
  }
  
  // Method to export logs for support
  exportLogs() {
    const debugData = {
      userAgent: navigator.userAgent,
      socketInfo: this.getDebugInfo(),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socket-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Global debug helper function
export const createSocketDebugger = (socket) => {
  return new SocketDebugger(socket);
};