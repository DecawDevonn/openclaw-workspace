/**
 * Self-Healing Engine - Automatic failure detection and recovery
 * Analyzes failure patterns, retries intelligently, escalates when needed
 */

import { EventEmitter } from 'events';

class SelfHealing extends EventEmitter {
  constructor(taskQueue, config = {}) {
    super();
    
    this.taskQueue = taskQueue;
    this.config = {
      maxRetries: config.maxRetries || 5,
      maxRetryDelay: config.maxRetryDelay || 300000, // 5 min
      failureThreshold: config.failureThreshold || 3,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      ...config
    };
    
    // Circuit breaker state
    this.circuitBreakers = new Map(); // taskType -> { failures, lastFailure, open }
    
    // Failure patterns
    this.failurePatterns = new Map();
  }

  /**
   * Process all failed tasks
   */
  async processFailedTasks() {
    const failedTasks = this.taskQueue.query({ status: 'failed' });
    
    for (const task of failedTasks) {
      await this.handleFailure(task, task.error);
    }
  }

  /**
   * Handle a task failure
   */
  async handleFailure(task, error) {
    console.log(`[SelfHealing] Processing failure for task: ${task.id}`);
    
    // Check circuit breaker
    if (this.isCircuitOpen(task.type)) {
      console.log(`[SelfHealing] Circuit open for ${task.type}, skipping retry`);
      await this.moveToDLQ(task, 'Circuit breaker open');
      return;
    }

    // Analyze failure
    const analysis = this.analyzeFailure(task, error);
    
    // Update circuit breaker
    this.updateCircuitBreaker(task.type, analysis);
    
    // Determine recovery strategy
    const strategy = this.determineRecoveryStrategy(task, analysis);
    
    switch (strategy.action) {
      case 'retry_immediate':
        await this.retry(task, { immediate: true });
        break;
      case 'retry_delayed':
        await this.retry(task, { delay: strategy.delay });
        break;
      case 'retry_modified':
        await this.retry(task, { modifications: strategy.modifications });
        break;
      case 'escalate':
        await this.escalate(task, error, analysis);
        break;
      case 'dlq':
        await this.moveToDLQ(task, analysis.reason);
        break;
    }
  }

  /**
   * Analyze failure type and context
   */
  analyzeFailure(task, error) {
    const errorMessage = error?.message || 'Unknown error';
    const errorType = this.classifyError(errorMessage);
    
    const analysis = {
      type: errorType,
      transient: this.isTransient(errorType),
      recoverable: this.isRecoverable(errorType),
      severity: this.calculateSeverity(task, errorType),
      pattern: this.detectPattern(task.type, errorType),
      context: {
        attempts: task.attempts,
        retries: task.retries,
        consecutiveFailures: this.getConsecutiveFailures(task.type)
      }
    };

    console.log(`[SelfHealing] Failure analysis:`, analysis);
    
    return analysis;
  }

  /**
   * Classify error type
   */
  classifyError(message) {
    const patterns = {
      network_error: /timeout|ECONNREFUSED|ENOTFOUND|network|socket/i,
      rate_limit: /rate.?limit|429|too.?many.?requests/i,
      auth_error: /unauthorized|401|403|forbidden|auth/i,
      not_found: /not.?found|404|ENOENT/i,
      validation_error: /invalid|validation|schema|parse/i,
      resource_error: /memory|disk|quota|resource/i,
      api_error: /api|service|server|500|503/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) return type;
    }

