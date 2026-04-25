/**
 * selfHealing.js — Self-Healing Engine
 * 
 * Detects failed tasks, analyzes failure types, and auto-retries
 * with modified parameters or escalates after repeated failures.
 */

class SelfHealingEngine {
  constructor(schedulerBrain) {
    this.brain = schedulerBrain;
    this.failurePatterns = new Map();
    this.config = {
      maxRetries: 5,
      baseRetryDelay: 1000,
      maxRetryDelay: 300000, // 5 minutes max
      escalationThreshold: 3, // Escalate after 3 retries
      patternMemorySize: 100
    };
  }
  
  /**
   * Handle a task failure
   */
  async handleFailure(task, error) {
    const errorType = this._classifyError(error);
    const pattern = this._recordFailurePattern(task, errorType);
    
    console.log(`[SELF_HEALING] Task ${task.id} failed with ${errorType}: ${error.message}`);
    
    // Check if we should retry
    if (task.retries < task.maxRetries) {
      const shouldRetry = this._shouldRetry(task, errorType, pattern);
      
      if (shouldRetry) {
        await this._retryTask(task, errorType);
      } else {
        // Move to dead letter if we shouldn't retry
        await this._escalate(task, error, 'retry_not_recommended');
      }
    } else {
      // Max retries exceeded
      await this._escalate(task, error, 'max_retries_exceeded');
    }
  }
  
  /**
   * Classify error type
   */
  _classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'TIMEOUT';
    }
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return 'RATE_LIMIT';
    }
    if (message.includes('network') || message.includes('enotfound') || message.includes('econnrefused')) {
      return 'NETWORK';
    }
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('403')) {
      return 'AUTH';
    }
    if (message.includes('memory') || message.includes('heap') || message.includes('allocation')) {
      return 'RESOURCE';
    }
    if (message.includes('parse') || message.includes('syntax') || message.includes('unexpected token')) {
      return 'PARSE';
    }
    
    return 'UNKNOWN';
  }
  
  /**
   * Record failure pattern for learning
   */
  _recordFailurePattern(task, errorType) {
    const key = `${task.type}:${errorType}`;
    const now = Date.now();
    
    if (!this.failurePatterns.has(key)) {
      this.failurePatterns.set(key, {
        type: task.type,
        errorType,
        count: 0,
        firstSeen: now,
        lastSeen: now,
        retrySuccessRate: 0
      });
    }
    
    const pattern = this.failurePatterns.get(key);
    pattern.count++;
    pattern.lastSeen = now;
    
    // Keep pattern memory size in check
    if (this.failurePatterns.size > this.config.patternMemorySize) {
      // Remove oldest pattern
      let oldest = null;
      for (const [k, v] of this.failurePatterns) {
        if (!oldest || v.lastSeen < oldest.lastSeen) {
          oldest = { key: k, lastSeen: v.lastSeen };
        }
      }
      if (oldest) {
        this.failurePatterns.delete(oldest.key);
      }
    }
    
    return pattern;
  }
  
  /**
   * Decide whether to retry based on error type and history
   */
  _shouldRetry(task, errorType, pattern) {
    // Never retry certain error types
    const noRetryErrors = ['AUTH', 'PARSE'];
    if (noRetryErrors.includes(errorType)) {
      return false;
    }
    
    // Check if we've seen this pattern fail repeatedly
    if (pattern && pattern.count > 10) {
      const failureRate = this._calculateFailureRate(pattern);
      if (failureRate > 0.9) {
        console.log(`[SELF_HEALING] Pattern ${pattern.type}:${errorType} has 90%+ failure rate, skipping retry`);
        return false;
      }
    }
    
    return true;
  }
  
  _calculateFailureRate(pattern) {
    // Simplified - in production you'd track actual success/failure
    const recentWindow = 10;
    return Math.min(1, pattern.count / (pattern.count + recentWindow));
  }
  
  /**
   * Retry a task with adaptive parameters
   */
  async _retryTask(task, errorType) {
    task.retries++;
    
    // Calculate adaptive retry delay based on error type
    let retryDelay = task.retryDelay * 2; // Exponential backoff
    
    switch (errorType) {
      case 'RATE_LIMIT':
        retryDelay = Math.max(retryDelay, 60000); // At least 1 minute
        break;
      case 'TIMEOUT':
        retryDelay = Math.min(retryDelay, 30000); // Max 30 seconds
        break;
      case 'NETWORK':
        retryDelay = Math.min(retryDelay, 10000); // Max 10 seconds
        break;
    }
    
    task.retryDelay = Math.min(retryDelay, this.config.maxRetryDelay);
    
    // Increase priority on retry (more retries = higher priority to finish it)
    task.priority = Math.min(10, task.priority + 1);
    
    // Update payload with retry context
    task.payload._retryContext = {
      attempt: task.retries,
      previousError: errorType,
      nextRetryAt: Date.now() + task.retryDelay
    };
    
    task.status = 'pending';
    await this.brain.taskQueue.update(task);
    
    // Schedule the retry
    setTimeout(() => {
      this.brain.emit('task:retried', task);
    }, task.retryDelay);
    
    console.log(`[SELF_HEALING] Task ${task.id} scheduled for retry #${task.retries} in ${Math.round(task.retryDelay/1000)}s (priority: ${task.priority})`);
    
    return task;
  }
  
  /**
   * Escalate a task that can't be healed
   */
  async _escalate(task, error, reason) {
    console.log(`[SELF_HEALING] Task ${task.id} escalated: ${reason}`);
    
    // Add escalation metadata
    task.escalation = {
      reason,
      error: error.message,
      escalatedAt: Date.now(),
      attempts: task.retries
    };
    
    // Move to dead letter queue
    await this.brain.moveToDeadLetter(task, reason);
    
    // Emit escalation event
    this.brain.emit('task:escalated', task, { error, reason });
  }
  
  /**
   * Get healing statistics
   */
  getStats() {
    return {
      patternsTracked: this.failurePatterns.size,
      patterns: Array.from(this.failurePatterns.entries()).map(([key, pattern]) => ({
        key,
        count: pattern.count,
        lastSeen: pattern.lastSeen
      }))
    };
  }
}

export { SelfHealingEngine };
export default SelfHealingEngine;
