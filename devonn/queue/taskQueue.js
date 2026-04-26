/**
 * Task Queue - Priority-based task management
 * Replaces static cron with dynamic, dependency-aware queuing
 */

import { promises as fs } from 'fs';
import { join } from 'path';

class TaskQueue {
  constructor(config = {}) {
    this.tasks = new Map();
    this.dependencies = new Map(); // taskId -> [dependentTaskIds]
    this.persistPath = config.persistPath || './data/taskQueue.json';
    this.nextId = 1;
  }

  /**
   * Add a new task to the queue
   */
  async add(taskSpec) {
    const task = {
      id: taskSpec.id || `task_${Date.now()}_${this.nextId++}`,
      type: taskSpec.type,
      subtype: taskSpec.subtype,
      priority: taskSpec.priority || 5,
      status: 'pending',
      retries: 0,
      maxRetries: taskSpec.maxRetries || 3,
      retryDelay: taskSpec.retryDelay || 5000,
      attempts: 0,
      dependencies: taskSpec.dependencies || [],
      payload: taskSpec.payload || {},
      metadata: {
        createdAt: new Date().toISOString(),
        scheduledAt: taskSpec.scheduleAt || null,
        tags: taskSpec.tags || []
      }
    };

    // Validate dependencies exist
    for (const depId of task.dependencies) {
      if (!this.tasks.has(depId)) {
        throw new Error(`Dependency not found: ${depId}`);
      }
      // Register reverse dependency
      if (!this.dependencies.has(depId)) {
        this.dependencies.set(depId, []);
      }
      this.dependencies.get(depId).push(task.id);
    }

    this.tasks.set(task.id, task);
    
    console.log(`[TaskQueue] Added task: ${task.id} (priority: ${task.priority})`);
    
    return task;
  }

  /**
   * Get runnable tasks based on priority and system health
   */
  async getRunnableTasks(limit, health) {
    const now = new Date().toISOString();
    const candidates = [];

    for (const task of this.tasks.values()) {
      // Skip non-pending tasks
      if (task.status !== 'pending') continue;

      // Check scheduled time
      if (task.metadata.scheduledAt && task.metadata.scheduledAt > now) continue;

      // Check dependencies
      if (!this.areDependenciesMet(task)) continue;

      // Check health-based filtering
      if (health.status === 'warning' && task.priority < 7) continue;
      if (health.status === 'critical' && task.priority < 9) continue;

      candidates.push(task);
    }

    // Sort by priority (descending), then by creation time
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.metadata.createdAt) - new Date(b.metadata.createdAt);
    });

    return candidates.slice(0, limit);
  }

  /**
   * Check if all dependencies are met for a task
   */
  areDependenciesMet(task) {
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (!dep || dep.status !== 'completed') return false;
    }
    return true;
  }

  /**
   * Get tasks that depend on a given task
   */
  getDependents(taskId) {
    const dependentIds = this.dependencies.get(taskId) || [];
    return dependentIds.map(id => this.tasks.get(id)).filter(Boolean);
  }

  /**
   * Update task status
   */
  update(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    Object.assign(task, updates);
    return task;
  }

  /**
   * Requeue a failed task for retry
   */
  requeue(taskId, updates = {}) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'pending';
    task.retries++;
    Object.assign(task, updates);

    // Exponential backoff for retry delay
    task.retryDelay = Math.min(task.retryDelay * 2, 300000); // Max 5 min
    
    // Schedule retry
    const retryAt = new Date(Date.now() + task.retryDelay);
    task.metadata.scheduledAt = retryAt.toISOString();

    console.log(`[TaskQueue] Requeued task: ${task.id} (retry ${task.retries}/${task.maxRetries}) at ${retryAt.toISOString()}`);
    
    return task;
  }

  /**
   * Move task to dead letter queue (permanent failure)
   */
  async moveToDLQ(taskId, reason) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'dead_letter';
    task.metadata.dlqAt = new Date().toISOString();
    task.metadata.dlqReason = reason;

    // Persist to DLQ file
    await this.appendToDLQ(task);

    // Remove from active queue
    this.tasks.delete(taskId);

    console.log(`[TaskQueue] Moved to DLQ: ${task.id} - ${reason}`);
    
    return task;
  }

  /**
   * Get task by ID
   */
  get(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks matching criteria
   */
  query(criteria = {}) {
    let results = Array.from(this.tasks.values());

    if (criteria.status) {
      results = results.filter(t => t.status === criteria.status);
    }
    if (criteria.type) {
      results = results.filter(t => t.type === criteria.type);
    }
    if (criteria.priority) {
      results = results.filter(t => t.priority >= criteria.priority);
    }
    if (criteria.tags) {
      results = results.filter(t => 
        criteria.tags.some(tag => t.metadata.tags.includes(tag))
      );
    }

    return results;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0
    };

    for (const task of this.tasks.values()) {
      stats[task.status] = (stats[task.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get queue size
   */
  size() {
    return this.tasks.size;
  }

  /**
   * Get all tasks
   */
  peekAll() {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  peekByStatus(status) {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  /**
   * Get tasks by minimum priority
   */
  peekByPriority(minPriority) {
    return Array.from(this.tasks.values())
      .filter(t => t.priority >= minPriority)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Persist queue to disk
   */
  async persist() {
    try {
      const data = {
        tasks: Array.from(this.tasks.entries()),
        nextId: this.nextId,
        persistedAt: new Date().toISOString()
      };

      await fs.mkdir('./data', { recursive: true });
      await fs.writeFile(this.persistPath, JSON.stringify(data, null, 2));
      
      console.log(`[TaskQueue] Persisted ${this.tasks.size} tasks`);
    } catch (error) {
      console.error('[TaskQueue] Persist failed:', error);
    }
  }

  /**
   * Load queue from disk
   */
  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.persistPath, 'utf8'));
      
      this.tasks = new Map(data.tasks);
      this.nextId = data.nextId || 1;
      
      // Rebuild dependency map
      this.dependencies.clear();
      for (const [taskId, task] of this.tasks) {
        for (const depId of task.dependencies) {
          if (!this.dependencies.has(depId)) {
            this.dependencies.set(depId, []);
          }
          this.dependencies.get(depId).push(taskId);
        }
      }

      console.log(`[TaskQueue] Loaded ${this.tasks.size} tasks`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[TaskQueue] Load failed:', error);
      }
    }
  }

  /**
   * Append task to dead letter queue file
   */
  async appendToDLQ(task) {
    const dlqPath = './data/deadLetterQueue.jsonl';
    const line = JSON.stringify(task) + '\n';
    await fs.appendFile(dlqPath, line);
  }

  /**
   * Clean up old completed tasks
   */
  async cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const cutoff = Date.now() - maxAge;
    let removed = 0;

    for (const [taskId, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed') {
        const taskTime = new Date(task.lastRun || task.metadata.createdAt).getTime();
        if (taskTime < cutoff) {
          this.tasks.delete(taskId);
          removed++;
        }
      }
    }

    if (removed > 0) {
      console.log(`[TaskQueue] Cleaned up ${removed} old tasks`);
      await this.persist();
    }

    return removed;
  }
}

export { TaskQueue };
