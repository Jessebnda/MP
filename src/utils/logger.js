/**
 * Sistema de logs mejorado con mensajes amigables y detección de problemas comunes
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LOG_STYLES = {
  info: 'background: #2196f3; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
  success: 'background: #4caf50; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
  warning: 'background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
  error: 'background: #f44336; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
  webhook: 'background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
  important: 'background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
};

// Set a default log level (e.g., from an environment variable)
const CURRENT_LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || 'info';

const canLog = (level) => LOG_LEVELS[level] <= LOG_LEVELS[CURRENT_LOG_LEVEL];

/**
 * Formatea mensaje de log con timestamp
 */
function formatLogMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const baseMessage = `[${timestamp}] ${level}: ${message}`;
  
  if (data && Object.keys(data).length > 0) {
    return `${baseMessage} | Data: ${JSON.stringify(data)}`;
  }
  
  return baseMessage;
}

/**
 * Log de información general
 */
export function logInfo(message, data = null) {
  if (typeof window !== 'undefined') {
    if (data) {
      console.log(`%c INFO `, LOG_STYLES.info, message, data);
    } else {
      console.log(`%c INFO `, LOG_STYLES.info, message);
    }
  } else {
    // Server-side logging
    const formattedMessage = formatLogMessage('INFO', message, data);
    console.log(formattedMessage);
  }
}

/**
 * Mensaje de error mejorado
 */
export function logError(message, error = null) {
  if (typeof window !== 'undefined') {
    console.error(`%c ERROR `, LOG_STYLES.error, message);
    
    if (error) {
      console.error(error);
    }
  } else {
    // Server-side logging
    const formattedMessage = formatLogMessage('ERROR', message, { 
      error: error?.message || error,
      stack: error?.stack
    });
    console.error(formattedMessage);
  }
}

/**
 * Advertencia con posible solución
 */
export function logWarning(message, data = null) {
  if (typeof window !== 'undefined') {
    if (data) {
      console.warn(`%c ADVERTENCIA `, LOG_STYLES.warning, message, data);
    } else {
      console.warn(`%c ADVERTENCIA `, LOG_STYLES.warning, message);
    }
  } else {
    // Server-side logging
    const formattedMessage = formatLogMessage('WARN', message, { data });
    console.warn(formattedMessage);
  }
}

// Añadir la función logWarn que está faltando
export function logWarn(message, data = {}) {
  const formattedMessage = formatLogMessage('WARN', message, data);
  if (canLog('warn')) {
    if (typeof window !== 'undefined') {
      console.warn('%c WARN ', LOG_STYLES.warning, message, data);
    } else {
      console.warn(formattedMessage);
    }
  }
  return formattedMessage;
}

/**
 * Log específico para webhooks
 */
export function logWebhook(message, data = null) {
  if (typeof window !== 'undefined') {
    if (data) {
      console.log(`%c WEBHOOK `, LOG_STYLES.webhook, message, data);
    } else {
      console.log(`%c WEBHOOK `, LOG_STYLES.webhook, message);
    }
  } else {
    const formattedMessage = formatLogMessage('WEBHOOK', message, data);
    console.log(formattedMessage);
  }
}

/**
 * Log de éxito
 */
export function logSuccess(message, data = null) {
  if (typeof window !== 'undefined') {
    if (data) {
      console.log(`%c ÉXITO `, LOG_STYLES.success, message, data);
    } else {
      console.log(`%c ÉXITO `, LOG_STYLES.success, message);
    }
  } else {
    const formattedMessage = formatLogMessage('SUCCESS', message, data);
    console.log(formattedMessage);
  }
}