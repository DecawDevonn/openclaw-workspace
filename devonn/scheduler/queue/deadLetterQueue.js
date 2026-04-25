/**
 * Dead Letter Queue - Failure Memory
 * 
 * Stores permanently failed tasks with full context.
 * Enables post-mortem analysis and system improvement.
 */

class DeadLetterQueue {
  constructor() {
    this.failures = [];
    this.maxSize = 1000;
  }

  async add(failedTask) {
    const entry = {
      id: failedTask.id,
      type: failedTask.type,
      payload: failedTask.payload,
      failureReason: failedTask.failureReason,
      retryCount: failedTask.retries,
      retryHistory: failedTask.retryHistory,
      createdAt: failedTask.createdAt,
      escalatedAt: failedTask.escalatedAt,
      executionTime: failedTask.executionHistory?.reduce((sum, h) => sum + (h.duration || 0), 0) || 0
    };

    this.failures.unshift(entry);
    
    if (this.failures.length > this.maxSize) {
      this.failures = this.failures.slice(0, this.maxSize);
    }

    console.log(`📦 Task ${failedTask.id} moved to Dead Letter Queue`);
    return entry.id;
  }

  getAll() {
    return [...this.failures];
  }

  getRecent(count = 10) {
    return this.failures.slice(0, count);
  }

  getByType(type) {
    return this.failures.filter(f => f.type === type);
  }

  getStats() {
    const byType = {};
    this.failures.forEach(f => {
      byType[f.type] = (byType[f.type] || 0) + 1;
    });

    return {
      total: this.failures.length,
      byType,
      recent: this.getRecent(5)
    };
  }

  clear() {
    this.failures = [];
  }
}

export const deadLetterQueue = new DeadLetterQueue();
