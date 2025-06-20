// Protección contra sobrecarga - OPTIMIZADO PARA SUPABASE GRATIS

class CircuitBreaker {
  constructor(threshold = 10, timeout = 60000) { // ✅ Reducido para plan gratuito
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
    this.successiveFailures = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - High failure rate detected');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.successiveFailures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.successiveFailures++;
    
    // ✅ Más conservador para plan gratuito
    if (this.successiveFailures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.warn(`🚨 Circuit breaker OPENED - ${this.successiveFailures} successive failures (Free tier)`);
    }
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successiveFailures: this.successiveFailures,
      threshold: this.threshold
    };
  }
}

export const paymentCircuitBreaker = new CircuitBreaker(10, 60000); // ✅ Configurado para Free