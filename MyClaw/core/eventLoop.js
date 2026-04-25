/**
 * eventLoop.js — The Brain Pulse
 * 
 * Continuously runs the scheduler loop, checking for tasks
 * and executing them based on priority and system health.
 */

import { SchedulerBrain } from './schedulerBrain.js';

class EventLoop {
  constructor() {
    this.brain = new SchedulerBrain();
    this.loopInterval = null;
    this.isRunning = false;
    this.config = {
      tickInterval: 2000, // Check every 2 seconds
      maxTasksPerTick: 5
    };
  }
  
  async start() {
    if (this.isRunning) {
      console.log('[EVENT_LOOP] Already running');
      return;
    }
    
    this.isRunning = true;
    await this.brain.start();
    
    console.log('[EVENT_LOOP] Started');
    console.log(`[EVENT_LOOP] Tick interval: ${this.config.tickInterval}ms`);
    
    // Start the main loop
    this.loopInterval = setInterval(async () => {
      await this.tick();
    }, this.config.tickInterval);
    
    // Initial tick
    await this.tick();
  }
  
  async stop() {
    if (!this.isRunning) {
      console.log('[EVENT_LOOP] Not running');
      return;
    }
    
    this.isRunning = false;
    
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    
    await this.brain.stop();
    console.log('[EVENT_LOOP] Stopped');
  }
  
  async tick() {
    try {
      // Get metrics for logging
      const metrics = this.brain.getMetrics();
      
      // Only log periodically to avoid spam
      if (Math.random() < 0.1) {
        console.log(`[EVENT_LOOP] Health: ${metrics.health.status} | Active: ${metrics.activeTasks} | Pending: ${metrics.pendingTasks} | Completed: ${metrics.tasksCompleted}`);
      }
      
      // Skip if system is critical
      if (metrics.health.status === 'critical') {
        console.log('[EVENT_LOOP] System critical - skipping execution');
        return;
      }
      
      // Get next batch of tasks
      const tasks = await this.brain.getNextTasks(this.config.maxTasksPerTick);
      
      if (tasks.length === 0) {
        return;
      }
      
      console.log(`[EVENT_LOOP] Executing ${tasks.length} task(s)`);
      
      // Execute tasks in parallel
      const executions = tasks.map(async (task) => {
        try {
          const result = await this.brain.executeTask(task);
          return { taskId: task.id, ...result };
        } catch (error) {
          console.error(`[EVENT_LOOP] Task ${task.id} execution error:`, error.message);
          return { taskId: task.id, success: false, error: error.message };
        }
      });
      
      await Promise.allSettled(executions);
      
    } catch (error) {
      console.error('[EVENT_LOOP] Tick error:', error.message);
    }
  }
  
  // Health check and adaptation
  async checkHealth() {
    // Simple health metrics - can be extended
    const usage = process.memoryUsage();
    const health = {
      memory: Math.round((usage.heapUsed / usage.heapTotal) * 100),
      cpu: 0, // Would need more complex check
      queueDepth: (await this.brain.taskQueue.size()),
      timestamp: Date.now()
    };
    
    this.brain.updateHealth(health);
    return health;
  }
}

// Singleton instance
let eventLoopInstance = null;

export function getEventLoop() {
  if (!eventLoopInstance) {
    eventLoopInstance = new EventLoop();
  }
  return eventLoopInstance;
}

export { EventLoop };
export default EventLoop;
