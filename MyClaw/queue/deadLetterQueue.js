/**
 * deadLetterQueue.js — Dead Letter Queue
 * 
 * Stores permanently failed tasks for analysis and recovery.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

class DeadLetterQueue {
  constructor(options = {}) {
    this.dataDir = options.dataDir || join(process.env.HOME || '/tmp', '.myclaw', 'data');
    this.queueFile = join(this.dataDir, 'deadLetterQueue.json');
    this.tasks = [];
    this.isInitialized = false;
  }
  
  async init() {
    if (this.isInitialized) return;
    
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.load();
      this.isInitialized = true;
      console.log(`[DLQ] Initialized with ${this.tasks.length} failed tasks`);
    } catch (error) {
      console.error('[DLQ] Init error:', error.message);
      this.isInitialized = true;
    }
  }
  
  async load() {
    try {
      const data = await fs.readFile(this.queueFile, 'utf-8');
      this.tasks = JSON.parse(data);
    } catch (error) {
      this.tasks = [];
    }
  }
  
  async save() {
    try {
      await fs.writeFile(this.queueFile, JSON.stringify(this.tasks, null, 2));
    } catch (error) {
      console.error('[DLQ] Save error:', error.message);
    }
  }
  
  async enqueue(task) {
    await this.init();
    this.tasks.push({
      ...task,
      movedToDLQ: Date.now()
    });
    await this.save();
    console.log(`[DLQ] Task ${task.id} moved to dead letter queue`);
    return task;
  }
  
  async getAll() {
    await this.init();
    return [...this.tasks];
  }
  
  async getById(taskId) {
    await this.init();
    return this.tasks.find(t => t.id === taskId);
  }
  
  async remove(taskId) {
    await this.init();
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      await this.save();
      return true;
    }
    return false;
  }
  
  async getStats() {
    await this.init();
    return {
      total: this.tasks.length,
      byType: this.tasks.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {}),
      recent: this.tasks
        .filter(t => t.movedToDLQ > Date.now() - 24 * 60 * 60 * 1000)
        .length
    };
  }
  
  async clear() {
    await this.init();
    this.tasks = [];
    await this.save();
    console.log('[DLQ] All tasks cleared');
  }
}

// Singleton
let dlqInstance = null;

export function getDeadLetterQueue() {
  if (!dlqInstance) {
    dlqInstance = new DeadLetterQueue();
  }
  return dlqInstance;
}

export { DeadLetterQueue };
export default DeadLetterQueue;
