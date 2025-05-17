// Nuevo archivo para centralizar la lógica del sessionId
import { useCallback, useMemo } from 'react';

export function useSessionId(sessionIdOverride = null) {
  // Función para obtener o crear el sessionId global
  const getOrCreateGlobalSessionId = useCallback(() => {
    // 1. Intentar obtener de la URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get('sessionId');
      if (sessionFromUrl) return sessionFromUrl;
    }
    
    // 2. Intentar obtener del sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const storedId = sessionStorage.getItem('mp_global_session_id');
      if (storedId) return storedId;
    }
    
    // 3. Crear uno nuevo y guardarlo para que sea consistente
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('mp_global_session_id', newSessionId);
    }
    return newSessionId;
  }, []);
  
  // Usar el sessionId proporcionado o generarlo/obtenerlo
  const sessionId = useMemo(() => 
    sessionIdOverride || getOrCreateGlobalSessionId(), 
  [getOrCreateGlobalSessionId, sessionIdOverride]);
  
  return sessionId;
}