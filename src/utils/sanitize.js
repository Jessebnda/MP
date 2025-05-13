// Basic input sanitization functions

/**
 * Sanitizes a string to prevent XSS attacks
 * This is a very basic implementation. For production, use a dedicated library.
 * @param {string} input - The string to sanitize
 * @returns {string} - The sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  
  // Convert to string and replace potentially dangerous characters
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML; // This converts special characters to HTML entities
}

/**
 * Sanitizes input based on expected type
 * @param {*} value - The value to sanitize
 * @param {string} type - The expected type ('string', 'number', 'integer', 'email', etc.)
 * @returns {*} - The sanitized value
 */
export function sanitizeInput(value, type) {
  if (value === null || value === undefined) {
    // Return sensible defaults based on type
    if (type === 'string' || type === 'email' || type === 'url' || type === 'productId') return '';
    if (type === 'number' || type === 'integer' || type === 'quantity') return 0;
    if (type === 'boolean') return false;
    return null;
  }

  switch (type) {
    case 'string':
      return String(value).trim();
    
    case 'productId': // Allow alphanumeric and hyphens for IDs
      return String(value).replace(/[^a-zA-Z0-9-]/g, '').trim();
    
    case 'number':
      return parseFloat(value);
    
    case 'integer':
    case 'quantity':
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 0 : parsed;
    
    case 'boolean':
      return Boolean(value);
    
    case 'email':
      const email = String(value).trim().toLowerCase();
      // Basic email format check
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return email;
      }
      return ''; // Invalid email
    
    case 'url':
      try {
        const url = new URL(String(value));
        // Only allow http/https URLs
        if (['http:', 'https:'].includes(url.protocol)) {
          return url.toString();
        }
        return '';
      } catch (_) {
        return ''; // Invalid URL
      }
    
    default:
      // For unknown types, just return the value
      return value;
  }
}