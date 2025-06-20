// Optimizador para Supabase Free + Vercel Pro

import { paymentCircuitBreaker } from './circuit-breaker-free.js';
import { performanceMonitor } from './performance-monitor-free.js';
import { paymentQueue, stockQueue } from './queue-manager-free.js';
import { supabaseOptimizer } from './supabase-optimizer.js';

class FreeTrafficOptimizer {
  constructor() {
    this.isMonitoring = false;
    this.adjustmentInterval = null;
    this.trafficPatterns = {
      currentLoad: 0,
      peakDetected: false,
      adaptiveSettings: {
        queueConcurrency: 3,
        circuitBreakerThreshold: 10
      }
    };
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🚀 Free Tier Optimizer iniciado para Vercel Pro + Supabase Free');
    
    // ✅ Monitoreo cada 60 segundos (menos frecuente)
    this.adjustmentInterval = setInterval(() => {
      this.analyzeAndAdjust();
    }, 60000);
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
    const supabaseStats = supabaseOptimizer.getStats();

    const currentLoad = stats.concurrentRequests + queueStats.queued;
    this.trafficPatterns.currentLoad = currentLoad;

    // ✅ Umbrales más conservadores para plan gratuito
    if (currentLoad > 10 && !this.trafficPatterns.peakDetected) {
      this.handleTrafficPeak();
    } else if (currentLoad < 3 && this.trafficPatterns.peakDetected) {
      this.handleTrafficNormalization();
    }

    if (anomalies.systemOverload) {
      this.handleSystemOverload();
    }

    // ✅ Monitorear salud de Supabase
    if (supabaseStats.errorRate > 0.1) {
      this.handleSupabaseStress();
    }

    // Log cada 2 minutos en lugar de cada minuto
    if (Date.now() % 120000 < 60000) {
      this.logTrafficStats(stats, queueStats, supabaseStats);
    }
  }

  handleTrafficPeak() {
    console.log('📈 PICO DE TRÁFICO DETECTADO - Ajustando para Free Tier');
    this.trafficPatterns.peakDetected = true;
    
    // ✅ Aumentar muy poco la concurrencia
    paymentQueue.adjustConcurrency(5);
    stockQueue.adjustConcurrency(7);
    
    paymentCircuitBreaker.threshold = 15;
  }

  handleTrafficNormalization() {
    console.log('📉 Tráfico normalizado - Restaurando configuración Free');
    this.trafficPatterns.peakDetected = false;
    
    paymentQueue.adjustConcurrency(3);
    stockQueue.adjustConcurrency(5);
    
    paymentCircuitBreaker.threshold = 10;
  }

  handleSystemOverload() {
    console.warn('🚨 SOBRECARGA - Activando medidas conservadoras (Free)');
    
    // ✅ Reducir agresivamente
    paymentQueue.adjustConcurrency(2);
    paymentCircuitBreaker.threshold = 5;
  }

  handleSupabaseStress() {
    console.warn('🔴 SUPABASE STRESS DETECTED - Reduciendo carga');
    
    // ✅ Forzar rate limiting más agresivo
    supabaseOptimizer.rateLimiter.minInterval = 500; // 500ms entre queries
    
    // Reducir concurrencia temporalmente
    paymentQueue.adjustConcurrency(1);
    stockQueue.adjustConcurrency(2);
  }

  logTrafficStats(stats, queueStats, supabaseStats) {
    console.log(`📊 Free Tier Stats [${new Date().toISOString()}]:`, {
      concurrent: stats.concurrentRequests,
      queued: queueStats.queued,
      healthScore: stats.healthScore,
      avgResponse: stats.avgResponseTime,
      supabaseErrorRate: Math.round(supabaseStats.errorRate * 100) + '%',
      supabaseQueries: supabaseStats.totalQueries,
      peakMode: this.trafficPatterns.peakDetected
    });
  }

  getRecommendedConfig() {
    const stats = performanceMonitor.getStatus();
    
    return {
      queueConcurrency: this.trafficPatterns.peakDetected ? 5 : 3,
      circuitBreakerThreshold: this.trafficPatterns.peakDetected ? 15 : 10,
      recommendedActions: this.getRecommendedActions(stats)
    };
  }

  getRecommendedActions(stats) {
    const actions = [];
    
    if (stats.errorRate > 0.03) { // Más estricto
      actions.push('Revisar logs de errores - tasa alta para Free tier');
    }
    
    if (stats.avgResponseTime > 3000) { // Más estricto
      actions.push('Optimizar queries - respuesta lenta para Free tier');
    }
    
    if (stats.concurrentRequests > 15) { // Más estricto
      actions.push('Tráfico alto para Free tier - considerar optimizaciones');
    }
    
    return actions;
  }
}

export const freeTrafficOptimizer = new FreeTrafficOptimizer();

// Auto-iniciar en producción
if (process.env.NODE_ENV === 'production') {
  freeTrafficOptimizer.startMonitoring();
}