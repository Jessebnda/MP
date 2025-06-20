// Optimizador específico para Supabase Free Tier

class SupabaseOptimizer {
  constructor() {
    this.connectionPool = new Map();
    this.queryStats = {
      totalQueries: 0,
      failedQueries: 0,
      avgResponseTime: 0
    };
    this.rateLimiter = {
      lastQuery: 0,
      minInterval: 100 // 100ms mínimo entre queries
    };
  }

  // ✅ Rate limiting para evitar saturar el plan gratuito
  async rateLimitedQuery(queryFunction) {
    const now = Date.now();
    const timeSinceLastQuery = now - this.rateLimiter.lastQuery;
    
    if (timeSinceLastQuery < this.rateLimiter.minInterval) {
      const waitTime = this.rateLimiter.minInterval - timeSinceLastQuery;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.rateLimiter.lastQuery = Date.now();
    
    const startTime = Date.now();
    try {
      const result = await queryFunction();
      const duration = Date.now() - startTime;
      
      this.queryStats.totalQueries++;
      this.queryStats.avgResponseTime = 
        (this.queryStats.avgResponseTime * 0.9) + (duration * 0.1);
      
      return result;
    } catch (error) {
      this.queryStats.failedQueries++;
      throw error;
    }
  }

  // ✅ Batch operations para reducir número de queries
  async batchInsert(supabase, tableName, records, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const result = await this.rateLimitedQuery(async () => {
        return await supabase
          .from(tableName)
          .insert(batch)
          .select();
      });
      
      results.push(...(result.data || []));
      
      // Pequeña pausa entre batches
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }

  // ✅ Query optimization con cache
  async optimizedSelect(supabase, tableName, filters = {}, useCache = true) {
    const cacheKey = `${tableName}_${JSON.stringify(filters)}`;
    
    if (useCache && this.connectionPool.has(cacheKey)) {
      const cached = this.connectionPool.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) { // Cache 30 segundos
        return cached.data;
      }
    }
    
    const result = await this.rateLimitedQuery(async () => {
      let query = supabase.from(tableName).select('*');
      
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      return await query;
    });
    
    if (useCache && result.data) {
      this.connectionPool.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }

  getStats() {
    return {
      ...this.queryStats,
      errorRate: this.queryStats.failedQueries / Math.max(1, this.queryStats.totalQueries),
      cacheSize: this.connectionPool.size
    };
  }

  // ✅ Limpiar cache periódicamente
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.connectionPool.entries()) {
      if (now - value.timestamp > 60000) { // 1 minuto de expiración
        this.connectionPool.delete(key);
      }
    }
  }
}

export const supabaseOptimizer = new SupabaseOptimizer();

// Limpiar cache cada 5 minutos
setInterval(() => {
  supabaseOptimizer.clearExpiredCache();
}, 300000);