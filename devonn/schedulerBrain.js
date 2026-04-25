/**
 * schedulerBrain.js
 * Central Brain — Task routing, priority assignment, execution decisions
 * The decision core of the autonomous execution system
 */

import { EventEmitter } from 'events';
import { TaskQueue } from '../queue/taskQueue.js';
import { HealthGovernor } from './healthGovernor.js';
import { SelfHealingEngine } from '../agents/selfHealing.js';
import { SchedulerInsights } from '../analytics/schedulerInsights.js';

export class SchedulerBrain extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      defaultPriority: config.defaultPriority || 5,
      executionIntervalMs: config.executionIntervalMs || 2000,
      enableLearning: config.enableLearning !== false,
      ...config
    };

    this.taskQueue = new TaskQueue();
    this.healthGovernor = new HealthGovernor();
    selfHealingEngine = new SelfHealingEngine();
    this.insights = new SchedulerInsights();
    
    this.runningTasks = new Map();
    this.isRunning = false;
    this.loopInterval = null;
    
    this.priorityWeights = {
      critical: 10,
      high: 7,
      normal: 5,
      low: 3,
      background: 1
    };
  }

  async initialize() {
    console.log('[SchedulerBrain] Initializing autonomous task scheduler...');
    
    await this.taskQueue.initialize();
    await this.healthGovernor.initialize();
    await this.selfHealingEngine.initialize();
    
    if (this.config.enableLearning) {
      await this.insights.initialize();
      await this.loadLearnedPatterns();
    }
    
    this.emit('initialized');
    console.log('[SchedulerBrain] Brain online. Ready for task ingestion.');
  }

  submitTask(taskData) {
    const task = this.normalizeTask(taskData);
    
    task.priority = this.calculateDynamicPriority(task);
    task.submittedAt = new Date().toISOString();
    task.status = 'pending';
    
    this.taskQueue.enqueue(task);
    this.emit('taskSubmitted', task);
    
    console.log(`[SchedulerBrain] Task ${task.id} submitted | Priority: ${task.priority} | Type: ${task.type}`);
    
    return task.id;
  }

  normalizeTask(rawTask) {
    return {
      id: rawTask.id || this.generateTaskId(),
      type: rawTask.type || 'generic',
      priority: rawTask.priority || this.config.defaultPriority,
      status: 'pending',
      retries: 0,
      maxRetries: rawTask.maxRetries || 3,
      retryDelay: rawTask.retryDelay || 1000,
      dependencies: rawTask.dependencies || [],
      payload: rawTask.payload || {},
      agentType: rawTask.agentType || this.determineAgentType(rawTask),
      submittedAt: null,
      startedAt: null,
      completedAt: null,
      lastError: null,
      executionTime: 0,
      ...rawTask
    };
  }

  determineAgentType(task) {
    const typeMap = {
      'web_scrape': 'web',
      'api_call': 'web',
      'shell_command': 'terminal',
      'git_operation': 'terminal',
      'system_check': 'system',
      'health_monitor': 'system',
      'llm_analysis': 'intelligence',
      'content_generation': 'intelligence',
      'workflow': 'orchestrator',
      'multi_step': 'orchestrator'
    };
    
    return typeMap[task.type] || 'terminal';
  }

  calculateDynamicPriority(task) {
    let basePriority = task.priority || this.config.defaultPriority;
    
    if (task.urgency === 'critical') basePriority = 10;
    else if (task.urgency === 'high') basePriority = 7;
    else if (task.urgency === 'low') basePriority = 2;
    
    basePriority += task.retries * 2;
    
    if (task.dependencies.length > 0) {
      basePriority -= 1;
    }
    
    if (this.config.enableLearning) {
      const historicalSuccess = this.insights.getTaskSuccessRate(task.type);
      if (historicalSuccess < 0.5) {
        basePriority -= 1;
      }
    }
    
    return Math.max(1, Math.min(10, basePriority));
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[SchedulerBrain] Event loop starting...');
    
    this.loopInterval = setInterval(() => {
      this.processTick();
    }, this.config.executionIntervalMs);
    
    this.emit('started');
  }

  stop() {
    this.isRunning = false;
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    console.log('[SchedulerBrain] Event loop stopped.');
    this.emit('stopped');
  }

  async processTick() {
    if (!this.isRunning) return;
    
    const systemHealth = this.healthGovernor.getHealthStatus();
    
    if (systemHealth.status === 'critical') {
      console.log('[SchedulerBrain] System critical. Pausing execution.');
      return;
    }
    
    if (systemHealth.status === 'warning') {
      const criticalTasks = this.taskQueue.peekByPriority(10);
      if (criticalTasks.length === 0) {
        console.log('[SchedulerBrain] System under stress. Processing critical tasks only.');
        return;
      }
    }
    
    const availableSlots = this.config.maxConcurrentTasks - this.runningTasks.size;
    if (availableSlots <= 0) return;
    
    const readyTasks = this.getReadyTasks(availableSlots);
    
    for (const task of readyTasks) {
      this.executeTask(task);
    }
  }

  getReadyTasks(limit) {
    const candidates = this.taskQueue.peekAll()
      .filter(t => t.status === 'pending')
      .filter(t => this.areDependenciesResolved(t))
      .sort((a, b) => b.priority - a.priority);
    
    return candidates.slice(0, limit);
  }

  areDependenciesResolved(task) {
    if (!task.dependencies || task.dependencies.length === 0) return true;
    
    return task.dependencies.every(depId => {
      const depTask = this.taskQueue.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  async executeTask(task) {
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    this.runningTasks.set(task.id, task);
    this.taskQueue.update(task);
    
    this.emit('taskStarted', task);
    console.log(`[SchedulerBrain] Executing task ${task.id} | Agent: ${task.agentType}`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.runAgentForTask(task);
      
      task.executionTime = Date.now() - startTime;
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
      
      this.runningTasks.delete(task.id);
      this.taskQueue.update(task);
      
      if (this.config.enableLearning) {
        await this.insights.recordSuccess(task);
      }
      
      this.emit('taskCompleted', task);
      console.log(`[SchedulerBrain] Task ${task.id} completed in ${task.executionTime}ms`);
      
    } catch (error) {
      task.executionTime = Date.now() - startTime;
      task.lastError = error.message;
      task.status = 'failed';
      this.runningTasks.delete(task.id);
      
      console.error(`[SchedulerBrain] Task ${task.id} failed: ${error.message}`);
      
      await this.selfHealingEngine.handleFailure(task, this);
      
      this.taskQueue.update(task);
      this.emit('taskFailed', task, error);
    }
  }

  async runAgentForTask(task) {
    const agentImpl = await this.loadAgent(task.agentType);
    return agentImpl.execute(task.payload);
  }

  async loadAgent(agentType) {
    const agentMap = {
      'web': './agents/webAgent.js',
      'terminal': './agents/terminalAgent.js',
      'system': './agents/systemAgent.js',
      'intelligence': './agents/intelligenceAgent.js',
      'orchestrator': './agents/orchestratorAgent.js'
    };
    
    const agentPath = agentMap[agentType] || agentMap['terminal'];
    const { createAgent } = await import(agentPath);
    return createAgent();
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async loadLearnedPatterns() {
    const patterns = await this.insights.loadPatterns();
    console.log(`[SchedulerBrain] Loaded ${patterns.length} learned patterns`);
  }

  getMetrics() {
    return {
      queueDepth: this.taskQueue.size(),
      runningCount: this.runningTasks.size,
      systemHealth: this.healthGovernor.getHealthStatus(),
      completedToday: this.insights.getCompletedCount(),
      failedToday: this.insights.getFailedCount()
    };
  }

  pause() {
    this.isRunning = false;
    console.log('[SchedulerBrain] Execution paused');
  }

  resume() {
    this.isRunning = true;
    console.log('[SchedulerBrain] Execution resumed');
  }
}

export default SchedulerBrain;
