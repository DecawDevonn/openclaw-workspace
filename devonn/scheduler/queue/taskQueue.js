/**
 * Task Queue - Redis-style Queue Management
 * 
 * Manages task persistence and queue operations.
 * In-memory implementation with pluggable backend.
 */

class TaskQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.initialized = false;
  }

  async initialize() {
    console.log("📦 Task Queue initializing...");
    this.initialized = true;
    console.log("   Queue ready (in-memory mode)");
  }

  /**
   * Add task to queue
   */
  async enqueue(task) {
    this.queue.push({
      ...task,
      enqueuedAt: Date.now()
    });
    return task.id;
  }

  /**
   * Get next task from queue
   */
  async dequeue() {
    const task = this.queue.shift();
    if (task) {
      this.processing.add(task.id);
    }
    return task;
  }

  /**
   * Mark task as complete
   */
  async complete(taskId) {
    this.processing.delete(taskId);
  }

  /**
   * Requeue failed task for retry
   */
  async requeue(task, delayMs = 0) {
    this.processing.delete(task.id);
    
    if (delayMs > 0) {
      setTimeout(() => {
        task.status = 'pending';
        task.nextRun = Date.now();
        this.queue.push(task);
      }, delayMs);
    } else {
      task.status = 'pending';
      task.nextRun = Date.now();
      this.queue.push(task);
    }
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      total: this.queue.length + this.processing.size
    };
  }

  /**
   * Clear all tasks
   */
  async clear() {
    this.queue = [];
    this.processing.clear();
  }
}

export const taskQueue = new TaskQueue();
