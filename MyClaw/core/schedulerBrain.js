// schedulerBrain.js — Central Intelligence of the Autonomous Scheduler OS
// Makes all scheduling decisions, assigns priorities, manages system state

import { EventEmitter } from 'events';
import { memory_get, memory_search } from '../../memory/integration.js';

class SchedulerBrain extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.agents = new Map();
    this.systemState = {
      status: 'initializing',
      // healthy, degraded, critical, paused
      load: 0,
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      lastDecision: null
    };
    this.priorityWeights = {
      critical: 10,
      high: 7,
      normal: 5,
      low: 3,
      background: 1
    };
  }

  // Core decision engine
  async makeSchedulingDecision() {
    const startTime = Date.now();
    
    // Get all pending tasks sorted by computed priority
    const pendingTasks = this.getPendingTasks();
    const healthStatus = await this.assessSystemHealth();
    
    // Adjust behavior based on system health
    let maxConcurrent = this.calculateConcurrencyLimit(healthStatus);
    let executionPlan = [];
    
    // Apply intelligent filtering
    for (const task of pendingTasks) {
      if (executionPlan.length >= maxConcurrent) break;
      
      // Check if we should run this task now
      if (await this.shouldExecuteNow(task, healthStatus)) {
        executionPlan.push(task);
      }
    }
    
    this.systemState.lastDecision = {
      timestamp: new Date().toISOString(),
      considered: pendingTasks.length,
      selected: executionPlan.length,
      health: healthStatus,
      duration: Date.now() - startTime
    };
    
    this.emit('decision', this.systemState.lastDecision);
    return executionPlan;
  }

  // Compute dynamic priority for a task
  computeTaskPriority(task) {
    let basePriority = this.priorityWeights[task.priority] || 5;
    
    // Age factor — older tasks get boosted
    const age = Date.now() - new Date(task.createdAt).getTime();
    const ageHours = age / (1000 * 60 * 60);
    const ageBoost = Math.min(ageHours * 0.5, 3); // Max +3 priority for old tasks
    
    // Retry factor — failed tasks get adjusted priority
    const retryPenalty = task.retries * 0.5;
    
    // Dependency factor — tasks with unmet dependencies get deprioritized
    const dependencyPenalty = task.dependencies?.length * 2 || 0;
    
    // Historical success rate factor
    const agentSuccessRate = this.getAgentSuccessRate(task.agentType);
    const reliabilityBoost = agentSuccessRate > 0.8 ? 1 : 0;
    
    const finalPriority = basePriority + ageBoost - retryPenalty - dependencyPenalty + reliabilityBoost;
    
    return Math.max(1, Math.min(10, finalPriority));
  }

  // Decide if a task should execute now
  async shouldExecuteNow(task, healthStatus) {
    // Don't run if system is critical (unless task is critical)
    if (healthStatus.status === 'critical' && task.priority !== 'critical') {
      return false;
    }
    
    // Check dependencies
    if (task.dependencies?.length > 0) {
      const depsMet = await this.checkDependencies(task);
      if (!depsMet) return false;
    }
    
    // Check if task has a scheduled time
    if (task.scheduledFor && new Date(task.scheduledFor) > new Date()) {
      return false;
    }
    
    // Check agent availability
    const agentHealthy = await this.checkAgentHealth(task.agentType);
    if (!agentHealthy) return false;
    
    return true;
  }

  // Get all pending tasks sorted by computed priority
  getPendingTasks() {
    const pending = Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .map(t => ({
        ...t,
        computedPriority: this.computeTaskPriority(t)
      }))
      .sort((a, b) => b.computedPriority - a.computedPriority);
    
    return pending;
  }

  // Assess system health across dimensions
  async assessSystemHealth() {
    const metrics = {
      cpu: await this.getCPULoad(),
      memory: await this.getMemoryPressure(),
      apiFailures: this.getRecentFailureRate(),
      queueDepth: this.tasks.size,
      agentCrashes: this.getAgentCrashRate()
    };
    
    // Determine status
    let status = 'healthy';
    let score = 100;
    
    if (metrics.cpu > 85 || metrics.memory > 90) {
      status = 'critical';
      score -= 40;
    } else if (metrics.cpu > 70 || metrics.memory > 75 || metrics.apiFailures > 0.1) {
      status = 'degraded';
      score -= 20;
    }
    
    if (metrics.queueDepth > 100) {
      score -= 15;
    }
    
    if (metrics.agentCrashes > 0.05) {
      score -= 15;
    }
    
    return {
      status,
      score: Math.max(0, score),
      metrics,
      timestamp: new Date().toISOString()
    };
  }

  // Calculate how many tasks can run concurrently
  calculateConcurrencyLimit(healthStatus) {
    const baseLimit = 5;
    
    switch (healthStatus.status) {
      case 'healthy': return baseLimit + 3;
      case 'degraded': return baseLimit;
      case 'critical': return 1;
      case 'paused': return 0;
      default: return baseLimit;
    }
  }

  // Check if all dependencies are satisfied
  async checkDependencies(task) {
    for (const depId of task.dependencies || []) {
      const dep = this.tasks.get(depId);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  // Check if agent type is healthy
  async checkAgentHealth(agentType) {
    const recentFailures = this.getAgentRecentFailures(agentType);
    return recentFailures < 3; // Allow if less than 3 recent failures
  }

  // Get agent's historical success rate
  getAgentSuccessRate(agentType) {
    const agent = this.agents.get(agentType);
    if (!agent) return 0.5;
    
    const total = agent.completed + agent.failed;
    if (total === 0) return 0.5;
    
    return agent.completed / total;
  }

  // Get recent failure rate across all agents
  getRecentFailureRate() {
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    let failures = 0;
    let total = 0;
    
    for (const agent of this.agents.values()) {
      failures += agent.failuresLastHour || 0;
      total += agent.executionsLastHour || 0;
    }
    
    return total > 0 ? failures / total : 0;
  }

  // Get agent crash rate
  getAgentCrashRate() {
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    let crashes = 0;
    
    for (const agent of this.agents.values()) {
      crashes += agent.crashesLastHour || 0;
    }
    
    const totalAgents = this.agents.size || 1;
    return crashes / totalAgents;
  }

  // Get recent failures for specific agent type
  getAgentRecentFailures(agentType) {
    const agent = this.agents.get(agentType);
    return agent?.failuresLastHour || 0;
  }

  // Placeholder: Get CPU load
  async getCPULoad() {
    // In real implementation, use system metrics
    // For now, simulate based on active tasks
    const baseLoad = this.systemState.activeTasks * 10;
    return Math.min(100, baseLoad + Math.random() * 10);
  }

  // Placeholder: Get memory pressure
  async getMemoryPressure() {
    // In real implementation, use system metrics
    return 50 + Math.random() * 20;
  }

  // Task management
  addTask(task) {
    task.id = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    task.status = 'pending';
    task.createdAt = new Date().toISOString();
    task.retries = 0;
    task.maxRetries = task.maxRetries || 3;
    task.computedPriority = this.computeTaskPriority(task);
    
    this.tasks.set(task.id, task);
    this.emit('taskAdded', task);
    
    return task.id;
  }

  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    Object.assign(task, updates);
    task.updatedAt = new Date().toISOString();
    
    this.emit('taskUpdated', task);
    return task;
  }

  removeTask(taskId) {
    const removed = this.tasks.delete(taskId);
    if (removed) {
      this.emit('taskRemoved', { taskId });
    }
    return removed;
  }

  // Set system state
  setSystemState(state) {
    this.systemState = { ...this.systemState, ...state };
    this.emit('stateChange', this.systemState);
  }

  // Get full system status
  getSystemStatus() {
    return {
      state: this.systemState,
      queue: {
        total: this.tasks.size,
        pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
        running: Array.from(this.tasks.values()).filter(t => t.status === 'running').length,
        completed: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
        failed: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length
      },
      agents: Array.from(this.agents.entries()).map(([type, stats]) => ({
        type,
        ...stats
      }))
    };
  }
}

// Singleton instance
let brainInstance = null;

export function getSchedulerBrain() {
  if (!brainInstance) {
    brainInstance = new SchedulerBrain();
  }
  return brainInstance;
}

export { SchedulerBrain };
