/**
 * selfHealing.js
 * Self-Healing Engine — Detects failures, auto-retries, escalates persistent issues
 */

import { EventEmitter } from 'events';
import { DeadLetterQueue } from '../queue/deadLetterQueue.js';

export class SelfHealingEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxRetries: config.maxRetries || 5,
      baseRetryDelayMs: config.baseRetryDelayMs || 1000,
      maxRetryDelayMs: config.maxRetryDelayMs || 60000,
      backoffMultiplier: config.backoffMultiplier || 2,
      enableAutoRetry: config.enableAutoRetry !== false,
      enableFailureAnalysis: config.enableFailureAnalysis !== false,
      ...config
    };
    
    this.dlq = new DeadLetterQueue();
    this.retryQueue = new Map();
    this.failurePatterns = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    await this.dlq.initialize();
    this.isInitialized = true;
    console.log('[SelfHealing] Engine initialized');
    this.emit('initialized');
  }

  async handleFailure(task, scheduler) {
    console.log(`[SelfHealing] Processing failure for task ${task.id}`);
    
    const errorAnalysis = this.analyzeError(task.lastError);
    
    if (this.config.enableFailureAnalysis) {
      this.recordFailurePattern(task.type, errorAnalysis);
    }
    
    if (task.retries < task.maxRetries) {
      if (this.config.enableAutoRetry) {
        await this.scheduleRetry(task, scheduler, errorAnalysis);
      } else {
        console.log(`[SelfHealing] Auto-retry disabled. Task ${task.id} marked for manual review.`);
      }
    } else {
      await this.escalateToDLQ(task, errorAnalysis);
    }
  }

  analyzeError(errorMessage) {
    const patterns = [
      { type: 'timeout', regex: /timeout|timed out|ETIMEDOUT/i, recoverable: true },
      { type: 'network', regex: /ECONNREFUSED|ENOTFOUND|network|connection/i, recoverable: true },
      { type: 'rate_limit', regex: /rate limit|429|too many requests/i, recoverable: true, delayMultiplier: 5 },
      { type: 'auth', regex: /unauthorized|401|forbidden|403|auth/i, recoverable: false },
      { type: 'not_found', regex: /not found|404|ENOENT/i, recoverable: false },
      { type: 'validation', regex: /validation|invalid|bad request|400/i, recoverable: false },
      { type: 'server_error', regex: /500|502|503|504|server error/i, recoverable: true },
      { type: 'memory', regex: /out of memory|heap|ENOSPC/i, recoverable: true },
      { type: 'syntax', regex: /syntax|parse|unexpected token/i, recoverable: false }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(errorMessage)) {
        return {
          errorType: pattern.type,
          recoverable: pattern.recoverable,
          delayMultiplier: pattern.delayMultiplier || 1,
          suggestion: this.getSuggestionForError(pattern.type)
        };
      }
    }
    
    return {
      errorType: 'unknown',
      recoverable: true,
      delayMultiplier: 1,
      suggestion: 'Review error details and retry with caution'
    };
  }

  getSuggestionForError(errorType) {
    const suggestions = {
      timeout: 'Increase timeout threshold or break task into smaller chunks',
      network: 'Check network connectivity and retry',
      rate_limit: 'Implement exponential backoff for API calls',
      auth: 'Verify credentials and permissions',
      not_found: 'Verify resource exists and path is correct',
      validation: 'Review input parameters and constraints',
      server_error: 'External service issue, retry with backoff',
      memory: 'Optimize memory usage or increase resources',
      syntax: 'Fix code syntax or configuration'
    };
    
    return suggestions[errorType] || 'Review and retry';
  }

  async scheduleRetry(task, scheduler, errorAnalysis) {
    task.retries++;
    task.status = 'pending';
    
    const baseDelay = task.retryDelay || this.config.baseRetryDelayMs;
    const delay = Math.min(
      baseDelay * Math.pow(this.config.backoffMultiplier, task.retries - 1) * errorAnalysis.delayMultiplier,
      this.config.maxRetryDelayMs
    );
    
    console.log(`[SelfHealing] Scheduling retry ${task.retries}/${task.maxRetries} for task ${task.id} in ${delay}ms`);
    
    task.priority += 1;
    
    setTimeout(() => {
      console.log(`[SelfHealing] Executing retry for task ${task.id}`);
      task.status = 'pending';
      task.lastRetryAt = new Date().toISOString();
      scheduler.taskQueue.update(task);
    }, delay);
    
    this.emit('retryScheduled', { taskId: task.id, attempt: task.retries, delay });
  }

  async escalateToDLQ(task, errorAnalysis) {
    console.log(`[SelfHealing] Max retries exceeded for task ${task.id}. Moving to DLQ.`);
    
    const dlqEntry = {
      ...task,
      dlqAt: new Date().toISOString(),
      failureAnalysis: errorAnalysis,
      retryHistory: this.getRetryHistory(task.id),
      suggestedAction: errorAnalysis.recoverable ? 'manual_retry_possible' : 'requires_fix'
    };
    
    await this.dlq.add(dlqEntry);
    this.emit('escalated', dlqEntry);
  }

  recordFailurePattern(taskType, errorAnalysis) {
    const key = `${taskType}:${errorAnalysis.errorType}`;
    const existing = this.failurePatterns.get(key) || { count: 0, lastSeen: null };
    
    existing.count++;
    existing.lastSeen = new Date().toISOString();
    existing.recoverable = errorAnalysis.recoverable;
    
    this.failurePatterns.set(key, existing);
    
    if (existing.count >= 5) {
      console.warn(`[SelfHealing] Pattern detected: ${key} has failed ${existing.count} times`);
      this.emit('patternDetected', { pattern: key, count: existing.count, recoverable: errorAnalysis.recoverable });
    }
  }

  getRetryHistory(taskId) {
    return this.retryQueue.get(taskId) || [];
  }

  getFailurePatterns() {
    return Array.from(this.failurePatterns.entries()).map(([key, data]) => ({
      pattern: key,
      ...data
    }));
  }

  async retryFromDLQ(taskId, scheduler) {
    const task = await this.dlq.retrieve(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in DLQ`);
    }
    
    task.status = 'pending';
    task.retries = 0;
    task.lastError = null;
    task.resurrectedAt = new Date().toISOString();
    
    await this.dlq.remove(taskId);
    scheduler.submitTask(task);
    
    this.emit('resurrected', task);
    console.log(`[SelfHealing] Task ${taskId} resurrected from DLQ`);
    
    return task;
  }

  getStats() {
    return {
      failurePatterns: this.failurePatterns.size,
      dlqSize: this.dlq.size(),
      config: this.config
    };
  }
}

export default SelfHealingEngine;
