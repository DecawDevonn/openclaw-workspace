/**
 * schedulerInsights.js
 * Intelligence Layer — Learns from execution patterns, optimizes scheduling
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class SchedulerInsights extends EventEmitter {
  constructor(options = {}) {
    super();
    this.persistencePath = options.persistencePath || './data/schedulerInsights.json';
    this.enablePersistence = options.enablePersistence !== false;
    
    this.taskHistory = [];
    this.agentPerformance = new Map();
    this.executionPatterns = new Map();
    this.optimalTiming = new Map();
    
    this.maxHistorySize = 1000;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.enablePersistence) {
      await this.loadFromDisk();
    }
    this.isInitialized = true;
    console.log('[SchedulerInsights] Intelligence layer initialized');
    this.emit('initialized');
  }

  async recordSuccess(task) {
    const record = {
      taskId: task.id,
      type: task.type,
      agentType: task.agentType,
      executionTime: task.executionTime,
      priority: task.priority,
      retries: task.retries,
      timestamp: new Date().toISOString(),
      success: true
    };
    
    this.taskHistory.push(record);
    this.trimHistory();
    
    this.updateAgentPerformance(task.agentType, true, task.executionTime);
    this.updateExecutionPattern(task.type, true, task.executionTime);
    
    await this.persist();
    this.emit('recorded', record);
  }

  async recordFailure(task, error) {
    const record = {
      taskId: task.id,
      type: task.type,
      agentType: task.agentType,
      executionTime: task.executionTime,
      priority: task.priority,
      retries: task.retries,
      error: error.message,
      timestamp: new Date().toISOString(),
      success: false
    };
    
    this.taskHistory.push(record);
    this.trimHistory();
    
    this.updateAgentPerformance(task.agentType, false, task.executionTime);
    this.updateExecutionPattern(task.type, false, task.executionTime);
    
    await this.persist();
    this.emit('recorded', record);
  }

  updateAgentPerformance(agentType, success, executionTime) {
    const perf = this.agentPerformance.get(agentType) || {
      totalRuns: 0,
      successes: 0,
      failures: 0,
      totalExecutionTime: 0,
      avgExecutionTime: 0,
      lastRun: null
    };
    
    perf.totalRuns++;
    if (success) {
      perf.successes++;
    } else {
      perf.failures++;
    }
    
    perf.totalExecutionTime += executionTime;
    perf.avgExecutionTime = perf.totalExecutionTime / perf.totalRuns;
    perf.lastRun = new Date().toISOString();
    
    this.agentPerformance.set(agentType, perf);
  }

  updateExecutionPattern(taskType, success, executionTime) {
    const pattern = this.executionPatterns.get(taskType) || {
      totalRuns: 0,
      successes: 0,
      failures: 0,
      avgExecutionTime: 0,
      bestExecutionTime: Infinity,
      worstExecutionTime: 0
    };
    
    pattern.totalRuns++;
    if (success) {
      pattern.successes++;
    } else {
      pattern.failures++;
    }
    
    const currentAvg = pattern.avgExecutionTime;
    pattern.avgExecutionTime = currentAvg + (executionTime - currentAvg) / pattern.totalRuns;
    pattern.bestExecutionTime = Math.min(pattern.bestExecutionTime, executionTime);
    pattern.worstExecutionTime = Math.max(pattern.worstExecutionTime, executionTime);
    
    this.executionPatterns.set(taskType, pattern);
  }

  trimHistory() {
    if (this.taskHistory.length > this.maxHistorySize) {
      this.taskHistory = this.taskHistory.slice(-this.maxHistorySize);
    }
  }

  getTaskSuccessRate(taskType, window = 100) {
    const recent = this.taskHistory
      .filter(r => r.type === taskType)
      .slice(-window);
    
    if (recent.length === 0) return 1.0;
    
    const successes = recent.filter(r => r.success).length;
    return successes / recent.length;
  }

  getAgentPerformance(agentType) {
    return this.agentPerformance.get(agentType) || null;
  }

  getAllAgentPerformance() {
    return Array.from(this.agentPerformance.entries()).map(([type, perf]) => ({
      agentType: type,
      ...perf,
      successRate: perf.totalRuns > 0 ? perf.successes / perf.totalRuns : 0
    }));
  }

  getExecutionPattern(taskType) {
    return this.executionPatterns.get(taskType) || null;
  }

  getOptimalTiming(taskType) {
    const taskExecutions = this.taskHistory.filter(r => r.type === taskType && r.success);
    
    if (taskExecutions.length < 10) return null;
    
    const hourlyDistribution = {};
    for (const exec of taskExecutions) {
      const hour = new Date(exec.timestamp).getHours();
      if (!hourlyDistribution[hour]) {
        hourlyDistribution[hour] = { count: 0, totalTime: 0 };
      }
      hourlyDistribution[hour].count++;
      hourlyDistribution[hour].totalTime += exec.executionTime;
    }
    
    let bestHour = null;
    let bestAvgTime = Infinity;
    
    for (const [hour, data] of Object.entries(hourlyDistribution)) {
      if (data.count >= 3) {
        const avgTime = data.totalTime / data.count;
        if (avgTime < bestAvgTime) {
          bestAvgTime = avgTime;
          bestHour = parseInt(hour);
        }
      }
    }
    
    return bestHour !== null ? { hour: bestHour, avgExecutionTime: bestAvgTime } : null;
  }

  getBottlenecks() {
    return this.getAllAgentPerformance()
      .filter(p => p.successRate < 0.8 || p.avgExecutionTime > 30000)
      .sort((a, b) => a.successRate - b.successRate);
  }

  getCompletedCount() {
    const today = new Date().toDateString();
    return this.taskHistory.filter(r => 
      r.success && new Date(r.timestamp).toDateString() === today
    ).length;
  }

  getFailedCount() {
    const today = new Date().toDateString();
    return this.taskHistory.filter(r => 
      !r.success && new Date(r.timestamp).toDateString() === today
    ).length;
  }

  async generateOptimizationReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTasks: this.taskHistory.length,
        completedToday: this.getCompletedCount(),
        failedToday: this.getFailedCount()
      },
      agentPerformance: this.getAllAgentPerformance(),
      executionPatterns: Array.from(this.executionPatterns.entries()).map(([type, pattern]) => ({
        taskType: type,
        ...pattern,
        successRate: pattern.totalRuns > 0 ? pattern.successes / pattern.totalRuns : 0
      })),
      bottlenecks: this.getBottlenecks(),
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recs = [];
    
    const bottlenecks = this.getBottlenecks();
    if (bottlenecks.length > 0) {
      recs.push(`Slow/failing agents detected: ${bottlenecks.map(b => b.agentType).join(', ')}`);
    }
    
    for (const [taskType, pattern] of this.executionPatterns) {
      if (pattern.failures / pattern.totalRuns > 0.3) {
        recs.push(`High failure rate for ${taskType} tasks (${(pattern.failures / pattern.totalRuns * 100).toFixed(1)}%)`);
      }
    }
    
    const slowAgents = this.getAllAgentPerformance()
      .filter(a => a.avgExecutionTime > 60000);
    
    if (slowAgents.length > 0) {
      recs.push(`Consider optimizing slow agents: ${slowAgents.map(a => a.agentType).join(', ')}`);
    }
    
    return recs;
  }

  async persist() {
    if (!this.enablePersistence) return;
    
    try {
      const data = JSON.stringify({
        taskHistory: this.taskHistory,
        agentPerformance: Array.from(this.agentPerformance.entries()),
        executionPatterns: Array.from(this.executionPatterns.entries()),
        lastUpdated: new Date().toISOString()
      }, null, 2);
      
      await fs.mkdir(path.dirname(this.persistencePath), { recursive: true });
      await fs.writeFile(this.persistencePath, data, 'utf8');
    } catch (error) {
      console.error('[SchedulerInsights] Persistence failed:', error.message);
    }
  }

  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const parsed = JSON.parse(data);
      
      this.taskHistory = parsed.taskHistory || [];
      this.agentPerformance = new Map(parsed.agentPerformance || []);
      this.executionPatterns = new Map(parsed.executionPatterns || []);
      
      console.log(`[SchedulerInsights] Loaded ${this.taskHistory.length} historical records`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[SchedulerInsights] Load failed:', error.message);
      }
    }
  }

  async loadPatterns() {
    return this.executionPatterns;
  }
}

export default SchedulerInsights;
