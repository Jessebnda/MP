import { LRUCache } from 'lru-cache';

// Configuración simple de rate limiting en memoria
// Para producción con mucho tráfico, considera usar Redis (Upstash, etc.)
const rateLimit = {
  tokenCache: new LRUCache({
    max: 500, // Máx. entradas en caché
    ttl: 60 * 1000, // 1 minuto en milisegundos
  }),
  
  // Límite: 10 solicitudes por minuto por IP
  limiter: function(ip) {
    const tokenCache = this.tokenCache;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = 10; // Máximo de solicitudes por ventana
    
    const tokenCount = tokenCache.get(ip) || [0, now];
    const [requestCount, oldestTimestamp] = tokenCount;
    
    // Si pasó más de 1 minuto, reiniciar contador
    const isNewWindow = now - oldestTimestamp > windowMs;
    const newCount = isNewWindow ? 1 : requestCount + 1;
    const newTimestamp = isNewWindow ? now : oldestTimestamp;
    
    tokenCache.set(ip, [newCount, newTimestamp]);
    
    return {
      success: newCount <= maxRequests,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - newCount),
      reset: newTimestamp + windowMs
    };
  }
};

export default rateLimit;