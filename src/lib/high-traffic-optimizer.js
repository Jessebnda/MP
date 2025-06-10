// Optimizador para alto tráfico en Vercel Pro

import { paymentCircuitBreaker } from './circuit-breaker.js';
import { performanceMonitor } from './performance-monitor.js';
import { paymentQueue, stockQueue } from './queue-manager.js';

class HighTrafficOptimizer {
  constructor() {
    this.isMonitoring = false;
    this.adjustmentInterval = null;
    this.trafficPatterns = {
      currentLoad: 0,
      peakDetected: false,
      adaptiveSettings: {
        queueConcurrency: 10,
        circuitBreakerThreshold: 20
      }
    };
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🚀 High Traffic Optimizer iniciado para Vercel Pro');
    
    // Monitoreo cada 30 segundos
    this.adjustmentInterval = setInterval(() => {
      this.analyzeAndAdjust();
    }, 30000);
  }

  stopMonitoring() {
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
      this.adjustmentInterval = null;
    }
    this.isMonitoring = false;
  }

  analyzeAndAdjust() {
    const stats = performanceMonitor.getStatus();
    const anomalies = performanceMonitor.detectAnomalies();
    const queueStats = paymentQueue.getStats();

    // Detectar picos de tráfico
    const currentLoad = stats.concurrentRequests + queueStats.queued;
    this.trafficPatterns.currentLoad = currentLoad;

    // Ajustes dinámicos basados en carga
    if (currentLoad > 30 && !this.trafficPatterns.peakDetected) {
      this.handleTrafficPeak();
    } else if (currentLoad < 10 && this.trafficPatterns.peakDetected) {
      this.handleTrafficNormalization();
    }

    // Ajustes basados en anomalías
    if (anomalies.systemOverload) {
      this.handleSystemOverload();
    }

    // Log estadísticas cada minuto
    if (Date.now() % 60000 < 30000) {
      this.logTrafficStats(stats, queueStats);
    }
  }

  handleTrafficPeak() {
    console.log('📈 PICO DE TRÁFICO DETECTADO - Ajustando configuración');
    this.trafficPatterns.peakDetected = true;
    
    // Aumentar concurrencia de colas
    paymentQueue.adjustConcurrency(15);
    stockQueue.adjustConcurrency(25);
    
    // Ajustar circuit breaker
    paymentCircuitBreaker.threshold = 30;
  }

  handleTrafficNormalization() {
    console.log('📉 Tráfico normalizado - Restaurando configuración');
    this.trafficPatterns.peakDetected = false;
    
    // Restaurar concurrencia normal
    paymentQueue.adjustConcurrency(10);
    stockQueue.adjustConcurrency(20);
    
    // Restaurar circuit breaker
    paymentCircuitBreaker.threshold = 20;
  }

  handleSystemOverload() {
    console.warn('🚨 SOBRECARGA DEL SISTEMA - Activando medidas de emergencia');
    
    // Reducir concurrencia temporalmente
    paymentQueue.adjustConcurrency(5);
    
    // Circuit breaker más agresivo
    paymentCircuitBreaker.threshold = 10;
  }

  logTrafficStats(stats, queueStats) {
    console.log(`📊 Traffic Stats [${new Date().toISOString()}]:`, {
      concurrent: stats.concurrentRequests,
      queued: queueStats.queued,
      healthScore: stats.healthScore,
      avgResponse: stats.avgResponseTime,
      peakMode: this.trafficPatterns.peakDetected
    });
  }

  // Función para obtener configuración recomendada
  getRecommendedConfig() {
    const stats = performanceMonitor.getStatus();
    
    return {
      queueConcurrency: this.trafficPatterns.peakDetected ? 15 : 10,
      circuitBreakerThreshold: this.trafficPatterns.peakDetected ? 30 : 20,
      recommendedActions: this.getRecommendedActions(stats)
    };
  }

  getRecommendedActions(stats) {
    const actions = [];
    
    if (stats.errorRate > 0.05) {
      actions.push('Revisar logs de errores - tasa alta detectada');
    }
    
    if (stats.avgResponseTime > 5000) {
      actions.push('Optimizar consultas de base de datos');
    }
    
    if (stats.concurrentRequests > 40) {
      actions.push('Considerar escalado adicional');
    }
    
    return actions;
  }
}

export const highTrafficOptimizer = new HighTrafficOptimizer();

// Auto-iniciar en producción
if (process.env.NODE_ENV === 'production') {
  highTrafficOptimizer.startMonitoring();
}