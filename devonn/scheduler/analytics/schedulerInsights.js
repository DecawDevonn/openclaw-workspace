/**
 * Scheduler Insights - Intelligence Layer
 * 
 * Tracks execution patterns, identifies bottlenecks,
 * and feeds insights back into the scheduler for optimization.
 */

import { schedulerBrain } from "../core/schedulerBrain.js";
import { deadLetterQueue } from "../queue/deadLetterQueue.js";

class SchedulerInsights {
  constructor() {
    this.insights = {
      slowTasks: [],
      failingTasks: [],
      optimalTiming: {},
      bottlenecks: [],
      recommendations: []
    };
    this.initialized = false;
  }

  async initialize() {
    console.log("📊 Scheduler Insights initializing...");
    this.initialized = true;
    
    // Start periodic analysis
    setInterval(() => this.analyze(), 60000); // Every minute
    
    console.log("   Intelligence layer active");
  }

  /**
   * Analyze system performance and generate insights
   */
  analyze() {
    const tasks = Array.from(schedulerBrain.tasks.values());
    
    this.identifySlowTasks(tasks);
    this.identifyFailingTasks(tasks);
    this.identifyBottlenecks(tasks);
    this.generateRecommendations();

    if (this.insights.recommendations.length > 0) {
      console.log("💡 Insights generated:");
      this.insights.recommendations.forEach(r => console.log(`   → ${r}`));
    }
  }

  /**
   * Identify consistently slow tasks
   */
  identifySlowTasks(tasks) {
    const slowThreshold = schedulerBrain.metrics.avgProcessingTime * 2;
    
    this.insights.slowTasks = tasks
      .filter(t => t.status === 'completed')
      .filter(t => {
        const avgDuration = t.executionHistory.reduce((sum, h) => sum + (h.duration || 0), 0) / t.executionHistory.length;
        return avgDuration > slowThreshold;
      })
      .map(t => ({
        id: t.id,
        type: t.type,
        avgDuration: t.executionHistory.reduce((sum, h) => sum + (h.duration || 0), 0) / t.executionHistory.length
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);
  }

  /**
   * Identify tasks with high failure rates
   */
  identifyFailingTasks(tasks) {
    this.insights.failingTasks = tasks
      .filter(t => t.executionHistory.length > 0)
      .map(t => {
        const failures = t.executionHistory.filter(h => h.error).length;
        const rate = failures / t.executionHistory.length;
        return { id: t.id, type: t.type, failureRate: rate, totalRuns: t.executionHistory.length };
      })
      .filter(t => t.failureRate > 0.3)
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 5);
  }

  /**
   * Identify system bottlenecks
   */
  identifyBottlenecks(tasks) {
    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const runningCount = tasks.filter(t => t.status === 'running').length;
    
    this.insights.bottlenecks = [];
    
    if (pendingCount > 50) {
      this.insights.bottlenecks.push({
        type: 'queue_backlog',
        severity: pendingCount > 100 ? 'high' : 'medium',
        message: `${pendingCount} tasks pending in queue`
      });
    }
    
    if (runningCount > 10) {
      this.insights.bottlenecks.push({
        type: 'high_concurrency',
        severity: 'medium',
        message: `${runningCount} tasks running concurrently`
      });
    }
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations() {
    this.insights.recommendations = [];
    
    // Recommendations based on slow tasks
    if (this.insights.slowTasks.length > 0) {
      this.insights.recommendations.push(
        `Consider optimizing ${this.insights.slowTasks.length} slow task types`
      );
    }
    
    // Recommendations based on failures
    if (this.insights.failingTasks.length > 0) {
      this.insights.recommendations.push(
        `Review ${this.insights.failingTasks.length} tasks with high failure rates`
      );
    }
    
    // Recommendations based on bottlenecks
    this.insights.bottlenecks.forEach(b => {
      if (b.type === 'queue_backlog') {
        this.insights.recommendations.push('Consider increasing worker threads or throttling task creation');
      }
    });
    
    // Check DLQ
    const dlqStats = deadLetterQueue.getStats();
    if (dlqStats.total > 10) {
      this.insights.recommendations.push(`${dlqStats.total} tasks in dead letter queue need attention`);
    }
  }

  /**
   * Get current insights
   */
  getInsights() {
    return {
      ...this.insights,
      systemMetrics: { ...schedulerBrain.metrics },
      dlqStats: deadLetterQueue.getStats(),
      timestamp: new Date().toISOString()
    };
  }
}

export const schedulerInsights = new SchedulerInsights();
