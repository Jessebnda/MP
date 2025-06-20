// Monitorear performance - OPTIMIZADO PARA VERCEL PRO + ALTO TRÁFICO

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      concurrentRequests: 0,
      peakConcurrency: 0, // ✅ Nuevo: pico de concurrencia
      slowRequestCount: 0, // ✅ Nuevo: contador de requests lentos
      last24hStats: {
        requests: 0,
        errors: 0,
        resetTime: Date.now()
      }
    };
    this.requestHistory = []; // ✅ Nuevo: historial de últimas 100 requests
  }

  startRequest() {
    this.metrics.concurrentRequests++;
    this.metrics.requestCount++;
    
    // ✅ Actualizar pico de concurrencia
    if (this.metrics.concurrentRequests > this.metrics.peakConcurrency) {
      this.metrics.peakConcurrency = this.metrics.concurrentRequests;
    }
    
    // ✅ Alertas ajustadas para Pro (mayor tráfico esperado)
    if (this.metrics.concurrentRequests > 50) { // Aumentado de 3 a 50
      console.warn('🚨 ALTA CONCURRENCIA (Pro):', this.metrics.concurrentRequests);
    }
    
    return Date.now();
  }

  endRequest(startTime, isError = false) {
    this.metrics.concurrentRequests--;
    const duration = Date.now() - startTime;
    
    if (isError) {
      this.metrics.errorCount++;
      this.metrics.last24hStats.errors++;
    }

    // ✅ Tracking de requests lentos
    if (duration > 10000) { // 10s para Pro
      this.metrics.slowRequestCount++;
      console.warn('🐌 RESPUESTA LENTA (Pro):', duration + 'ms');
    }

    // Calcular promedio móvil
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * 0.95) + (duration * 0.05);

    // ✅ Mantener historial de últimas 100 requests
    this.requestHistory.push({
      duration,
      isError,
      timestamp: Date.now()
    });
    
    if (this.requestHistory.length > 100) {
      this.requestHistory.shift();
    }

    // ✅ Reset stats cada 24h
    this.resetDailyStatsIfNeeded();
  }

  resetDailyStatsIfNeeded() {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (now - this.metrics.last24hStats.resetTime > dayInMs) {
      this.metrics.last24hStats = {
        requests: 0,
        errors: 0,
        resetTime: now
      };
    }
  }

  getStatus() {
    const errorRate = this.metrics.errorCount / this.metrics.requestCount;
    const recentErrors = this.requestHistory.filter(r => r.isError).length;
    
    return {
      ...this.metrics,
      healthScore: this.calculateHealthScore(),
      errorRate: Math.round(errorRate * 100) / 100,
      recentErrorRate: Math.round((recentErrors / this.requestHistory.length) * 100) / 100,
      avgResponseTime: Math.round(this.metrics.averageResponseTime)
    };
  }

  calculateHealthScore() {
    const errorRate = this.metrics.errorCount / (this.metrics.requestCount || 1);
    const speedScore = Math.max(0, 100 - (this.metrics.averageResponseTime / 200)); // Más tolerante
    const concurrencyScore = Math.max(0, 100 - (this.metrics.concurrentRequests * 2)); // Más tolerante
    
    return Math.round((speedScore + concurrencyScore) / 2 * (1 - errorRate));
  }

  // ✅ Nueva función para detectar patrones problemáticos
  detectAnomalies() {
    const recentRequests = this.requestHistory.slice(-20); // Últimas 20
    const avgRecentDuration = recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length;
    
    return {
      suddenSpike: avgRecentDuration > this.metrics.averageResponseTime * 2,
      highErrorRate: recentRequests.filter(r => r.isError).length > 5,
      systemOverload: this.metrics.concurrentRequests > 30
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();