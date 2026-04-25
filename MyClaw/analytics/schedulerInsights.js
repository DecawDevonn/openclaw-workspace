/**
 * schedulerInsights.js — Intelligence Layer (Learning System)
 * 
 * Tracks task patterns, failures, execution times, and feeds back
 * into the scheduler to improve performance over time.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

class SchedulerInsights {
  constructor(options = {}) {
    this.dataDir = options.dataDir || join(process.env.HOME || '/tmp', '.myclaw', 'data');
    this.insightsFile = join(this.dataDir, 'insights.json');
    this.events = [];
    this.metrics = {
      taskTypePerformance: new Map(),
      hourlyDistribution: new Array(24).fill(0),
      dailyFailures: new Map(),
      avgExecutionByType: new Map(),
      bottleneckTasks: []
    };
    this.isInitialized = false;
  }
  
  async init() {
    if (this.isInitialized) return;
    
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.load();
      this.isInitialized = true;
      console.log(`[INSIGHTS] Initialized with ${this.events.length} events`);
    } catch (error) {
      console.error('[INSIGHTS] Init error:', error.message);
      this.isInitialized = true;
    }
  }
  
  async load() {
    try {
      const data = await fs.readFile(this.insightsFile, 'utf-8');
      const saved = JSON.parse(data);
      this.events = saved.events || [];
      this.metrics = { ...this.metrics, ...saved.metrics };
    } catch (error) {
      this.events = [];
    }
  }
  
  async save() {
    try {
      const data = {
        events: this.events.slice(-1000), // Keep last 1000 events
        metrics: this.metrics,
        savedAt: Date.now()
      };
      await fs.writeFile(this.insightsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[INSIGHTS] Save error:', error.message);
    }
  }
  
  /**
   * Log an event for learning
   */
  async logEvent(eventType, data) {
    await this.init();
    
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data: this._sanitizeData(data)
    };
    
    this.events.push(event);
    
    // Update metrics based on event type
    this._updateMetrics(eventType, data);
    
    // Periodic save
    if (this.events.length % 100 === 0) {
      await this.save();
    }
  }
  
  /**
   * Sanitize event data for storage
   */
  _sanitizeData(data) {
    // Remove sensitive or large data
    const sanitized = { ...data };
    
    // Remove large payload data
    if (sanitized.payload) {
      const payloadSize = JSON.stringify(sanitized.payload).length;
      if (payloadSize > 10000) {
        sanitized.payload = { _truncated: true, originalSize: payloadSize };
      }
    }
    
    return sanitized;
  }
  
  /**
   * Update metrics based on events
   */
  _updateMetrics(eventType, data) {
    const hour = new Date().getHours();
    
    switch (eventType) {
      case 'task_submitted':
        this.metrics.hourlyDistribution[hour]++;
        break;
        
      case 'task_completed':
        if (data.task && data.task.type) {
          this._recordTypePerformance(data.task.type, 'success', data.task);
        }
        break;
        
      case 'task_failed':
        if (data.task && data.task.type) {
          this._recordTypePerformance(data.task.type, 'failure', data.task);
          this._recordDailyFailure(data.task.type, data.error);
        }
        break;
        
      case 'task_started':
        // Track execution time
        break;
    }
  }
  
  /**
   * Record performance for a task type
   */
  _recordTypePerformance(type, outcome, task) {
    if (!this.metrics.taskTypePerformance.has(type)) {
      this.metrics.taskTypePerformance.set(type, {
        type,
        successes: 0,
        failures: 0,
        totalExecutionTime: 0,
        count: 0
      });
    }
    
    const perf = this.metrics.taskTypePerformance.get(type);
    
    if (outcome === 'success') {
      perf.successes++;
    } else {
      perf.failures++;
    }
    
    if (task.executionHistory && task.executionHistory.length > 0) {
      const lastExec = task.executionHistory[task.executionHistory.length - 1];
      if (lastExec.duration) {
        perf.totalExecutionTime += lastExec.duration;
        perf.count++;
      }
    }
  }
  
  /**
   * Record daily failures
   */
  _recordDailyFailure(type, error) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${today}:${type}`;
    
    if (!this.metrics.dailyFailures.has(key)) {
      this.metrics.dailyFailures.set(key, {
        date: today,
        type,
        count: 0,
        errors: []
      });
    }
    
    const failure = this.metrics.dailyFailures.get(key);
    failure.count++;
    failure.errors.push({
      message: error?.message || 'Unknown error',
      time: Date.now()
    });
    
    // Keep only last 10 error messages
    if (failure.errors.length > 10) {
      failure.errors = failure.errors.slice(-10);
    }
  }
  
  /**
   * Get recommendations based on insights
   */
  getRecommendations() {
    const recommendations = [];
    
    // Analyze failure patterns
    for (const [key, failure] of this.metrics.dailyFailures) {
      if (failure.count > 5) {
        recommendations.push({
          type: 'high_failure_rate',
          taskType: failure.type,
          severity: 'warning',
          message: `Task type "${failure.type}" has ${failure.count} failures on ${failure.date}`,
          suggestion: 'Review error patterns and consider adjusting retry parameters'
        });
      }
    }
    
    // Analyze execution time
    for (const [type, perf] of this.metrics.taskTypePerformance) {
      if (perf.count > 0) {
        const avgTime = perf.totalExecutionTime / perf.count;
        if (avgTime > 30000) { // 30 seconds
          recommendations.push({
            type: 'slow_execution',
            taskType: type,
            severity: 'info',
            message: `Task type "${type}" has average execution time of ${Math.round(avgTime/1000)}s`,
            suggestion: 'Consider optimizing or breaking into smaller tasks'
          });
        }
      }
      
      // Check failure rate
      const total = perf.successes + perf.failures;
      if (total > 10) {
        const failureRate = perf.failures / total;
        if (failureRate > 0.3) { // 30% failure rate
          recommendations.push({
            type: 'high_failure_rate',
            taskType: type,
            severity: 'critical',
            message: `Task type "${type}" has ${Math.round(failureRate * 100)}% failure rate`,
            suggestion: 'Immediate review required - check dependencies and error logs'
          });
        }
      }
    }
    
    // Check hourly distribution for bottlenecks
    const peakHour = this.metrics.hourlyDistribution.indexOf(Math.max(...this.metrics.hourlyDistribution));
    if (this.metrics.hourlyDistribution[peakHour] > 50) {
      recommendations.push({
        type: 'load_imbalance',
        severity: 'warning',
        message: `High task volume at hour ${peakHour}:00 (${this.metrics.hourlyDistribution[peakHour]} tasks)`,
        suggestion: 'Consider spreading tasks across time or adding capacity'
      });
    }
    
    return recommendations.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
  
  /**
   * Get summary statistics
   */
  getSummary() {
    const totalEvents = this.events.length;
    const recentEvents = this.events.filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000).length;
    
    return {
      totalEvents,
      recentEvents,
      trackedTaskTypes: this.metrics.taskTypePerformance.size,
      failurePatterns: this.metrics.dailyFailures.size,
      hourlyPeak: Math.max(...this.metrics.hourlyDistribution),
      recommendations: this.getRecommendations().length
    };
  }
}

// Singleton
let insightsInstance = null;

export function getSchedulerInsights() {
  if (!insightsInstance) {
    insightsInstance = new SchedulerInsights();
  }
  return insightsInstance;
}

export { SchedulerInsights };
export default SchedulerInsights;
