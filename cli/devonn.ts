#!/usr/bin/env node

import { schedulerAPI } from '../api/schedulerAPI.js';

const args = process.argv.slice(2);
const command = args[0];

async function showHelp() {
  console.log(`
Devonn.ai Autonomous Scheduler CLI

Usage: devonn <command> [options]

Commands:
  submit <type> <payload>    Submit a new task
  status [taskId]            Get task status or system metrics
  list [status]              List tasks (optionally filter by status)
  cancel <taskId>            Cancel a pending task
  help                       Show this help message

Examples:
  devonn submit intelligence '{"prompt": "Analyze data"}'
  devonn submit terminal '{"command": "ls -la"}' --priority 8
  devonn status
  devonn status task_1234567890
  devonn list pending
  devonn cancel task_1234567890
`);
}

async function submitTask() {
  const type = args[1] as any;
  const payloadStr = args[2] || '{}';
  
  if (!type) {
    console.error('Error: Task type required');
    process.exit(1);
  }
  
  const validTypes = ['web', 'terminal', 'system', 'intelligence', 'orchestrator'];
  if (!validTypes.includes(type)) {
    console.error(`Error: Invalid type. Must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }
  
  try {
    const payload = JSON.parse(payloadStr);
    const priorityFlag = args.findIndex(a => a === '--priority');
    const priority = priorityFlag > -1 ? parseInt(args[priorityFlag + 1]) : 5;
    
    const result = await schedulerAPI.submitTask({
      type,
      payload,
      priority
    });
    
    console.log(`Task submitted successfully!`);
    console.log(`  ID: ${result.taskId}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Type: ${type}`);
    console.log(`  Priority: ${priority}`);
  } catch (error) {
    console.error('Error submitting task:', error);
    process.exit(1);
  }
}

async function getStatus() {
  const taskId = args[1];
  
  if (taskId) {
    const task = await schedulerAPI.getTaskStatus(taskId);
    if (!task) {
      console.error(`Task ${taskId} not found`);
      process.exit(1);
    }
    
    console.log(`Task: ${task.id}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Type: ${task.type}`);
    console.log(`  Priority: ${task.priority}`);
    console.log(`  Retries: ${task.retries}`);
    console.log(`  Created: ${new Date(task.createdAt).toISOString()}`);
    if (task.lastRun) {
      console.log(`  Last Run: ${new Date(task.lastRun).toISOString()}`);
    }
    if (task.error) {
      console.log(`  Error: ${task.error}`);
    }
  } else {
    const metrics = await schedulerAPI.getSystemMetrics();
    
    console.log('System Metrics');
    console.log('==============');
    console.log(`Health Status: ${metrics.health.status.toUpperCase()}`);
    console.log(`CPU Usage: ${metrics.health.cpuUsage.toFixed(1)}%`);
    console.log(`Memory Usage: ${metrics.health.memoryUsage.toFixed(1)}%`);
    console.log(`Uptime: ${(metrics.health.uptime / 1000 / 60).toFixed(1)} minutes`);
    console.log('');
    console.log('Queue Metrics');
    console.log('=============');
    console.log(`Total Tasks: ${metrics.queue.total}`);
    console.log(`Pending: ${metrics.queue.pending}`);
    console.log(`Running: ${metrics.queue.running}`);
    console.log(`Completed: ${metrics.queue.completed}`);
    console.log(`Failed: ${metrics.queue.failed}`);
    console.log('');
    console.log('By Type:');
    Object.entries(metrics.queue.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }
}

async function listTasks() {
  const status = args[1] as any;
  const tasks = await schedulerAPI.listTasks(status);
  
  if (tasks.length === 0) {
    console.log('No tasks found');
    return;
  }
  
  console.log(`Found ${tasks.length} tasks`);
  console.log('');
  console.log('ID                           | Status    | Type         | Priority | Retries');
  console.log('-'.repeat(80));
  
  tasks.forEach(task => {
    const id = task.id.substring(0, 28).padEnd(28);
    const stat = task.status.padEnd(9);
    const type = task.type.padEnd(12);
    const prio = task.priority.toString().padEnd(8);
    const retries = task.retries.toString();
    console.log(`${id} | ${stat} | ${type} | ${prio} | ${retries}`);
  });
}

async function cancelTask() {
  const taskId = args[1];
  
  if (!taskId) {
    console.error('Error: Task ID required');
    process.exit(1);
  }
  
  const success = await schedulerAPI.cancelTask(taskId);
  
  if (success) {
    console.log(`Task ${taskId} cancelled successfully`);
  } else {
    console.error(`Failed to cancel task ${taskId} (may not exist or already running)`);
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'submit':
      await submitTask();
      break;
    case 'status':
      await getStatus();
      break;
    case 'list':
      await listTasks();
      break;
    case 'cancel':
      await cancelTask();
      break;
    case 'help':
    default:
      await showHelp();
      break;
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});