    return 'unknown_error';
  }

  /**
   * Check if error is transient (may resolve on retry)
   */
  isTransient(errorType) {
    const transientTypes = [
      'network_error',
      'rate_limit',
      'api_error',
      'resource_error'
    ];
    return transientTypes.includes(errorType);
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(errorType) {
    const unrecoverable = [
      'validation_error',
      'not_found'
    ];
    return !unrecoverable.includes(errorType);
  }

  /**
   * Calculate failure severity
   */
  calculateSeverity(task, errorType) {
    if (task.priority >= 8) return 'critical';
    if (this.isTransient(errorType)) return 'low';
    if (task.retries >= task.maxRetries) return 'high';
    return 'medium';
  }

  /**
   * Detect recurring failure patterns
   */
  detectPattern(taskType, errorType) {
    const key = `${taskType}:${errorType}`;
    const pattern = this.failurePatterns.get(key) || {
      count: 0,
      firstSeen: Date.now(),
      lastSeen: null
    };

    pattern.count++;
    pattern.lastSeen = Date.now();
    
    this.failurePatterns.set(key, pattern);

    return {
      recurring: pattern.count > 3,
      frequency: pattern.count / ((Date.now() - pattern.firstSeen) / 3600000), // per hour
    };
  }

  /**
   * Get consecutive failures for a task type
   */
  getConsecutiveFailures(taskType) {
    const cb = this.circuitBreakers.get(taskType);
    return cb ? cb.failures : 0;
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreaker(taskType, analysis) {
    let cb = this.circuitBreakers.get(taskType);
    
    if (!cb) {
      cb = { failures: 0, lastFailure: null, open: false };
    }

    if (analysis.transient) {
      cb.failures++;
      cb.lastFailure = Date.now();

      // Open circuit after threshold
      if (cb.failures >= this.config.circuitBreakerThreshold) {
        cb.open = true;
        console.warn(`[SelfHealing] Circuit opened for ${taskType}`);
        this.emit('circuit:open', taskType, cb);
      }
    } else {
      // Non-transient errors don't count toward circuit breaker
      cb.failures = Math.max(0, cb.failures - 1);
    }

    this.circuitBreakers.set(taskType, cb);
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(taskType) {
    const cb = this.circuitBreakers.get(taskType);
    if (!cb) return false;

    // Auto-close circuit after 5 minutes
    if (cb.open && Date.now() - cb.lastFailure > 300000) {
      cb.open = false;
      cb.failures = 0;
      console.log(`[SelfHealing] Circuit auto-closed for ${taskType}`);
      this.emit('circuit:close', taskType);
    }

    return cb.open;
  }

  /**
   * Determine recovery strategy
   */
  determineRecoveryStrategy(task, analysis) {
    // Max retries exceeded
    if (task.retries >= this.config.maxRetries) {
      return { action: 'escalate' };
    }

    // Non-recoverable errors
    if (!analysis.recoverable) {
      return { action: 'dlq', reason: 'Non-recoverable error' };
    }

    // Critical priority - retry immediately
    if (task.priority >= 8 && analysis.transient) {
      return { action: 'retry_immediate' };
    }

    // Rate limited - delay with backoff
    if (analysis.type === 'rate_limit') {
      return { 
        action: 'retry_delayed', 
        delay: Math.min(60000 * (task.retries + 1), 600000) // Max 10 min
      };
    }

    // Network errors - retry with modifications
    if (analysis.type === 'network_error') {
      return {
        action: 'retry_modified',
        modifications: {
          timeout: task.payload.timeout * 1.5,
          retries: task.retries + 1
        }
      };
    }

    // Default: exponential backoff
    const delay = Math.min(
      task.retryDelay * Math.pow(2, task.retries),
      this.config.maxRetryDelay
    );

    return { action: 'retry_delayed', delay };
  }

  /**
   * Retry a task
   */
  async retry(task, options = {}) {
    const updates = {
      retries: task.retries + 1,
      error: null
    };

    if (options.immediate) {
      updates.metadata = { ...task.metadata, scheduledAt: null };
    } else if (options.delay) {
      const scheduledAt = new Date(Date.now() + options.delay).toISOString();
      updates.metadata = { ...task.metadata, scheduledAt };
    }

    if (options.modifications) {
      updates.payload = { ...task.payload, ...options.modifications };
    }

    // Increase priority on retry for important tasks
    if (task.priority >= 7) {
      updates.priority = Math.min(10, task.priority + 1);
    }

    this.taskQueue.requeue(task.id, updates);
    
    console.log(`[SelfHealing] Requeued task: ${task.id} (retry ${updates.retries})`);
    this.emit('retry', task, updates);
  }

  /**
   * Escalate failure for manual intervention
   */
  async escalate(task, error, analysis) {
    console.error(`[SelfHealing] ESCALATING task: ${task.id}`);

    const escalation = {
      task,
      error,
      analysis,
      escalatedAt: new Date().toISOString(),
      recommendations: this.generateRecommendations(task, analysis)
    };

    // Persist escalation
    await this.persistEscalation(escalation);

    this.emit('escalate', escalation);

    // Move to DLQ
    await this.moveToDLQ(task, `Escalated after ${task.retries} retries`);
  }

  /**
   * Move task to dead letter queue
   */
  async moveToDLQ(task, reason) {
    await this.taskQueue.moveToDLQ(task.id, reason);
    this.emit('dlq', task, reason);
  }

  /**
   * Generate recommendations for escalation
   */
  generateRecommendations(task, analysis) {
    const recs = [];

    if (analysis.pattern.recurring) {
      recs.push(`Recurring ${analysis.pattern.frequency.toFixed(1)}/hr pattern detected`);
    }

    if (analysis.type === 'auth_error') {
      recs.push('Check authentication credentials and permissions');
    }

    if (analysis.type === 'rate_limit') {
      recs.push('Consider implementing request throttling');
    }

    if (analysis.type === 'resource_error') {
      recs.push('Review resource allocation and quotas');
    }

    recs.push(`Review task payload: ${JSON.stringify(task.payload, null, 2)}`);

    return recs;
  }

  /**
   * Persist escalation record
   */
  async persistEscalation(escalation) {
    // Implementation would persist to file/DB
    // For now, just emit event for monitoring
    this.emit('escalation:persisted', escalation);
  }

  /**
   * Get healing statistics
   */
  getStats() {
    const stats = {
      circuitBreakers: this.circuitBreakers.size,
      patterns: this.failurePatterns.size,
      openCircuits: 0
    };

    for (const cb of this.circuitBreakers.values()) {
      if (cb.open) stats.openCircuits++;
    }

    return stats;
  }

  /**
   * Reset all healing state
   */
  reset() {
    this.circuitBreakers.clear();
    this.failurePatterns.clear();
    console.log('[SelfHealing] All healing state reset');
  }
}

export { SelfHealing };
