#!/usr/bin/env node
/**
 * cli.js — MyClaw Scheduler CLI
 * 
 * Command-line interface for interacting with the scheduler.
 */

import { getEventLoop } from './core/eventLoop.js';
import { getTaskQueue } from './queue/taskQueue.js';
import { getDeadLetterQueue } from './queue/deadLetterQueue.js';
import { getSchedulerInsights } from './analytics/schedulerInsights.js';

const COMMANDS = {
  status: cmdStatus,
  start: cmdStart,
  stop: cmdStop,
  submit: cmdSubmit,
  list: cmdList,
  stats: cmdStats,
  health: cmdHealth,
  dlq: cmdDlq,
  insights: cmdInsights,
  cancel: cmdCancel,
  help: cmdHelp
};

function printUsage() {
  console.log(`
MyClaw Scheduler CLI

Usage: node cli.js <command> [options]

Commands:
  status              Show system status
  start               Start the scheduler
  stop                Stop the scheduler
  submit <type>       Submit a new task
  list [status]       List tasks (optionally filter by status)
  stats               Show queue statistics
  health              Show health metrics
  dlq [cmd]           Dead letter queue commands (list, clear, inspect)
  insights            Show analytics and recommendations
  cancel <taskId>     Cancel a task
  help                Show this help

Examples:
  node cli.js status
  node cli.js submit web --payload '{"url":"https://api.example.com"}'
  node cli.js list pending
  node cli.js dlq list
`);
}

async function cmdStatus() {
  try {
    const eventLoop = getEventLoop();
    const metrics = eventLoop.brain.getMetrics();
    
    console.log('\n📊 MyClaw Scheduler Status\n');
    console.log(`  Status:        ${eventLoop.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
    console.log(`  Health:        ${metrics.health.status.toUpperCase()}`);
    console.log(`  Active Tasks:  ${metrics.activeTasks}`);
    console.log(`  Pending:       ${metrics.pendingTasks}`);
    console.log(`  Completed:     ${metrics.tasksCompleted}`);
    console.log(`  Failed:        ${metrics.tasksFailed}`);
    console.log(`  Uptime:        ${Math.floor(metrics.uptime / 1000)}s`);
    console.log();
  } catch (error) {
    console.error('Error getting status:', error.message);
  }
}

async function cmdStart() {
  try {
    const eventLoop = getEventLoop();
    await eventLoop.start();
    console.log('✅ Scheduler started');
  } catch (error) {
    console.error('Error starting scheduler:', error.message);
  }
}

async function cmdStop() {
  try {
    const eventLoop = getEventLoop();
    await eventLoop.stop();
    console.log('⛔ Scheduler stopped');
  } catch (error) {
    console.error('Error stopping scheduler:', error.message);
  }
}

async function cmdSubmit(args) {
  try {
    const type = args[0];
    if (!type) {
      console.error('Error: Task type required');
      console.log('Usage: node cli.js submit <type> [options]');
      return;
    }
    
    let priority = 5;
    let payload = {};
    
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--priority' && args[i + 1]) {
        priority = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i] === '--payload' && args[i + 1]) {
        try {
          payload = JSON.parse(args[i + 1]);
        } catch (e) {
          console.error('Error: Invalid JSON in payload');
          return;
        }
        i++;
      }
    }
    
    const eventLoop = getEventLoop();
    const taskId = await eventLoop.brain.submitTask({
      type,
      priority,
      payload
    });
    
    console.log(`✅ Task submitted: ${taskId}`);
  } catch (error) {
    console.error('Error submitting task:', error.message);
  }
}

async function cmdList(args) {
  try {
    const filterStatus = args[0];
    const queue = await getTaskQueue();
    
    let tasks;
    if (filterStatus) {
      tasks = await queue.getByStatus(filterStatus);
    } else {
      tasks = await queue.getPending();
    }
    
    console.log(`\n📋 Tasks (${tasks.length} total)\n`);
    
    if (tasks.length === 0) {
      console.log('  No tasks found');
    } else {
      console.log('  ID                           Type      Priority  Status     Created');
      console.log('  ──────────────────────────────────────────────────────────────────────────');
      
      for (const task of tasks.slice(0, 20)) {
        const id = task.id.substring(0, 28).padEnd(28);
        const type = (task.type || 'generic').padEnd(9);
        const priority = String(task.priority || 5).padEnd(8);
        const status = (task.status || 'unknown').padEnd(10);
        const created = new Date(task.createdAt).toISOString().split('T')[0];
        
        console.log(`  ${id} ${type} ${priority} ${status} ${created}`);
      }
      
      if (tasks.length > 20) {
        console.log(`  ... and ${tasks.length - 20} more`);
      }
    }
    
    console.log();
  } catch (error) {
    console.error('Error listing tasks:', error.message);
  }
}

async function cmdStats() {
  try {
    const queue = await getTaskQueue();
    const stats = await queue.getStats();
    
    console.log('\n📊 Queue Statistics\n');
    console.log(`  Total Tasks:     ${stats.total}`);
    console.log(`  Pending:         ${stats.pending}`);
    console.log(`  Running:         ${stats.running}`);
    console.log(`  Completed:       ${stats.completed}`);
    console.log(`  Failed:          ${stats.failed}`);
    console.log(`  Cancelled:       ${stats.cancelled}`);
    console.log();
  } catch (error) {
    console.error('Error getting stats:', error.message);
  }
}

async function cmdHealth() {
  try {
    const eventLoop = getEventLoop();
    const metrics = eventLoop.brain.getMetrics();
    
    console.log('\n🏥 Health Metrics\n');
    console.log(`  Status:          ${metrics.health.status.toUpperCase()}`);
    console.log(`  CPU Usage:       ${metrics.health.cpu}%`);
    console.log(`  Memory Usage:    ${metrics.health.memory}%`);
    console.log(`  Queue Depth:     ${metrics.health.queueDepth}`);
    console.log(`  Failure Rate:    ${(metrics.health.failureRate * 100).toFixed(1)}%`);
    console.log(`  Crash Rate:      ${(metrics.health.agentCrashRate * 100).toFixed(1)}%`);
    console.log();
  } catch (error) {
    console.error('Error getting health:', error.message);
  }
}

async function cmdDlq(args) {
  try {
    const subcommand = args[0] || 'list';
    const dlq = await getDeadLetterQueue();
    
    switch (subcommand) {
      case 'list': {
        const stats = await dlq.getStats();
        console.log('\n📦 Dead Letter Queue\n');
        console.log(`  Total Tasks:     ${stats.total}`);
        console.log(`  Recent (24h):    ${stats.recent}`);
        console.log(`  By Type:`);
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`    ${type}: ${count}`);
        }
        console.log();
        break;
      }
        
      case 'inspect': {
        const tasks = await dlq.getAll();
        console.log(`\n🔍 DLQ Tasks (${tasks.length} total)\n`);
        
        if (tasks.length === 0) {
          console.log('  No tasks in DLQ');
        } else {
          for (const task of tasks.slice(0, 10)) {
            console.log(`  ${task.id}`);
            console.log(`    Type: ${task.type}`);
            console.log(`    Reason: ${task.failureReason}`);
            console.log(`    Moved: ${new Date(task.movedToDLQ).toISOString()}`);
            console.log();
          }
        }
        break;
      }
        
      case 'clear': {
        await dlq.clear();
        console.log('✅ Dead letter queue cleared');
        break;
      }
        
      default:
        console.log('Unknown DLQ command. Use: list, inspect, clear');
    }
  } catch (error) {
    console.error('Error with DLQ:', error.message);
  }
}

async function cmdInsights() {
  try {
    const