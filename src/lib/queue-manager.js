// Sistema de cola - OPTIMIZADO PARA VERCEL PRO

class AdvancedQueue {
  constructor(maxConcurrent = 10) { // ✅ Aumentado para Pro
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
    this.processed = 0;
    this.failed = 0;
    this.totalWaitTime = 0;
  }

  async add(task, priority = 0) { // ✅ Nuevo: soporte para prioridades
    return new Promise((resolve, reject) => {
      const queueItem = { 
        task, 
        resolve, 
        reject, 
        priority,
        addedAt: Date.now()
      };
      
      // ✅ Insertar según prioridad
      if (priority > 0) {
        const insertIndex = this.queue.findIndex(item => item.priority < priority);
        if (insertIndex === -1) {
          this.queue.push(queueItem);
        } else {
          this.queue.splice(insertIndex, 0, queueItem);
        }
      } else {
        this.queue.push(queueItem);
      }
      
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const queueItem = this.queue.shift();
    const { task, resolve, reject, addedAt } = queueItem;
    
    // ✅ Tracking de tiempo de espera
    const waitTime = Date.now() - addedAt;
    this.totalWaitTime += waitTime;

    try {
      const result = await task();
      this.processed++;
      resolve(result);
    } catch (error) {
      this.failed++;
      reject(error);
    } finally {
      this.running--;
      this.process(); // Procesar siguiente en cola
    }
  }

  getStats() {
    return {
      queued: this.queue.length,
      running: this.running,
      processed: this.processed,
      failed: this.failed,
      avgWaitTime: this.processed > 0 ? Math.round(this.totalWaitTime / this.processed) : 0,
      maxConcurrent: this.maxConcurrent
    };
  }

  // ✅ Nuevo: ajustar concurrencia dinámicamente
  adjustConcurrency(newMax) {
    this.maxConcurrent = Math.max(1, Math.min(50, newMax)); // Entre 1 y 50
    console.log(`🔧 Queue concurrency adjusted to: ${this.maxConcurrent}`);
  }
}

// ✅ Diferentes colas para diferentes tipos de operaciones
export const paymentQueue = new AdvancedQueue(10); // Pagos: alta concurrencia
export const stockQueue = new AdvancedQueue(20);   // Stock: muy alta concurrencia  
export const emailQueue = new AdvancedQueue(5);    // Emails: moderada concurrencia