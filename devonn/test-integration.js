#!/usr/bin/env node
/**
 * Integration Test - Add a real task and verify execution
 */

import { SchedulerBrain } from './core/schedulerBrain.js';

async function runIntegrationTest() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           DEVONN.ai Integration Test                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  
  const scheduler = new SchedulerBrain({
    tickInterval: 1000, // Faster ticks for test
    maxConcurrentTasks: 2
  });
  
  // Track task completion
  let taskCompleted = false;
  let taskResult = null;
  
  scheduler.on('task:complete', (task) => {
    console.log(`✓ Task completed: ${task.id}`);
    console.log(`  Type: ${task.type}`);
    console.log(`  Duration: ${task.duration}ms`);
    console.log(`  Result:`, task.result);
    taskCompleted = true;
    taskResult = task.result;
  });
  
  scheduler.on('task:fail', (task, error) => {
    console.log(`✗ Task failed: ${task.id} - ${error.message}`);
  });
  
  // Start scheduler
  await scheduler.start();
  console.log('[Test] Scheduler started');
  
  // Add a test task
  const testTask = await scheduler.addTask({
    type: 'shell_command',
    subtype: 'exec',
    priority: 9,
    payload: {
      command: 'echo "Hello from Devonn Scheduler" && date -u',
      description: 'Integration test task'
    }
  });
  
  console.log(`[Test] Task added: ${testTask.id}`);
  console.log(`[Test] Waiting for execution...`);
  
  // Wait for task completion (max 10 seconds)
  let waited = 0;
  while (!taskCompleted && waited < 10000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }
  
  // Stop scheduler
  await scheduler.stop();
  
  // Report results
  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  if (taskCompleted) {
    console.log('║  ✅ INTEGRATION TEST PASSED                              ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`Task executed successfully in ${taskResult ? 'N/A' : 'unknown'} ms`);
    return 0;
  } else {
    console.log('║  ❌ INTEGRATION TEST FAILED                              ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('Task did not complete within timeout');
    return 1;
  }
}

runIntegrationTest().then(code => process.exit(code));
