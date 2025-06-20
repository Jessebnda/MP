// Protección contra sobrecarga - OPTIMIZADO PARA VERCEL PRO

class CircuitBreaker {
  constructor(threshold = 20, timeout = 30000) { // ✅ Aumentado para Pro
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
    this.successiveFailures = 0; // ✅ Nuevo: tracking de fallas consecutivas
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
    this.successiveFailures = 0; // ✅ Reset failures consecutivas
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.successiveFailures++;
    
    // ✅ Lógica más sofisticada para Pro
    if (this.successiveFailures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`🚨 Circuit breaker OPENED - ${this.successiveFailures} successive failures`);
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

export const paymentCircuitBreaker = new CircuitBreaker(20, 30000); // ✅ Configurado para Pro