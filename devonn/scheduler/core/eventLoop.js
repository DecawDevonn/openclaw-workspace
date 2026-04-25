/**
 * Event Loop - The Brain Pulse
 * 
 * Continuously polls for tasks and executes them.
 * Replaces static cron with adaptive, event-driven execution.
 */

import { schedulerBrain } from "./schedulerBrain.js";
import { healthGovernor } from "./healthGovernor.js";
import { taskExecutor } from "../agents/taskExecutor.js";

const CONFIG = {
  POLL_INTERVAL_MS: 2000,
  MAX_CONCURRENT_TASKS: 5,
  ADAPTIVE_THROTTLING: true
};

let loopRunning = false;
let loopInterval = null;

/**
 * Main event loop - continuously checks for and executes tasks
 */
async function eventLoop() {
  if (!loopRunning) return;

  try {
    // Check system health before executing
    const health = healthGovernor.getHealth();
    
    if (health.status === 'critical') {
      console.log("🚨 System health critical - pausing execution");
      return;
    }

    if (health.status === 'warning' && CONFIG.ADAPTIVE_THROTTLING) {
      console.log("⚠️  System under stress - throttling execution");
      // Reduce concurrent tasks when system is stressed
      await executeWithLimit(2);
      return;
    }

    // Normal execution
    await executeWithLimit(CONFIG.MAX_CONCURRENT_TASKS);

  } catch (error) {
    console.error("❌ Event loop error:", error.message);
  }
}

/**
 * Execute tasks with a concurrency limit
 */
async function executeWithLimit(limit) {
  const tasks = schedulerBrain.getExecutableTasks(limit);

  if (tasks.length === 0) return;

  console.log(`⚡ Executing ${tasks.length} task(s)...`);

  const executions = tasks.map(task => 
    taskExecutor.execute(task).catch(error => {
      console.error(`❌ Execution failed for ${task.id}:`, error.message);
    })
  );

  await Promise.all(executions);
}

/**
 * Start the event loop
 */
export async function startEventLoop() {
  if (loopRunning) {
    console.log("⚠️  Event loop already running");
    return;
  }

  console.log("🔄 Starting Event Loop...");
  loopRunning = true;
  schedulerBrain.running = true;

  // Run immediately, then on interval
  await eventLoop();
  loopInterval = setInterval(eventLoop, CONFIG.POLL_INTERVAL_MS);

  console.log(`   Poll interval: ${CONFIG.POLL_INTERVAL_MS}ms`);
  console.log(`   Max concurrent: ${CONFIG.MAX_CONCURRENT_TASKS}`);
}

/**
 * Stop the event loop
 */
export function stopEventLoop() {
  loopRunning = false;
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }
  console.log("🛑 Event loop stopped");
}

/**
 * Get loop status
 */
export function getLoopStatus() {
  return {
    running: loopRunning,
    pollInterval: CONFIG.POLL_INTERVAL_MS,
    maxConcurrent: CONFIG.MAX_CONCURRENT_TASKS
  };
}
