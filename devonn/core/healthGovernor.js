/**
 * Health Governor - Monitors system health and adjusts behavior
 * Pauses execution under stress, prevents cascade failures
 */

import { EventEmitter } from 'events';
import os from 'os';

class HealthGovernor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      checkInterval: config.checkInterval || 5000,
      cpuThreshold: config.cpuThreshold || 85,
      memoryThreshold: config.memoryThreshold || 85,
      queueThreshold: config.queueThreshold || 100,
      failureRateThreshold: config.failureRateThreshold || 0.3,
      ...config
    };
    
    this.metrics = {
      cpu: [],
      memory: [],
      apiFailures: [],
      taskFailures: [],
      queueDepth: 0
    };
    
    this.healthStatus = {
      status: 'healthy', // healthy | warning | critical
      score: 100,
      lastCheck: null,
      factors: []
    };
    
    this.running = false;
    this.checkTimer = null;
  }

  /**
   * Start health monitoring
   */
  async start() {
    if (this.running) return;
    
    console.log('[HealthGovernor] Starting health monitoring...');
    this.running = true;
    
    // Initial check
    await this.checkHealth();
    
    // Start periodic checks
    this.checkTimer = setInterval(() => this.checkHealth(), this.config.checkInterval);
    
    this.emit('started');
  }

  /**
   * Stop health monitoring
   */
  async stop() {
    console.log('[HealthGovernor] Stopping health monitoring...');
    this.running = false;
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    this.emit('stopped');
  }

  /**
   * Perform health check
   */
  async checkHealth() {
    const factors = [];
    let score = 100;

    // Check CPU usage
    const cpuUsage = await this.getCPUUsage();
    this.metrics.cpu.push({ timestamp: Date.now(), value: cpuUsage });
    this.trimMetrics(this.metrics.cpu);

    if (cpuUsage > this.config.cpuThreshold) {
      factors.push({
        type: 'cpu',
        severity: cpuUsage > 95 ? 'critical' : 'warning',
        value: cpuUsage,
        message: `High CPU usage: ${cpuUsage.toFixed(1)}%`
      });
      score -= cpuUsage > 95 ? 30 : 15;
    }

    // Check memory usage
    const memoryUsage = this.getMemoryUsage();
    this.metrics.memory.push({ timestamp: Date.now(), value: memoryUsage });
    this.trimMetrics(this.metrics.memory);

    if (memoryUsage > this.config.memoryThreshold) {
      factors.push({
        type: 'memory',
        severity: memoryUsage > 95 ? 'critical' : 'warning',
        value: memoryUsage,
        message: `High memory usage: ${memoryUsage.toFixed(1)}%`
      });
      score -= memoryUsage > 95 ? 30 : 15;
    }

    // Check failure rates
    const failureRate = this.getFailureRate();
    if (failureRate > this.config.failureRateThreshold) {
      factors.push({
        type: 'failures',
        severity: failureRate > 0.5 ? 'critical' : 'warning',
        value: failureRate,
        message: `High failure rate: ${(failureRate * 100).toFixed(1)}%`
      });
      score -= failureRate > 0.5 ? 25 : 10;
    }

    // Check queue depth
    if (this.metrics.queueDepth > this.config.queueThreshold) {
      factors.push({
        type: 'queue',
        severity: this.metrics.queueDepth > this.config.queueThreshold * 2 ? 'critical' : 'warning',
        value: this.metrics.queueDepth,
        message: `Large queue backlog: ${this.metrics.queueDepth} tasks`
      });
      score -= 10;
    }

    // Determine status
    let status = 'healthy';
    const hasCritical = factors.some(f => f.severity === 'critical');
    const hasWarning = factors.some(f => f.severity === 'warning');

    if (hasCritical) {
      status = 'critical';
    } else if (hasWarning) {
      status = 'warning';
    }

    score = Math.max(0, score);

    // Update health status
    const previousStatus = this.healthStatus.status;
    this.healthStatus = {
      status,
      score,
      lastCheck: new Date().toISOString(),
      factors
    };

    // Emit events on status change
    if (status !== previousStatus) {
      console.log(`[HealthGovernor] Health status changed: ${previousStatus} → ${status}`);
      this.emit('status:change', status, this.healthStatus);
      
      if (status === 'critical') {
        this.emit('system:critical', this.healthStatus);
      } else if (status === 'warning') {
        this.emit('system:warning', this.healthStatus);
      }
    }

    return this.healthStatus;
  }

  /**
   * Get current CPU usage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to milliseconds
        const percentage = (totalUsage / 100) * 100; // Estimate percentage
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsage() {
    const used = process.memoryUsage();
    const total = os.totalmem();
    return (used.heapUsed / total) * 100;
  }

  /**
   * Record API failure
   */
  recordAPIFailure(service, error) {
    this.metrics.apiFailures.push({
      timestamp: Date.now(),
      service,
      error: error.message
    });
    this.trimMetrics(this.metrics.apiFailures);
  }

  /**
   * Record task failure
   */
  recordTaskFailure(taskId, error) {
    this.metrics.taskFailures.push({
      timestamp: Date.now(),
      taskId,
      error: error.message
    });
    this.trimMetrics(this.metrics.taskFailures);
  }

  /**
   * Update queue depth
   */
  updateQueueDepth(depth) {
    this.metrics.queueDepth = depth;
  }

  /**
   * Get failure rate over last hour
   */
  getFailureRate() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentFailures = this.metrics.taskFailures.filter(
      f => f.timestamp > oneHourAgo
    );
    
    // Estimate based on recent activity (simplified)
    const totalTasks = Math.max(recentFailures.length * 3, 10); // Assume 1/3 failure rate max
    return recentFailures.length / totalTasks;
  }

  /**
   * Trim metrics arrays to prevent unbounded growth
   */
  trimMetrics(array, maxLength = 100) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // Remove old entries
    while (array.length > 0 && array[0].timestamp < oneHourAgo) {
      array.shift();
    }
    
    // Remove excess entries
    while (array.length > maxLength) {
      array.shift();
    }
  }

  /**
   * Get current health status
   */
  getHealth() {
    return this.healthStatus;
  }

  /**
   * Check if system can accept more work
   */
  canAcceptWork() {
    return this.healthStatus.status !== 'critical';
  }

  /**
   * Get resource recommendations
   */
  getRecommendations() {
    const recs = [];

    if (this.healthStatus.status === 'critical') {
      recs.push('PAUSE_NON_CRITICAL: Pause all non-critical tasks');
      recs.push('REDUCE_CONCURRENCY: Reduce concurrent task limit');
    }

    if (this.healthStatus.factors.some(f => f.type === 'cpu')) {
      recs.push('CPU_HIGH: Consider spreading load or upgrading compute');
    }

    if (this.healthStatus.factors.some(f => f.type === 'memory')) {
      recs.push('MEMORY_HIGH: Consider task queuing or memory optimization');
    }

    if (this.healthStatus.factors.some(f => f.type === 'failures')) {
      recs.push('FAILURES_HIGH: Review recent errors and adjust retry logic');
    }

    return recs;
  }
}

export { HealthGovernor };
