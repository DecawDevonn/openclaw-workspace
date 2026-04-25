/**
 * eventLoop.js
 * Event Loop — The continuous pulse of the autonomous system
 * Replaces static cron with dynamic, intelligent task execution
 */

import { SchedulerBrain } from './schedulerBrain.js';
import { HealthGovernor } from './healthGovernor.js';

let scheduler = null;
let isRunning = false;

export async function startEventLoop(config = {}) {
  if (isRunning) {
    console.log('[EventLoop] Already running');
    return;
  }
  
  console.log('[EventLoop] ==========================================');
  console.log('[EventLoop] MYCLAW AUTONOMOUS SCHEDULER OS v2.0');
  console.log('[EventLoop] ==========================================');
  
  scheduler = new SchedulerBrain({
    maxConcurrentTasks: config.maxConcurrentTasks || 5,
    executionIntervalMs: config.executionIntervalMs || 2000,
    enableLearning: config.enableLearning !== false
  });
  
  await scheduler.initialize();
  
  scheduler.on('taskStarted', (task) => {
    console.log(`[EventLoop] ⚡ ${task.agentType}: ${task.id}`);
  });
  
  scheduler.on('taskCompleted', (task) => {
    console.log(`[EventLoop] ✅ ${task.agentType}: ${task.id} (${task.executionTime}ms)`);
  });
  
  scheduler.on('taskFailed', (task, error) => {
    console.log(`[EventLoop] ❌ ${task.agentType}: ${task.id} - ${error.message}`);
  });
  
  scheduler.start();
  isRunning = true;
  
  console.log('[EventLoop] Brain pulse active. System is alive.');
  console.log('[EventLoop] ------------------------------------------');
  
  return scheduler;
}

export function stopEventLoop() {
  if (!isRunning) return;
  
  scheduler?.stop();
  isRunning = false;
  
  console.log('[EventLoop] Brain pulse stopped.');
}

export function getScheduler() {
  return scheduler;
}

export function getStatus() {
  return {
    isRunning,
    scheduler: scheduler?.getMetrics()
  };
}

export default { startEventLoop, stopEventLoop, getScheduler, getStatus };
