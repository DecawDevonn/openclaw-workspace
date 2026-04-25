/**
 * taskQueue.js — Task Queue System
 * 
 * Redis-style queue logic for task management.
 * Handles task storage, retrieval, and state management.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

class TaskQueue {
  constructor(options = {}) {
    this.dataDir = options.dataDir || join(process.env.HOME || '/tmp', '.myclaw', 'data');
    this.queueFile = join(this.dataDir, 'taskQueue.json');
    this.tasks = new Map();
    this.isInitialized = false;
  }
  
  async init() {
    if (this.isInitialized) return;
    
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Try to load existing tasks
      await this.load();
      
      this.isInitialized = true;
      console.log(`[TASK_QUEUE] Initialized with ${this.tasks.size} tasks`);
    } catch (error) {
      console.error('[TASK_QUEUE] Init error:', error.message);
      this.isInitialized = true; // Still mark as initialized to prevent repeated attempts
    }
  }
  
  async load() {
    try {
      const data = await fs.readFile(this.queueFile, 'utf-8');
      const tasksArray = JSON.parse(data);
      this.tasks = new Map(tasksArray.map(t => [t.id, t]));
    } catch (error) {
      // File doesn't exist or is empty - start fresh
      this.tasks = new Map();
    }
  }
  
  async save() {
    try {
      const tasksArray = Array.from(this.tasks.values());
      await fs.writeFile(this.queueFile, JSON.stringify(tasksArray, null, 2));
    } catch (error) {
      console.error('[TASK_QUEUE] Save error:', error.message);
    }
  }
  
  /**
   * Add a task to the queue
   */
  async enqueue(task) {
    await this.init();
    this.tasks.set(task.id, task);
    await this.save();
    return task;
  }
  
  /**
   * Get a task by ID
   */
  async get(taskId) {
    await this.init();
    return this.tasks.get(taskId);
  }
  
  /**
   * Update a task
   */
  async update(task) {
    await this.init();
    if (this.tasks.has(task.id)) {
      this.tasks.set(task.id, task);
      await this.save();
      return true;
    }
    return false;
  }
  
  /**
   * Remove a task
   */
  async remove(taskId) {
    await this.init();
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }
  
  /**
   * Get all pending tasks
   */
  async getPending() {
    await this.init();
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        // Higher priority first, then older tasks first
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      });
  }
  
  /**
   * Get all tasks with a specific status
   */
  async getByStatus(status) {
    await this.init();
    return Array.from(this.tasks.values())
      .filter(t => t.status === status);
  }
  
  /**
   * Get queue statistics
   */
  async getStats() {
    await this.init();
    const all = Array.from(this.tasks.values());
    return {
      total: all.length,
      pending: all.filter(t => t.status === 'pending').length,
      running: all.filter(t => t.status === 'running').length,
      completed: all.filter(t => t.status === 'completed').length,
      failed: all.filter(t => t.status === 'failed').length,
      cancelled: all.filter(t => t.status === 'cancelled').length
    };
  }
  
  /**
   * Get queue size
   */
  size() {
    return this.tasks.size;
  }
  
  /**
   * Clear all tasks (use with caution)
   */
  async clear() {
    await this.init();
    this.tasks.clear();
    await this.save();
    console.log('[TASK_QUEUE] All tasks cleared');
  }
  
  /**
   * Clean up old completed/failed tasks
   */
  async cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // Default 7 days
    await this.init();
    const now = Date.now();
    let removed = 0;
    
    for (const [id, task] of this.tasks) {
      if ((task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
          task.lastRun && (now - task.lastRun > maxAge)) {
        this.tasks.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      await this.save();
      console.log(`[TASK_QUEUE] Cleaned up ${removed} old tasks`);
    }
    
    return removed;
  }
}

// Singleton
let queueInstance = null;

export function getTaskQueue() {
  if (!queueInstance) {
    queueInstance = new TaskQueue();
  }
  return queueInstance;
}

export { TaskQueue };
export default TaskQueue;
