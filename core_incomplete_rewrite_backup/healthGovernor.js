/**
 * healthGovernor.js
 * System Health Monitor — Monitors resources, API health, queue status
 * Decides when to pause, slow, or resume execution
 */

import { EventEmitter } from 'events';
import os from 'os';

export class HealthGovernor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      cpuWarningThreshold: config.cpuWarningThreshold || 75,
      cpuCriticalThreshold: config.cpuCriticalThreshold || 90,
      memoryWarningThreshold: config.memoryWarningThreshold || 80,
      memoryCriticalThreshold: config.memoryCriticalThreshold || 92,
      queueWarningThreshold: config.queueWarningThreshold || 100,
      queueCriticalThreshold: config.queueCriticalThreshold || 500,
      checkIntervalMs: config.checkIntervalMs || 5000,
      failureRateThreshold: config.failureRateThreshold || 0.3,
      ...config
    };
    
    this.healthStatus = {
      status: 'healthy',
      cpu: 0,
      memory: 0,
      queueDepth: 0,
      recentFailures: 0,
      recentSuccesses: 0,
      lastCheck: null,
      recommendations: []
    };
    
    this.metricsHistory = [];
    this.maxHistoryLength = 100;
    this.checkInterval = null;
    this.isInitialized = false;
  }

  async initialize() {
    console.log('[HealthGovernor] Initializing health monitoring...');
    this.isInitialized = true;
    this.emit('initialized');
  }

  start() {
    if (this.checkInterval) return;
    
    console.log('[HealthGovernor] Starting health checks...');
    
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkIntervalMs);
    
    this.performHealthCheck();
    this.emit('started');
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[HealthGovernor] Health checks stopped');
    this.emit('stopped');
  }

  performHealthCheck() {
    const cpuLoad = this.getCPULoad();
    const memoryUsage = this.getMemoryUsage();
    
    const previousStatus = this.healthStatus.status;
    let newStatus = 'healthy';
    let recommendations = [];
    
    if (cpuLoad > this.config.cpuCriticalThreshold ||
        memoryUsage > this.config.memoryCriticalThreshold) {
      newStatus = 'critical';
      recommendations.push('Pause non-critical tasks immediately');
      recommendations.push('Reduce concurrent execution');
    } else if (cpuLoad > this.config.cpuWarningThreshold ||
               memoryUsage > this.config.memoryWarningThreshold) {
      newStatus = 'warning';
      recommendations.push('Slow down task ingestion');
      recommendations.push('Prioritize critical tasks only');
    }
    
    const failureRate = this.calculateFailureRate();
    if (failureRate > this.config.failureRateThreshold) {
      newStatus = newStatus === 'healthy' ? 'warning' : 'critical';
      recommendations.push(`High failure rate detected (${(failureRate * 100).toFixed(1)}%)`);
      recommendations.push('Review recent task failures');
    }
    
    this.healthStatus = {
      status: newStatus,
      cpu: cpuLoad,
      memory: memoryUsage,
      queueDepth: this.healthStatus.queueDepth,
      recentFailures: this.healthStatus.recentFailures,
      recentSuccesses: this.healthStatus.recentSuccesses,
      failureRate: failureRate,
      lastCheck: new Date().toISOString(),
      recommendations
    };
    
    this.metricsHistory.push({
      timestamp: this.healthStatus.lastCheck,
      cpu: cpuLoad,
      memory: memoryUsage,
      status: newStatus
    });
    
    if (this.metricsHistory.length > this.maxHistoryLength) {
      this.metricsHistory.shift();
    }
    
    if (newStatus !== previousStatus) {
      console.log(`[HealthGovernor] Status changed: ${previousStatus} → ${newStatus}`);
      this.emit('statusChange', { from: previousStatus, to: newStatus });
    }
    
    if (newStatus !== 'healthy') {
      console.log(`[HealthGovernor] ${newStatus.toUpperCase()}: CPU ${cpuLoad.toFixed(1)}% | MEM ${memoryUsage.toFixed(1)}%`);
      recommendations.forEach(r => console.log(`  → ${r}`));
    }
    
    this.emit('healthCheck', this.healthStatus);
  }

  getCPULoad() {
    const cpus = os.cpus();
    let totalLoad = 0;
    
    for (const cpu of cpus) {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      totalLoad += ((total - idle) / total) * 100;
    }
    
    return totalLoad / cpus.length;
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return ((total - free) / total) * 100;
  }

  calculateFailureRate() {
    const total = this.healthStatus.recentFailures + this.healthStatus.recentSuccesses;
    if (total === 0) return 0;
    return this.healthStatus.recentFailures / total;
  }

  updateQueueDepth(depth) {
    this.healthStatus.queueDepth = depth;
    
    if (depth > this.config.queueCriticalThreshold) {
      this.healthStatus.status = 'critical';
      this.healthStatus.recommendations.push('Critical: Queue backlog detected');
    } else if (depth > this.config.queueWarningThreshold) {
      if (this.healthStatus.status === 'healthy') {
        this.healthStatus.status = 'warning';
      }
    }
  }

  recordTaskResult(success) {
    if (success) {
      this.healthStatus.recentSuccesses++;
    } else {
      this.healthStatus.recentFailures++;
    }
    
    const windowSize = 50;
    const total = this.healthStatus.recentFailures + this.healthStatus.recentSuccesses;
    if (total > windowSize) {
      const ratio = windowSize / total;
      this.healthStatus.recentFailures *= ratio;
      this.healthStatus.recentSuccesses *= ratio;
    }
  }

  getHealthStatus() {
    return { ...this.healthStatus };
  }

  getMetricsHistory() {
    return [...this.metricsHistory];
  }

  shouldExecuteTask(priority = 5) {
    if (this.healthStatus.status === 'critical') {
      return priority >= 10;
    }
    if (this.healthStatus.status === 'warning') {
      return priority >= 7;
    }
    return true;
  }

  getResourceSummary() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 ** 3) * 100) / 100 + ' GB',
      uptime: Math.round(os.uptime() / 3600) + ' hours',
      loadAvg: os.loadavg()
    };
  }
}

export default HealthGovernor;
