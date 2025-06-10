// Performance Monitor optimizado para Supabase Pro

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
    this.requestHistory = []; // ✅ Aumentado a 200 para Pro
  }

  startRequest() {
    this.metrics.concurrentRequests++;
    this.metrics.requestCount++;
    
    if (this.metrics.concurrentRequests > this.metrics.peakConcurrency) {
      this.metrics.peakConcurrency = this.metrics.concurrentRequests;
    }
    
    // ✅ Alertas ajustadas para Supabase Pro
    if (this.metrics.concurrentRequests > 100) { // Aumentado para Pro
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

    // ✅ Tracking de requests lentos más tolerante
    if (duration > 15000) { // 15s para Pro (era 5s)
      this.metrics.slowRequestCount++;
      console.warn('🐌 RESPUESTA LENTA (Pro):', duration + 'ms');
    }

    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * 0.95) + (duration * 0.05);

    // ✅ Mantener historial de 200 requests
    this.requestHistory.push({
      duration,
      isError,
      timestamp: Date.now()
    });
    
    if (this.requestHistory.length > 200) { // Aumentado para Pro
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
    const speedScore = Math.max(0, 100 - (this.metrics.averageResponseTime / 300)); // Más tolerante
    const concurrencyScore = Math.max(0, 100 - (this.metrics.concurrentRequests * 1)); // Más tolerante
    
    return Math.round((speedScore + concurrencyScore) / 2 * (1 - errorRate));
  }

  detectAnomalies() {
    const recentRequests = this.requestHistory.slice(-50); // Aumentado para Pro
    const avgRecentDuration = recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length;
    
    return {
      suddenSpike: avgRecentDuration > this.metrics.averageResponseTime * 2,
      highErrorRate: recentRequests.filter(r => r.isError).length > 10, // Más tolerante
      systemOverload: this.metrics.concurrentRequests > 75 // Más tolerante
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();