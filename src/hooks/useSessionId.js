import { useEffect, useState } from 'react';

export function useSessionId(override = null) {
  const [sessionId, setSessionId] = useState(null);
  
  useEffect(() => {
    if (override) {
      setSessionId(override);
      sessionStorage.setItem('mp_global_session_id', override);
      return;
    }
    
    // 1. Intentar obtener de la URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get('sessionId');
      if (sessionFromUrl) {
        setSessionId(sessionFromUrl);
        sessionStorage.setItem('mp_global_session_id', sessionFromUrl);
        return;
      }
    }
    
    // 2. Intentar obtener del sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const storedId = sessionStorage.getItem('mp_global_session_id');
      if (storedId) {
        setSessionId(storedId);
        return;
      }
    }
    
    // 3. Crear uno nuevo
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('mp_global_session_id', newSessionId);
    setSessionId(newSessionId);
  }, [override]);
  
  return sessionId;
}