/**
 * Professional logging utility for the Unified Editor system.
 */
const logger = {
  prefix: '[UnifiedEditor]',
  
  info(message, data) {
    console.log(`${this.prefix} INFO: ${message}`, data || '');
  },
  
  warn(message, data) {
    console.warn(`${this.prefix} WARN: ${message}`, data || '');
  },
  
  error(message, data) {
    console.error(`${this.prefix} ERROR: ${message}`, data || '');
  },
  
  debug(message, data) {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${this.prefix} DEBUG: ${message}`, data || '');
    }
  }
};

export default logger;
