/**
 * deadLetterQueue.js
 * Dead Letter Queue — Stores permanently failed tasks for analysis
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class DeadLetterQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.entries = new Map();
    this.persistencePath = options.persistencePath || './data/dlq.json';
    this.maxEntries = options.maxEntries || 1000;
    this.enablePersistence = options.enablePersistence !== false;
  }

  async initialize() {
    if (this.enablePersistence) {
      await this.loadFromDisk();
    }
    console.log('[DLQ] Initialized');
  }

  async add(entry) {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
      console.log(`[DLQ] Removed oldest entry ${oldestKey} to make room`);
    }
    
    this.entries.set(entry.id, entry);
    await this.persist();
    
    this.emit('entryAdded', entry);
    console.log(`[DLQ] Task ${entry.id} added to dead queue`);
    
    return entry.id;
  }

  retrieve(taskId) {
    return this.entries.get(taskId);
  }

  async remove(taskId) {
    const entry = this.entries.get(taskId);
    if (entry) {
      this.entries.delete(taskId);
      await this.persist();
      this.emit('entryRemoved', entry);
    }
    return entry;
  }

  peekAll() {
    return Array.from(this.entries.values());
  }

  peekByErrorType(errorType) {
    return Array.from(this.entries.values())
      .filter(e => e.failureAnalysis?.errorType === errorType);
  }

  peekByTaskType(taskType) {
    return Array.from(this.entries.values())
      .filter(e => e.type === taskType);
  }

  peekRecoverable() {
    return Array.from(this.entries.values())
      .filter(e => e.failureAnalysis?.recoverable === true);
  }

  size() {
    return this.entries.size;
  }

  async clear() {
    this.entries.clear();
    await this.persist();
    this.emit('cleared');
  }

  getAnalysis() {
    const errorTypes = {};
    const taskTypes = {};
    let recoverableCount = 0;
    
    for (const entry of this.entries.values()) {
      const errorType = entry.failureAnalysis?.errorType || 'unknown';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      
      taskTypes[entry.type] = (taskTypes[entry.type] || 0) + 1;
      
      if (entry.failureAnalysis?.recoverable) {
        recoverableCount++;
      }
    }
    
    return {
      totalFailed: this.entries.size,
      recoverableCount,
      nonRecoverableCount: this.entries.size - recoverableCount,
      errorTypeBreakdown: errorTypes,
      taskTypeBreakdown: taskTypes,
      topErrors: Object.entries(errorTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }

  async persist() {
    if (!this.enablePersistence) return;
    
    try {
      const data = JSON.stringify(
        Array.from(this.entries.entries()),
        null,
        2
      );
      
      await fs.mkdir(path.dirname(this.persistencePath), { recursive: true });
      await fs.writeFile(this.persistencePath, data, 'utf8');
    } catch (error) {
      console.error('[DLQ] Persistence failed:', error.message);
    }
  }

  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const entries = JSON.parse(data);
      this.entries = new Map(entries);
      console.log(`[DLQ] Loaded ${this.entries.size} entries from disk`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[DLQ] Load failed:', error.message);
      }
      this.entries = new Map();
    }
  }

  async generateReport() {
    const analysis = this.getAnalysis();
    const entries = this.peekAll();
    
    return {
      generatedAt: new Date().toISOString(),
      summary: analysis,
      recentFailures: entries
        .sort((a, b) => new Date(b.dlqAt) - new Date(a.dlqAt))
        .slice(0, 10)
        .map(e => ({
          id: e.id,
          type: e.type,
          errorType: e.failureAnalysis?.errorType,
          failedAt: e.dlqAt,
          suggestion: e.failureAnalysis?.suggestion
        })),
      recommendations: this.generateRecommendations(analysis)
    };
  }

  generateRecommendations(analysis) {
    const recs = [];
    
    if (analysis.recoverableCount > analysis.nonRecoverableCount) {
      recs.push('Most failures are recoverable. Review and retry from DLQ.');
    }
    
    const topError = Object.entries(analysis.errorTypeBreakdown)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topError && topError[1] > 5) {
      recs.push(`Frequent '${topError[0]}' errors detected. Consider systemic fix.`);
    }
    
    if (analysis.totalFailed > 50) {
      recs.push('High failure volume. Review system health and task configurations.');
    }
    
    return recs;
  }
}

export default DeadLetterQueue;
