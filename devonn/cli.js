#!/usr/bin/env node
/**
 * DEVONN.ai - CLI
 * 
 * Command-line interface for interacting with the scheduler.
 */

import fs from 'fs/promises';
import path from 'path';

const DATA_PATH = './data';

const commands = {
  async status() {
    try {
      const queueData = await fs.readFile(path.join(DATA_PATH, 'taskQueue.json'), 'utf8').catch(() => '{}');
      const insightsData = await fs.readFile(path.join(DATA_PATH, 'insights.json'), 'utf8').catch(() => '{}');
      
      const queue = JSON.parse(queueData);
      const insights = JSON.parse(insightsData);
      
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║              DEVONN.ai Scheduler Status                  ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log();
      
      // Queue stats
      if (queue.queues) {
        console.log('Queue Status:');
        for (const [name, tasks] of Object.entries(queue.queues)) {
          const pending = tasks.filter(t => t.status === 'pending').length;
          const processing = tasks.filter(t => t.status === 'processing').length;
          console.log(`  ${name.padEnd(12)} total: ${tasks.length.toString().padStart(4)} | pending: ${pending.toString().padStart(4)} | processing: ${processing}`);
        }
        console.log();
      }
      
      // Insights
      if (insights.metrics) {
        console.log('Performance Metrics:');
        const tasksByType = new Map(insights.metrics.tasksByType || []);
        for (const [type, stats] of tasksByType) {
          const successRate = stats.count > 0 ? ((stats.successes / stats.count) * 100).toFixed(1) : 0;
          console.log(`  ${type.padEnd(20)} count: ${stats.count.toString().padStart(4)} | success: ${successRate}% | avg: ${Math.round(stats.avgDuration / 1000)}s`);
        }
        console.log();
      }
      
      // Recommendations
      if (insights.executionHistory) {
        const total = insights.executionHistory.length;
        const successful = insights.executionHistory.filter(r => r.success).length;
        const failed = total - successful;
        
        console.log('Session Summary:');
        console.log(`  Total tasks:    ${total}`);
        console.log(`  Successful:     ${successful}`);
        console.log(`  Failed:         ${failed}`);
        console.log(`  Success rate:   ${total > 0 ? ((successful / total) * 100).toFixed(1) : 0}%`);
      }
      
    } catch (error) {
      console.error('Error reading status:', error.message);
    }
  },
  
  async queue() {
    try {
      const queueData = await fs.readFile(path.join(DATA_PATH, 'taskQueue.json'), 'utf8').catch(() => '{}');
      const queue = JSON.parse(queueData);
      
      console.log('Task Queue:');
      console.log();
      
      if (queue.queues) {
        for (const [name, tasks] of Object.entries(queue.queues)) {
          if (tasks.length === 0) continue;
          
          console.log(`${name.toUpperCase()} (${tasks.length} tasks):`);
          for (const task of tasks.slice(0, 10)) {
            const age = Math.round((Date.now() - task.createdAt) / 1000);
            console.log(`  [${task.id.slice(-8)}] ${task.type.padEnd(20)} | priority: ${task.priority} | status: ${task.status.padEnd(10)} | age: ${age}s`);
          }
          if (tasks.length > 10) {
            console.log(`  ... and ${tasks.length - 10} more`);
          }
          console.log();
        }
      }
      
    } catch (error) {
      console.error('Error reading queue:', error.message);
    }
  },
  
  async health() {
    const os = await import('os');
    
    console.log('System Health:');
    console.log();
    
    // CPU
    const cpus = os.default.cpus();
    const loadAvg = os.default.loadavg();
    console.log(`CPU: ${cpus.length} cores | Load avg: ${loadAvg.map(l => l.toFixed(2)).join(', ')}`);
    
    // Memory
    const totalMem = os.default.totalmem();
    const freeMem = os.default.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
    console.log(`Memory: ${(usedMem / 1024 / 1024 / 1024).toFixed(2)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB (${memPercent}%)`);
    
    // Uptime
    const uptime = os.default.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    console.log(`Uptime: ${hours}h ${minutes}m`);
  },
  
  async submit(args) {
    if (args.length < 2) {
      console.log('Usage: cli.js submit <type> <priority> [payload]');
      console.log('Example: cli.js submit shell_command 8 \'{"action":"shell","command":"ls -la"}\'');
      return;
    }
    
    const [type, priorityStr, payloadStr = '{}'] = args;
    const priority = parseInt(priorityStr);
    
    try {
      const payload = JSON.parse(payloadStr);
      
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        priority,
        status: 'pending',
        retries: 0,
        maxRetries: 3,
        retryDelay: 5000,
        dependencies: [],
        payload,
        timeout: 300000,
        createdAt: Date.now()
      };
      
      // Read current queue
      const queuePath = path.join(DATA_PATH, 'taskQueue.json');
      let queueData = {};
      try {
        const content = await fs.readFile(queuePath, 'utf8');
        queueData = JSON.parse(content);
      } catch (e) {
        // File may not exist
      }
      
      // Determine queue
      const queueName = priority >= 9 ? 'critical' :
                       priority >= 7 ? 'high' :
                       priority >= 4 ? 'normal' :
                       priority >= 1 ? 'low' : 'background';
      
      if (!queueData.queues) queueData.queues = {};
      if (!queueData.queues[queueName]) queueData.queues[queueName] = [];
      
      // Add task
      queueData.queues[queueName].push(task);
      queueData.timestamp = Date.now();
      
      // Save
      await fs.mkdir(DATA_PATH, { recursive: true });
      await fs.writeFile(queuePath, JSON.stringify(queueData, null, 2));
      
      console.log(`Task submitted: ${task.id}`);
      console.log(`Type: ${type}, Priority: ${priority}, Queue: ${queueName}`);
      
    } catch (error) {
      console.error('Error submitting task:', error.message);
    }
  }
};

// Main
const [,, cmd, ...args] = process.argv;

if (!cmd || cmd === 'help') {
  console.log('DEVONN.ai Scheduler CLI');
  console.log();
  console.log('Commands:');
  console.log('  status    - Show scheduler status and metrics');
  console.log('  queue     - Show task queue contents');
  console.log('  health    - Show system health');
  console.log('  submit    - Submit a new task');
  console.log();
  console.log('Examples:');
  console.log('  node cli.js status');
  console.log('  node cli.js queue');
  console.log('  node cli.js submit shell_command 8 \'{"action":"shell","command":"ls"}\'');
} else if (commands[cmd]) {
  commands[cmd](args);
} else {
  console.error(`Unknown command: ${cmd}`);
  console.log('Run "node cli.js help" for usage');
}
