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
  important: 'background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
};

// Listado de mensajes de error comunes con sus soluciones
const ERROR_SOLUTIONS = {
  'parameters preferenceId and mercadoPago must be provided together': 
    'Asegúrate de que estás pasando tanto el preferenceId como el objeto mercadoPago al componente Payment. Revisa MercadoPagoProvider.jsx.',
  
  'CSRF token not found in cookies': 
    'Error de seguridad CSRF. Esto suele ocurrir en iframes - verifica que se están bypassing los tokens CSRF para el caso de iframe.',
  
  'Cannot read properties of null (reading \'getAttribute\')': 
    'Error en el componente de teléfono. Asegúrate de que el campo existe en el DOM antes de inicializarlo.',
  
  'Error con el proveedor de pagos: local_rate_limited': 
    'MercadoPago ha limitado las solicitudes. Espera unos minutos antes de intentar de nuevo o verifica tus credenciales.',

  'Refused to connect': 
    'Error de política de seguridad CSP. Añade el dominio a la lista permitida en next.config.mjs.',
  
  'Refused to frame': 
    'Error de política de seguridad CSP para iframes. Añade el dominio en la directiva frame-src en next.config.mjs.',

  'Refused to load the image': 
    'Error de política de seguridad CSP para imágenes. Añade el dominio en la directiva img-src en next.config.mjs.',
};

// Set a default log level (e.g., from an environment variable)
const CURRENT_LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || 'info';

const canLog = (level) => LOG_LEVELS[level] <= LOG_LEVELS[CURRENT_LOG_LEVEL];

/**
 * Detecta errores conocidos y ofrece soluciones amigables
 */
function detectKnownError(message) {
  for (const [errorPattern, solution] of Object.entries(ERROR_SOLUTIONS)) {
    if (message && message.includes(errorPattern)) {
      return solution;
    }
  }
  return null;
}

/**
 * Mensaje de información estándar
 */
export function logInfo(message, data = null) {
  if (typeof window !== 'undefined') {
    if (data) {
      console.log(`%c INFO `, LOG_STYLES.info, message, data);
    } else {
      console.log(`%c INFO `, LOG_STYLES.info, message);
    }
  }
}

/**
 * Mensaje de éxito con estilo especial
 */
export function logSuccess(message, data = null) {
  if (typeof window !== 'undefined') {
    if (data) {
      console.log(`%c ÉXITO `, LOG_STYLES.success, message, data);
    } else {
      console.log(`%c ÉXITO `, LOG_STYLES.success, message);
    }
  }
}

/**
 * Mensaje de error mejorado con detección de problemas conocidos
 */
export function logError(message, error = null) {
  if (typeof window !== 'undefined') {
    const errorMessage = error?.message || message;
    const solution = detectKnownError(errorMessage);
    
    console.error(`%c ERROR `, LOG_STYLES.error, message);
    
    if (error) {
      console.error(error);
    }
    
    // Si encontramos una solución, mostramos un mensaje amigable
    if (solution) {
      console.log(`%c SOLUCIÓN `, LOG_STYLES.important, solution);
    }
  }
}

/**
 * Advertencia con posible solución
 */
export function logWarning(message, data = null) {
  if (typeof window !== 'undefined') {
    const solution = detectKnownError(message);
    
    if (data) {
      console.warn(`%c ADVERTENCIA `, LOG_STYLES.warning, message, data);
    } else {
      console.warn(`%c ADVERTENCIA `, LOG_STYLES.warning, message);
    }
    
    if (solution) {
      console.log(`%c SOLUCIÓN `, LOG_STYLES.important, solution);
    }
  }
}

/**
 * Mensaje de depuración
 */
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

// Añadir la función logWarn que está faltando
export function logWarn(message, data = {}) {
  const formattedMessage = formatLogMessage('WARN', message, data);
  if (canLog('warn')) {
    console.warn('%c' + formattedMessage, LOG_STYLES.warn);
  }
  return formattedMessage;
}