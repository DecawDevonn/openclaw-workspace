/**
 * taskQueue.js
 * Priority queue implementation for task management
 * Redis-style in-memory queue with persistence
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class TaskQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tasks = new Map();
    this.persistencePath = options.persistencePath || './data/taskQueue.json';
    this.maxSize = options.maxSize || 10000;
    this.enablePersistence = options.enablePersistence !== false;
  }

  async initialize() {
    if (this.enablePersistence) {
      await this.loadFromDisk();
    }
    console.log('[TaskQueue] Initialized');
  }

  enqueue(task) {
    if (this.tasks.size >= this.maxSize) {
      throw new Error('Task queue capacity exceeded');
    }
    
    this.tasks.set(task.id, task);
    this.emit('enqueued', task);
    this.persist();
    
    return task.id;
  }

  dequeue() {
    const pending = Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => b.priority - a.priority);
    
    if (pending.length === 0) return null;
    
    const task = pending[0];
    this.emit('dequeued', task);
    
    return task;
  }

  get(taskId) {
    return this.tasks.get(taskId);
  }

  update(task) {
    if (!this.tasks.has(task.id)) {
      throw new Error(`Task ${task.id} not found`);
    }
    
    this.tasks.set(task.id, task);
    this.emit('updated', task);
    this.persist();
  }

  remove(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.delete(taskId);
      this.emit('removed', task);
      this.persist();
    }
    return task;
  }

  peekAll() {
    return Array.from(this.tasks.values());
  }

  peekByPriority(minPriority) {
    return Array.from(this.tasks.values())
      .filter(t => t.priority >= minPriority)
      .sort((a, b) => b.priority - a.priority);
  }

  peekByStatus(status) {
    return Array.from(this.tasks.values())
      .filter(t => t.status === status);
  }

  peekByAgentType(agentType) {
    return Array.from(this.tasks.values())
      .filter(t => t.agentType === agentType);
  }

  size() {
    return this.tasks.size;
  }

  pendingCount() {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'pending').length;
  }

  runningCount() {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'running').length;
  }

  completedCount() {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'completed').length;
  }

  failedCount() {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'failed').length;
  }

  clear() {
    this.tasks.clear();
    this.emit('cleared');
    this.persist();
  }

  async persist() {
    if (!this.enablePersistence) return;
    
    try {
      const data = JSON.stringify(
        Array.from(this.tasks.entries()),
        null,
        2
      );
      
      await fs.mkdir(path.dirname(this.persistencePath), { recursive: true });
      await fs.writeFile(this.persistencePath, data, 'utf8');
    } catch (error) {
      console.error('[TaskQueue] Persistence failed:', error.message);
    }
  }

  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const entries = JSON.parse(data);
      this.tasks = new Map(entries);
      console.log(`[TaskQueue] Loaded ${this.tasks.size} tasks from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[TaskQueue] Load failed:', error.message);
      }
      this.tasks = new Map();
    }
  }

  getStats() {
    return {
      total: this.size(),
      pending: this.pendingCount(),
      running: this.runningCount(),
      completed: this.completedCount(),
      failed: this.failedCount()
    };
  }
}

export default TaskQueue;
