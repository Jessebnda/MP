// Monitorear performance - OPTIMIZADO PARA SUPABASE GRATUITO

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      concurrentRequests: 0,
      peakConcurrency: 0,
      slowRequestCount: 0,
      last24hStats: {
        requests: 0,
        errors: 0,
        resetTime: Date.now()
      }
    };
    this.requestHistory = []; // ✅ Reducido a 50 para ahorrar memoria
  }

  startRequest() {
    this.metrics.concurrentRequests++;
    this.metrics.requestCount++;
    
    if (this.metrics.concurrentRequests > this.metrics.peakConcurrency) {
      this.metrics.peakConcurrency = this.metrics.concurrentRequests;
    }
    
    // ✅ Alertas ajustadas para plan gratuito
    if (this.metrics.concurrentRequests > 20) { // Reducido de 50 a 20
      console.warn('🚨 ALTA CONCURRENCIA (Free):', this.metrics.concurrentRequests);
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

    // ✅ Tracking de requests lentos más estricto
    if (duration > 5000) { // 5s para Free (era 10s)
      this.metrics.slowRequestCount++;
      console.warn('🐌 RESPUESTA LENTA (Free):', duration + 'ms');
    }

    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * 0.95) + (duration * 0.05);

    // ✅ Mantener historial de solo 50 requests
    this.requestHistory.push({
      duration,
      isError,
      timestamp: Date.now()
    });
    
    if (this.requestHistory.length > 50) { // Reducido de 100 a 50
      this.requestHistory.shift();
    }

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
    const speedScore = Math.max(0, 100 - (this.metrics.averageResponseTime / 100)); // Más estricto
    const concurrencyScore = Math.max(0, 100 - (this.metrics.concurrentRequests * 5)); // Más estricto
    
    return Math.round((speedScore + concurrencyScore) / 2 * (1 - errorRate));
  }

  detectAnomalies() {
    const recentRequests = this.requestHistory.slice(-10); // Reducido de 20 a 10
    const avgRecentDuration = recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length;
    
    return {
      suddenSpike: avgRecentDuration > this.metrics.averageResponseTime * 2,
      highErrorRate: recentRequests.filter(r => r.isError).length > 3, // Reducido de 5 a 3
      systemOverload: this.metrics.concurrentRequests > 15 // Reducido de 30 a 15
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();