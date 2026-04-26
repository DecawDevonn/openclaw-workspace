/**
 * Scheduler Brain - Central orchestration engine for Devonn.ai
 * Replaces static cron with intelligent, adaptive task scheduling
 */

import { EventEmitter } from 'events';
import { TaskQueue } from '../queue/taskQueue.js';
import { HealthGovernor } from './healthGovernor.js';
import { SelfHealing } from '../agents/selfHealing.js';
import { SchedulerInsights } from '../analytics/schedulerInsights.js';

class SchedulerBrain extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      tickInterval: config.tickInterval || 2000,
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      enableLearning: config.enableLearning !== false,
      ...config
    };
    
    // Core components
    this.taskQueue = new TaskQueue();
    this.healthGovernor = new HealthGovernor();
    this.selfHealing = new SelfHealing(this.taskQueue);
    this.insights = new SchedulerInsights();
    
    // State
    this.running = false;
    this.activeTasks = new Map();
    this.taskHistory = [];
    this.tickCount = 0;
    
    // Bind event handlers
    this.on('task:complete', this.handleTaskComplete.bind(this));
    this.on('task:fail', this.handleTaskFail.bind(this));
    this.on('system:stress', this.handleSystemStress.bind(this));
  }

  /**
   * Start the scheduler brain
   */
  async start() {
    if (this.running) return;
    
    console.log('[SchedulerBrain] Starting autonomous scheduler...');
    this.running = true;
    
    // Initialize health monitoring
    await this.healthGovernor.start();
    
    // Load persisted tasks
    await this.taskQueue.load();
    
    // Start main loop
    this.loop();
    
    this.emit('started');
    console.log('[SchedulerBrain] Autonomous scheduler running');
  }

  /**
   * Stop the scheduler gracefully
   */
  async stop() {
    console.log('[SchedulerBrain] Stopping scheduler...');
    this.running = false;
    
    // Wait for active tasks
    await this.drainTasks();
    
    // Persist state
    await this.taskQueue.persist();
    await this.healthGovernor.stop();
    
    this.emit('stopped');
    console.log('[SchedulerBrain] Scheduler stopped');
  }

  /**
   * Main event loop - the brain pulse
   */
  async loop() {
    while (this.running) {
      const startTime = Date.now();
      this.tickCount++;
      
      try {
        await this.tick();
      } catch (error) {
        console.error('[SchedulerBrain] Tick error:', error);
        this.emit('error', error);
      }
      
      // Adaptive tick interval based on system load
      const elapsed = Date.now() - startTime;
      const adjustedInterval = this.calculateTickInterval(elapsed);
      
      await this.sleep(adjustedInterval);
    }
  }

  /**
   * Single tick execution
   */
  async tick() {
    // Check system health
    const health = this.healthGovernor.getHealth();
    
    if (health.status === 'critical') {
      console.log('[SchedulerBrain] System critical - pausing task execution');
      return;
    }
    
    // Get tasks ready for execution
    const availableSlots = this.config.maxConcurrentTasks - this.activeTasks.size;
    if (availableSlots <= 0) return;
    
    const tasks = await this.taskQueue.getRunnableTasks(availableSlots, health);
    
    // Execute tasks
    for (const task of tasks) {
      await this.executeTask(task);
    }
    
    // Heal failed tasks
    await this.selfHealing.processFailedTasks();
    
    // Update insights
    if (this.config.enableLearning && this.tickCount % 10 === 0) {
      await this.insights.analyze(this.taskHistory);
    }
  }

  /**
   * Execute a single task
   */
  async executeTask(task) {
    console.log(`[SchedulerBrain] Executing task: ${task.id} (${task.type})`);
    
    task.status = 'running';
    task.lastRun = new Date().toISOString();
    task.attempts++;
    
    this.activeTasks.set(task.id, task);
    
    const startTime = Date.now();
    
    try {
      const result = await this.runTaskAgent(task);
      
      const duration = Date.now() - startTime;
      
      task.status = 'completed';
      task.duration = duration;
      task.result = result;
      
      this.activeTasks.delete(task.id);
      this.taskHistory.push({ ...task, completedAt: new Date().toISOString() });
      
      this.emit('task:complete', task);
      this.insights.recordSuccess(task, duration);
      
      console.log(`[SchedulerBrain] Task completed: ${task.id} (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      task.status = 'failed';
      task.duration = duration;
      task.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      
      this.activeTasks.delete(task.id);
      
      this.emit('task:fail', task, error);
      this.insights.recordFailure(task, error, duration);
      
      console.error(`[SchedulerBrain] Task failed: ${task.id} - ${error.message}`);
    }
  }

  /**
   * Run the appropriate agent for a task
   */
  async runTaskAgent(task) {
    const agentType = this.determineAgentType(task);
    
    switch (agentType) {
      case 'web':
        return await this.runWebAgent(task);
      case 'terminal':
        return await this.runTerminalAgent(task);
      case 'system':
        return await this.runSystemAgent(task);
      case 'intelligence':
        return await this.runIntelligenceAgent(task);
      case 'orchestrator':
        return await this.runOrchestratorAgent(task);
      case 'github':
        return await this.runGitHubAgent(task);
      case 'deployment':
        return await this.runDeploymentAgent(task);
      case 'security':
        return await this.runSecurityAgent(task);
      case 'repair':
        return await this.runRepairAgent(task);
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  /**
   * Determine which agent type should handle a task
   */
  determineAgentType(task) {
    const typeMap = {
      'web_scrape': 'web',
      'api_call': 'web',
      'browser_automation': 'web',
      'shell_command': 'terminal',
      'git_operation': 'terminal',
      'deploy': 'terminal',
      'github_monitor': 'github',
      'deployment_check': 'deployment',
      'security_scan': 'security',
      'build_failure_repair': 'repair',
      'repo_health_check': 'github',
      'system_check': 'system',
      'health_monitor': 'system',
      'cleanup': 'system',
      'llm_analysis': 'intelligence',
      'content_generation': 'intelligence',
      'workflow': 'orchestrator',
      'multi_step': 'orchestrator'
    };
    
    return typeMap[task.type] || 'terminal';
  }

  /**
   * Agent execution implementations
   */
  async runWebAgent(task) {
    const { browser, web_fetch } = await import('../tools/webTools.js');
    
    switch (task.subtype) {
      case 'scrape':
        return await web_fetch(task.payload.url, task.payload.options);
      case 'browse':
        return await browser.automate(task.payload.actions);
      default:
        return await web_fetch(task.payload.url);
    }
  }

  async runTerminalAgent(task) {
    const { exec } = await import('../tools/systemTools.js');
    return await exec(task.payload.command, task.payload.options);
  }

  async runSystemAgent(task) {
    const { checkDiskSpace, cleanupOldFiles } = await import('../tools/systemTools.js');
    
    switch (task.subtype) {
      case 'disk_check':
        return await checkDiskSpace();
      case 'cleanup':
        return await cleanupOldFiles(task.payload.pattern, task.payload.maxAge);
      default:
        return { status: 'unknown_task' };
    }
  }

  async runIntelligenceAgent(task) {
    const { spawnSubAgent } = await import('../tools/aiTools.js');
    return await spawnSubAgent(task.payload.prompt, task.payload.model);
  }

  async runOrchestratorAgent(task) {
    const results = [];
    
    for (const subTask of task.payload.subtasks) {
      const subTaskObj = await this.taskQueue.add(subTask);
      await this.executeTask(subTaskObj);
      results.push(subTaskObj.result);
    }
    
    return { subtaskResults: results };
  }

  async runGitHubAgent(task) {
    const { executeGitHubMonitor } = await import('../agents/githubMonitor.js');
    return await executeGitHubMonitor(task.payload);
  }

  async runDeploymentAgent(task) {
    const { executeDeploymentCheck } = await import('../agents/deploymentChecker.js');
    return await executeDeploymentCheck(task.payload);
  }

  async runSecurityAgent(task) {
    const { executeSecurityScan } = await import('../agents/securityRouter.js');
    return await executeSecurityScan(task.payload);
  }

  async runRepairAgent(task) {
    const { executeRepairRouter } = await import('../agents/repairRouter.js');
    return await executeRepairRouter(task.payload);
  }

  /**
   * Handle task completion
   */
  handleTaskComplete(task) {
    // Trigger dependent tasks
    this.taskQueue.getDependents(task.id).forEach(dependent => {
      if (this.taskQueue.areDependenciesMet(dependent)) {
        dependent.status = 'pending';
      }
    });
  }

  /**
   * Handle task failure
   */
  handleTaskFail(task, error) {
    // Self-healing will handle retry logic
    this.selfHealing.handleFailure(task, error);
  }

  /**
   * Handle system stress
   */
  handleSystemStress(stressLevel) {
    console.log(`[SchedulerBrain] System stress detected: ${stressLevel}`);
    
    if (stressLevel === 'high') {
      // Reduce concurrent tasks
      this.config.maxConcurrentTasks = Math.max(1, this.config.maxConcurrentTasks - 1);
    }
  }

  /**
   * Add a new task to the system
   */
  async addTask(taskSpec) {
    const task = await this.taskQueue.add(taskSpec);
    this.emit('task:added', task);
    return task;
  }

  /**
   * Calculate adaptive tick interval
   */
  calculateTickInterval(lastTickDuration) {
    const baseInterval = this.config.tickInterval;
    const health = this.healthGovernor.getHealth();
    
    if (health.status === 'warning') {
      return baseInterval * 2;
    }
    
    if (lastTickDuration > baseInterval) {
      return Math.min(baseInterval * 1.5, 10000);
    }
    
    return baseInterval;
  }

  /**
   * Wait for all active tasks to complete
   */
  async drainTasks() {
    console.log('[SchedulerBrain] Draining active tasks...');
    
    while (this.activeTasks.size > 0) {
      console.log(`[SchedulerBrain] Waiting for ${this.activeTasks.size} tasks...`);
      await this.sleep(1000);
    }
  }

  /**
   * Get current system status
   */
  getStatus() {
    return {
      running: this.running,
      tickCount: this.tickCount,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.size(),
      health: this.healthGovernor.getHealth(),
      maxConcurrent: this.config.maxConcurrentTasks
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { SchedulerBrain };
