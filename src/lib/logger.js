/**
 * Centralized logging utility that safely handles sensitive data
 * and only logs in development environments
 */

// Safe logging function that sanitizes data and respects environment
export function devLog(message, data = null, level = 'log') {
  if (process.env.NODE_ENV !== 'development') return;
  
  // If no data, just log the message
  if (data === null) {
    console[level](message);
    return;
  }
  
  // If data exists, sanitize it
  const safeData = sanitizeLogData(data);
  console[level](message, safeData);
}

// Different log level helpers
export const logDebug = (message, data = null) => devLog(message, data, 'debug');
export const logInfo = (message, data = null) => devLog(message, data, 'log');
export const logWarn = (message, data = null) => devLog(message, data, 'warn');
export const logError = (message, data = null) => devLog(message, data, 'error');

// Sanitize sensitive data before logging
function sanitizeLogData(data) {
  if (!data || typeof data !== 'object') return data;
  
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // List of sensitive fields to redact
  const sensitiveFields = [
    'token', 'csrfToken', 'password', 'card', 'cvv', 'secret',
    'authorization', 'cardNumber', 'securityCode', 'payment_method_id'
  ];
  
  // Function to recursively sanitize objects
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      // Check if this is a sensitive field
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } 
      // Recurse into nested objects
      else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    });
  };
  
  sanitizeObject(sanitized);
  return sanitized;
}