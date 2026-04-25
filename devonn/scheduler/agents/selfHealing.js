/**
 * Self-Healing Engine - Failure Recovery System
 * 
 * Detects failed tasks, analyzes failures, and retries intelligently.
 * Escalates persistent failures to dead letter queue.
 */

import { schedulerBrain } from "../core/schedulerBrain.js";
import { taskQueue } from "../queue/taskQueue.js";
import { deadLetterQueue } from "../queue/deadLetterQueue.js";

const RETRY_CONFIG = {
  baseDelay: 1000,
  maxDelay: 300000, // 5 minutes
  backoffMultiplier: 2,
  jitter: 0.1
};

class SelfHealingEngine {
  constructor() {
    this.running = false;
    this.checkInterval = null;
  }

  async start() {
    if (this.running) return;
    
    console.log("🔄 Self-Healing Engine starting...");
    this.running = true;
    
    // Check for failed tasks every 5 seconds
    this.checkInterval = setInterval(() => this.heal(), 5000);
    
    console.log("   Monitoring for failures (5s interval)");
  }

  stop() {
    this.running = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("🛑 Self-Healing Engine stopped");
  }

  /**
   * Main healing loop - check for failed tasks and retry
   */
  async heal() {
    const failedTasks = this.getFailedTasks();
    
    for (const task of failedTasks) {
      await this.attemptHeal(task);
    }
  }

  /**
   * Get all failed tasks
   */
  getFailedTasks() {
    return Array.from(schedulerBrain.tasks.values())
      .filter(t => t.status === 'failed');
  }

  /**
   * Attempt to heal a failed task
   */
  async attemptHeal(task) {
    console.log(`🩹 Healing task: ${task.id} (retry ${task.retries + 1}/${task.maxRetries})`);

    if (task.retries >= task.maxRetries) {
      await this.escalate(task);
      return;
    }

    // Analyze failure and adjust strategy
    const strategy = this.determineStrategy(task);
    
    // Increment retry count
    task.retries++;
    task.priority = Math.min(task.priority + 1, 10); // Boost priority
    
    // Calculate retry delay with exponential backoff
    const delay = this.calculateRetryDelay(task.retries);
    
    // Reset status for retry
    task.status = 'pending';
    task.nextRun = Date.now() + delay;
    
    // Apply strategy adjustments
    if (strategy.adjustPayload) {
      task.payload = { ...task.payload, ...strategy.adjustments };
    }

    console.log(`   → Retrying in ${delay}ms with priority ${task.priority}`);
    
    schedulerBrain.metrics.tasksRetried++;
  }

  /**
   * Determine healing strategy based on failure patterns
   */
  determineStrategy(task) {
    const lastError = task.executionHistory[task.executionHistory.length - 1]?.error || '';
    
    // Timeout errors - increase timeout
    if (lastError.includes('timeout') || lastError.includes('ETIMEDOUT')) {
      return {
        adjustPayload: true,
        adjustments: { timeout: (task.payload.timeout || 30000) * 1.5 }
      };
    }
    
    // Rate limit errors - add delay
    if (lastError.includes('rate limit') || lastError.includes('429')) {
      return {
        adjustPayload: true,
        adjustments: { respectRateLimit: true }
      };
    }
    
    // Connection errors - retry with same params
    if (lastError.includes('ECONNREFUSED') || lastError.includes('ENOTFOUND')) {
      return {
        adjustPayload: false,
        adjustments: {}
      };
    }
    
    // Default: retry with same params
    return {
      adjustPayload: false,
      adjustments: {}
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount) {
    const exponentialDelay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount - 1);
    const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * RETRY_CONFIG.jitter * (Math.random() * 2 - 1);
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Escalate permanently failed task to dead letter queue
   */
  async escalate(task) {
    console.log(`🚨 Task ${task.id} exceeded max retries, escalating to DLQ`);
    
    await deadLetterQueue.add({
      ...task,
      escalatedAt: Date.now(),
      failureReason: task.executionHistory[task.executionHistory.length - 1]?.error || 'Unknown',
      retryHistory: task.executionHistory
    });
    
    // Remove from active tasks
    schedulerBrain.tasks.delete(task.id);
  }
}

export const selfHealingEngine = new SelfHealingEngine();
