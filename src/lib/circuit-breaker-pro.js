// Circuit Breaker optimizado para Supabase Pro

class CircuitBreaker {
  constructor(threshold = 50, timeout = 30000) { // ✅ Más tolerante para Pro
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
    
    // ✅ Configuración más tolerante para Supabase Pro
    if (this.successiveFailures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.warn(`🚨 Circuit breaker OPENED - ${this.successiveFailures} successive failures (Pro tier)`);
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

export const paymentCircuitBreaker = new CircuitBreaker(50, 30000); // ✅ Configurado para Pro