// Queue Manager optimizado para Supabase Pro

class AdvancedQueue {
  constructor(maxConcurrent = 25) { // ✅ Mucho más alto para Pro
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
    this.processed = 0;
    this.failed = 0;
    this.totalWaitTime = 0;
  }

  async add(task, priority = 0) {
    return new Promise((resolve, reject) => {
      const queueItem = { 
        task, 
        resolve, 
        reject, 
        priority,
        addedAt: Date.now()
      };
      
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
      this.process();
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

  adjustConcurrency(newMax) {
    this.maxConcurrent = Math.max(1, Math.min(100, newMax)); // ✅ Hasta 100 para Pro
    console.log(`🔧 Queue concurrency adjusted to: ${this.maxConcurrent} (Pro tier)`);
  }
}

// ✅ Colas optimizadas para Supabase Pro
export const paymentQueue = new AdvancedQueue(25);  // Pagos: alta concurrencia
export const stockQueue = new AdvancedQueue(50);    // Stock: muy alta concurrencia  
export const emailQueue = new AdvancedQueue(25);    // De 15 a 25