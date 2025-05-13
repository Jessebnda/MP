// Basic logger implementation
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Set a default log level (e.g., from an environment variable)
const CURRENT_LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || 'info';

const canLog = (level) => LOG_LEVELS[level] <= LOG_LEVELS[CURRENT_LOG_LEVEL];

export const logInfo = (...args) => {
  if (canLog('info')) {
    console.log('[INFO]', ...args);
  }
};

export const logError = (...args) => {
  if (canLog('error')) {
    console.error('[ERROR]', ...args);
  }
};

export const logWarn = (...args) => {
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug') {
    console.warn('[WARN]', ...args);
  }
};

export const logDebug = (...args) => {
  if (canLog('debug')) {
    console.debug('[DEBUG]', ...args);
  }
};

// Specific logger for security events
export const logSecurityEvent = (eventName, details, severity = 'info') => {
  const event = {
    type: eventName,
    timestamp: new Date().toISOString(),
    severity,
    details: details || {},
  };
  
  if (severity === 'error' && canLog('error')) {
    console.error(`[SECURITY_EVENT:${eventName}]`, event.details);
  } else if (severity === 'warn' && canLog('warn')) {
    console.warn(`[SECURITY_EVENT:${eventName}]`, event.details);
  } else if (canLog('info')) {
    console.log(`[SECURITY_EVENT:${eventName}]`, event.details);
  }
  
  // Optionally store security events in localStorage for debugging in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    try {
      const securityLogs = JSON.parse(localStorage.getItem('mp_security_logs') || '[]');
      securityLogs.push(event);
      // Limit to the last 100 events to avoid filling localStorage
      while (securityLogs.length > 100) securityLogs.shift();
      localStorage.setItem('mp_security_logs', JSON.stringify(securityLogs));
    } catch (e) {
      // Silently fail for localStorage errors
    }
  }
  
  return event;
};