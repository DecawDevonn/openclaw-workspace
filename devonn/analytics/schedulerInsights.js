/**
 * DEVONN.ai - Scheduler Insights
 * 
 * Analytics and learning layer for continuous optimization.
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class SchedulerInsights extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      dataPath: config.dataPath || './data/insights.json',
      maxHistorySize: config.maxHistorySize || 10000,
      ...config
    };
    
    this.metrics = {
      tasksByType: new Map(),
      agentPerformance: new Map(),
      hourlyStats: new Map(),
      failurePatterns: new Map(),
      timingOptimizations: new Map()
    };
    
    this.executionHistory = [];
  }

  async init() {
    console.log('[SchedulerInsights] Initializing...');
    
    // Ensure data directory exists
    const dir = path.dirname(this.config.dataPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      // Directory may already exist
    }
    
    // Load persisted insights
    await this.load();
    
    console.log('[SchedulerInsights] Ready');
  }

  /**
   * Record successful task execution
   */
  recordSuccess(task) {
    const record = {
      taskId: task.id,
      type: task.type,
      agentType: task.agentType,
      duration: task.duration,
      priority: task.priority,
      timestamp: Date.now(),
      success: true
    };
    
    this.executionHistory.push(record);
    this.updateMetrics(record);
    this.trimHistory();
  }

  /**
   * Record failed task execution
   */
  recordFailure(task, error) {
    const record = {
      taskId: task.id,
      type: task.type,
      agentType: task.agentType,
      duration: task.duration,
      priority: task.priority,
      error: error.message,
      errorType: this.classifyError(error),
      timestamp: Date.now(),
      success: false
    };
    
    this.executionHistory.push(record);
    this.updateMetrics(record);
    this.trimHistory();
  }

  /**
   * Update metrics based on execution record
   */
  updateMetrics(record) {
    // Task type metrics
    const typeStats = this.metrics.tasksByType.get(record.type) || {
      count: 0,
      successes: 0,
      failures: 0,
      totalDuration: 0,
      avgDuration: 0
    };
    
    typeStats.count++;
    typeStats.totalDuration += record.duration || 0;
    typeStats.avgDuration = typeStats.totalDuration / typeStats.count;
    
    if (record.success) {
      typeStats.successes++;
    } else {
      typeStats.failures++;
    }
    
    this.metrics.tasksByType.set(record.type, typeStats);
    
    // Agent performance metrics
    if (record.agentType) {
      const agentStats = this.metrics.agentPerformance.get(record.agentType) || {
        count: 0,
        successes: 0,
        failures: 0,
        totalDuration: 0,
        avgDuration: 0
      };
      
      agentStats.count++;
      agentStats.totalDuration += record.duration || 0;
      agentStats.avgDuration = agentStats.totalDuration / agentStats.count;
      
      if (record.success) {
        agentStats.successes++;
      } else {
        agentStats.failures++;
      }
      
      this.metrics.agentPerformance.set(record.agentType, agentStats);
    }
    
    // Hourly stats
    const hour = new Date(record.timestamp).getHours();
    const hourStats = this.metrics.hourlyStats.get(hour) || {
      count: 0,
      successes: 0,
      failures: 0
    };
    
    hourStats.count++;
    if (record.success) {
      hourStats.successes++;
    } else {
      hourStats.failures++;
    }
    
    this.metrics.hourlyStats.set(hour, hourStats);
    
    // Failure patterns
    if (!record.success && record.errorType) {
      const pattern = this.metrics.failurePatterns.get(record.errorType) || {
        count: 0,
        tasks: new Set()
      };
      
      pattern.count++;
      pattern.tasks.add(record.type);
      this.metrics.failurePatterns.set(record.errorType, pattern);
    }
  }

  /**
   * Classify error type
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('auth')) return 'auth';
    if (message.includes('memory')) return 'resource';
    
    return 'unknown';
  }

  /**
   * Trim execution history to max size
   */
  trimHistory() {
    if (this.executionHistory.length > this.config.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations() {
    const recommendations = [];
    
    // Check for slow task types
    for (const [type, stats] of this.metrics.tasksByType) {
      if (stats.avgDuration > 60000) {
        recommendations.push({
          type: 'performance',
          target: type,
          issue: 'slow_execution',
          suggestion: `Task type '${type}' averages ${Math.round(stats.avgDuration / 1000)}s. Consider optimization or timeout adjustment.`,
          priority: stats.count > 10 ? 'high' : 'medium'
        });
      }
      
      // Check for high failure rates
      const failureRate = stats.failures / stats.count;
      if (stats.count > 5 && failureRate > 0.2) {
        recommendations.push({
          type: 'reliability',
          target: type,
          issue: 'high_failure_rate',
          suggestion: `Task type '${type}' has ${Math.round(failureRate * 100)}% failure rate. Review error patterns.`,
          priority: failureRate > 0.5 ? 'critical' : 'high'
        });
      }
    }
    
    // Check for agent performance issues
    for (const [agentType, stats] of this.metrics.agentPerformance) {
      const failureRate = stats.failures / stats.count;
      if (stats.count > 10 && failureRate > 0.15) {
        recommendations.push({
          type: 'agent_health',
          target: agentType,
          issue: 'agent_underperforming',
          suggestion: `Agent '${agentType}' has elevated failure rate. Consider health check.`,
          priority: 'medium'
        });
      }
    }
    
    // Check for peak hours
    let maxHour = null;
    let maxCount = 0;
    for (const [hour, stats] of this.metrics.hourlyStats) {
      if (stats.count > maxCount) {
        maxCount = stats.count;
        maxHour = hour;
      }
    }
    
    if (maxHour !== null) {
      recommendations.push({
        type: 'scheduling',
        target: 'system',
        issue: 'peak_hour_detected',
        suggestion: `Peak activity at ${maxHour}:00. Consider pre-scaling resources.`,
        priority: 'low'
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get optimal execution time for task type
   */
  getOptimalTiming(taskType) {
    // Find hour with lowest failure rate for this task type
    const hourStats = [];
    
    for (const record of this.executionHistory) {
      if (record.type === taskType) {
        const hour = new Date(record.timestamp).getHours();
        if (!hourStats[hour]) {
          hourStats[hour] = { count: 0, successes: 0 };
        }
        hourStats[hour].count++;
        if (record.success) {
          hourStats[hour].successes++;
        }
      }
    }
    
    let bestHour = null;
    let bestRate = -1;
    
    for (let hour = 0; hour < 24; hour++) {
      const stats = hourStats[hour];
      if (stats && stats.count >= 3) {
        const successRate = stats.successes / stats.count;
        if (successRate > bestRate) {
          bestRate = successRate;
          bestHour = hour;
        }
      }
    }
    
    return {
      bestHour,
      successRate: bestRate,
      recommendation: bestHour !== null ? `Schedule ${taskType} tasks around ${bestHour}:00 for optimal success rate` : null
    };
  }

  /**
   * Persist insights to disk
   */
  async save() {
    try {
      const data = {
        metrics: {
          tasksByType: Array.from(this.metrics.tasksByType.entries()),
          agentPerformance: Array.from(this.metrics.agentPerformance.entries()),
          hourlyStats: Array.from(this.metrics.hourlyStats.entries()),
          failurePatterns: Array.from(this.metrics.failurePatterns.entries())
        },
        executionHistory: this.executionHistory.slice(-1000),
        timestamp: Date.now()
      };
      await fs.writeFile(this.config.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SchedulerInsights] Save error:', error);
    }
  }

  /**
   * Load insights from disk
   */
  async load() {
    try {
      const data = await fs.readFile(this.config.dataPath, 'utf8');
      const parsed = JSON.parse(data);
      
      if (parsed.metrics) {
        this.metrics.tasksByType = new Map(parsed.metrics.tasksByType || []);
        this.metrics.agentPerformance = new Map(parsed.metrics.agentPerformance || []);
        this.metrics.hourlyStats = new Map(parsed.metrics.hourlyStats || []);
        this.metrics.failurePatterns = new Map(parsed.metrics.failurePatterns || []);
      }
      
      if (parsed.executionHistory) {
        this.executionHistory = parsed.executionHistory;
      }
      
      console.log('[SchedulerInsights] Loaded persisted data');
    } catch (error) {
      // File may not exist yet
      console.log('[SchedulerInsights] No persisted data found');
    }
  }

  /**
   * Analyze task history and generate insights
   * Called periodically by SchedulerBrain
   */
  async analyze(taskHistory) {
    if (taskHistory.length === 0) return;
    
    console.log(`[SchedulerInsights] Analyzing ${taskHistory.length} task records...`);
    
    // Process any unrecorded tasks from history
    for (const task of taskHistory) {
      const exists = this.executionHistory.some(r => r.taskId === task.id);
      if (!exists) {
        const record = {
          taskId: task.id,
          type: task.type,
          agentType: task.agentType || 'unknown',
          duration: task.duration || 0,
          priority: task.priority,
          timestamp: new Date(task.completedAt || task.metadata?.createdAt).getTime(),
          success: task.status === 'completed'
        };
        this.executionHistory.push(record);
        this.updateMetrics(record);
      }
    }
    
    this.trimHistory();
    
    // Generate and log recommendations
    const recommendations = this.getRecommendations();
    if (recommendations.length > 0) {
      console.log('[SchedulerInsights] Recommendations:');
      recommendations.slice(0, 3).forEach(r => {
        console.log(`  [${r.priority.toUpperCase()}] ${r.suggestion}`);
      });
    }
    
    // Persist insights
    await this.save();
    
    this.emit('analysis_complete', { recommendations, stats: this.getStats() });
  }

  /**
   * Get current statistics
   */
  getStats() {
    const stats = {
      totalExecutions: this.executionHistory.length,
      tasksByType: {},
      agentPerformance: {},
      recommendations: this.getRecommendations()
    };
    
    for (const [type, data] of this.metrics.tasksByType) {
      stats.tasksByType[type] = {
        count: data.count,
        successRate: data.count > 0 ? (data.successes / data.count) : 0,
        avgDuration: data.avgDuration
      };
    }
    
    for (const [agent, data] of this.metrics.agentPerformance) {
      stats.agentPerformance[agent] = {
        count: data.count,
        successRate: data.count > 0 ? (data.successes / data.count) : 0,
        avgDuration: data.avgDuration
      };
    }
    
    return stats;
  }
}

export default SchedulerInsights;