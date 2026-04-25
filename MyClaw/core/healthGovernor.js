/**
 * healthGovernor.js — System Health Governor
 * 
 * Monitors system health and adapts scheduler behavior accordingly.
 * Implements rules for throttling, pausing, and recovering.
 */

import { getEventLoop } from './eventLoop.js';

class HealthGovernor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.metrics = {
      cpuHistory: [],
      memoryHistory: [],
      failureHistory: [],
      lastCheck: null
    };
    
    this.config = {
      checkIntervalMs: 5000,      // Check every 5 seconds
      cpuWarningThreshold: 85,    // CPU % for warning
      cpuCriticalThreshold: 90, // CPU % for critical
      memWarningThreshold: 85,    // Memory % for warning
      memCriticalThreshold: 90,   // Memory % for critical
      failureRateWarning: 0.1,    // 10% failure rate
      failureRateCritical: 0.2,   // 20% failure rate
      backlogWarning: 100,        // 100 tasks in queue
      backlogCritical: 500        // 500 tasks in queue
    };
    
    this.status = 'healthy'; // healthy | warning | critical
  }
  
  async start() {
    if (this.isRunning) {
      console.log('[HEALTH_GOVERNOR] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[HEALTH_GOVERNOR] Started');
    console.log(`[HEALTH_GOVERNOR] Check interval: ${this.config.checkIntervalMs}ms`);
    
    // Initial check
    await this.check();
    
    // Start periodic checks
    this.checkInterval = setInterval(async () => {
      await this.check();
    }, this.config.checkIntervalMs);
  }
  
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    console.log('[HEALTH_GOVERNOR] Stopped');
  }
  
  async check() {
    try {
      const health = await this.gatherMetrics();
      const newStatus = this.determineStatus(health);
      
      if (newStatus !== this.status) {
        const oldStatus = this.status;
        this.status = newStatus;
        await this.handleStatusChange(oldStatus, newStatus, health);
      }
      
      // Update event loop with health data
      const eventLoop = getEventLoop();
      if (eventLoop && eventLoop.brain) {
        eventLoop.brain.updateHealth(health);
      }
      
      this.metrics.lastCheck = Date.now();
      
    } catch (error) {
      console.error('[HEALTH_GOVERNOR] Check error:', error.message);
    }
  }
  
  async gatherMetrics() {
    // Get memory usage
    const memUsage = process.memoryUsage();
    const memoryPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    // Get CPU usage (simplified - would need more complex implementation for real CPU %)
    const cpuPercent = this._estimateCpuUsage();
    
    // Get queue depth from event loop
    let queueDepth = 0;
    let failureRate = 0;
    const eventLoop = getEventLoop();
    if (eventLoop && eventLoop.brain) {
      const metrics = eventLoop.brain.getMetrics();
      queueDepth = metrics.pendingTasks || 0;
      const total = metrics.tasksCompleted + metrics.tasksFailed;
      failureRate = total > 0 ? metrics.tasksFailed / total : 0;
    }
    
    // Update history
    this.metrics.cpuHistory.push(cpuPercent);
    this.metrics.memoryHistory.push(memoryPercent);
    this.metrics.failureHistory.push(failureRate);
    
    // Keep only last 60 entries (5 minutes at 5s interval)
    if (this.metrics.cpuHistory.length > 60) {
      this.metrics.cpuHistory.shift();
      this.metrics.memoryHistory.shift();
      this.metrics.failureHistory.shift();
    }
    
    return {
      cpu: cpuPercent,
      memory: memoryPercent,
      queueDepth,
      failureRate,
      apiFailures: this.metrics.failureHistory.filter(f => f > 0).length,
      agentCrashRate: failureRate,
      timestamp: Date.now()
    };
  }
  
  _estimateCpuUsage() {
    // Simplified CPU estimation
    // In production, you'd use os.loadavg() or a proper CPU monitoring library
    const loadAvg = require('os').loadavg();
    const avgLoad = loadAvg[0]; // 1-minute load average
    const cpuCount = require('os').cpus().length;
    return Math.min(100, Math.round((avgLoad / cpuCount) * 100));
  }
  
  determineStatus(health) {
    const cpu = health.cpu;
    const mem = health.memory;
    const failures = health.failureRate;
    const backlog = health.queueDepth;
    
    // Critical conditions
    if (cpu >= this.config.cpuCriticalThreshold ||
        mem >= this.config.memCriticalThreshold ||
        failures >= this.config.failureRateCritical ||
        backlog >= this.config.backlogCritical) {
      return 'critical';
    }
    
    // Warning conditions
    if (cpu >= this.config.cpuWarningThreshold ||
        mem >= this.config.memWarningThreshold ||
        failures >= this.config.failureRateWarning ||
        backlog >= this.config.backlogWarning) {
      return 'warning';
    }
    
    return 'healthy';
  }
  
  async handleStatusChange(oldStatus, newStatus, health) {
    console.log(`[HEALTH_GOVERNOR] Status change: ${oldStatus} → ${newStatus}`);
    
    const eventLoop = getEventLoop();
    
    switch (newStatus) {
      case 'critical':
        console.log('[HEALTH_GOVERNOR] CRITICAL: Pausing non-critical tasks');
        if (eventLoop && eventLoop.brain) {
          eventLoop.brain._adaptToHealthStatus('critical');
        }
        break;
        
      case 'warning':
        console.log('[HEALTH_GOVERNOR] WARNING: Reducing task concurrency');
        if (eventLoop && eventLoop.brain) {
          eventLoop.brain._adaptToHealthStatus('warning');
        }
        break;
        
      case 'healthy':
        console.log('[HEALTH_GOVERNOR] System healthy - resuming normal operations');
        if (eventLoop && eventLoop.brain) {
          eventLoop.brain._adaptToHealthStatus('healthy');
        }
        break;
    }
    
    this.emit('status:changed', { oldStatus, newStatus, health });
  }
  
  getStatus() {
    return {
      status: this.status,
      isRunning: this.isRunning,
      lastCheck: this.metrics.lastCheck,
      config: this.config
    };
  }
}

// Singleton
let governorInstance = null;

export function getHealthGovernor() {
  if (!governorInstance) {
    governorInstance = new HealthGovernor();
  }
  return governorInstance;
}

export { HealthGovernor };
export default HealthGovernor;
