import { cookies } from 'next/headers';
import { logError, logInfo } from './logger';

/**
 * Valida el token CSRF en la solicitud
 * @param {Request} req - Objeto de solicitud de Next.js
 * @returns {Promise<void>}
 * @throws {Error} Si el token CSRF no es válido
 */
export async function validateCsrfToken(req) {
  // Skip CSRF validation in development mode
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // IMPORTANT: Add this section to detect iframe embedded contexts
  const referer = req.headers.get('Referer');
  const secFetchDest = req.headers.get('Sec-Fetch-Dest');
  const isIframeEmbed = referer?.includes('framer.com') || 
                        referer?.includes('framer.app') ||
                        secFetchDest === 'iframe';
                        
  // Skip validation for iframe embeds
  if (isIframeEmbed) {
    logInfo('CSRF validation bypassed for iframe embed context');
    return true;
  }

  try {
    // Rest of your existing validation code...
    const csrfToken = req.headers.get('X-CSRF-Token');
    
    if (!csrfToken) {
      throw new Error('CSRF token missing');
    }

    // Obtener el token almacenado en cookies
    const storedToken = cookies().get('csrf-token')?.value;
    
    if (!storedToken) {
      throw new Error('CSRF token not found in cookies');
    }

    // Comparar los tokens
    if (csrfToken !== storedToken) {
      throw new Error('CSRF token validation failed');
    }

    logInfo('CSRF token validated successfully');
    return true;
  } catch (error) {
    // Crear un error personalizado con un flag para identificarlo
    const csrfError = new Error(`CSRF validation failed: ${error.message}`);
    csrfError.isCsrfError = true;
    logError('CSRF Error:', error);
    throw csrfError;
  }
}