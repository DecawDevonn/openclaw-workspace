import { eventLoop } from './core/eventLoop.js';
import { taskQueue } from './queue/taskQueue.js';
import { healthGovernor } from './core/healthGovernor.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     DEVONN.AI - AUTONOMOUS ORCHESTRATION SYSTEM            ║');
console.log('║     v2.0 - Event-Driven Self-Healing Scheduler             ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] Received SIGINT, gracefully stopping...');
  await eventLoop.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Shutdown] Received SIGTERM, gracefully stopping...');
  await eventLoop.stop();
  process.exit(0);
});

// Health monitoring events
healthGovernor.on('health:warning', (data) => {
  console.log(`[Health Warning] ${data.type} at ${data.value.toFixed(1)}% (threshold: ${data.threshold}%)`);
});

healthGovernor.on('health:check', (metrics) => {
  const stress = healthGovernor.getStressLevel();
  if (stress !== 'low') {
    console.log(`[Health] Status: ${stress.toUpperCase()} | CPU: ${metrics.cpuUsage.toFixed(1)}% | Memory: ${metrics.memoryUsage.toFixed(1)}%`);
  }
});

// Task queue events
taskQueue.on('task:added', (task) => {
  // Task added notification (already logged in add method)
});

taskQueue.on('task:completed', (task) => {
  // Task completed notification (already logged in markCompleted)
});

taskQueue.on('task:dead', (task) => {
  console.log(`[Dead Letter] Task ${task.id} permanently failed after ${task.maxRetries} retries`);
});

// Start the system
async function main() {
  try {
    // Load any persisted tasks
    const metrics = await taskQueue.getMetrics();
    console.log(`[Bootstrap] Loaded ${metrics.total} tasks from persistence`);
    console.log(`[Bootstrap] Pending: ${metrics.pending}, Running: ${metrics.running}, Completed: ${metrics.completed}, Dead: ${metrics.failed}`);
    console.log('');
    
    // Start the event loop
    await eventLoop.start();
    
    // Keep process alive
    console.log('[Bootstrap] System running. Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('[Bootstrap] Failed to start:', error);
    process.exit(1);
  }
}

main();
