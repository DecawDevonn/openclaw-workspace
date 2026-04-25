#!/usr/bin/env node
/**
 * Ecosystem Connector - Links Devonn Scheduler to the Auto-Healer Mesh
 * 
 * Bridges the local scheduler with the central orchestrator:
 * - Polls orchestrator for pending tasks
 * - Injects tasks into local scheduler queue
 * - Reports task results back to orchestrator
 */

import { SchedulerBrain } from './core/schedulerBrain.js';

const CONFIG = {
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'https://central-orchestrator.onrender.com',
  gatewayUrl: process.env.GATEWAY_URL || 'https://openclaw-gateway-2t9e.onrender.com',
  githubToken: process.env.GITHUB_TOKEN || '',
  pollInterval: parseInt(process.env.POLL_INTERVAL) || 30000, // 30s
  org: process.env.ORGANIZATION || 'wesship'
};

class EcosystemConnector {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.running = false;
    this.pollTimer = null;
  }

  async start() {
    console.log('[EcosystemConnector] Starting...');
    console.log(`[EcosystemConnector] Orchestrator: ${CONFIG.orchestratorUrl}`);
    console.log(`[EcosystemConnector] Gateway: ${CONFIG.gatewayUrl}`);
    
    this.running = true;
    this.poll();
    
    // Also wire up result reporting
    this.scheduler.on('task:complete', (task) => this.reportResult(task, 'success'));
    this.scheduler.on('task:fail', (task, error) => this.reportResult(task, 'failed', error));
  }

  stop() {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    console.log('[EcosystemConnector] Stopped');
  }

  async poll() {
    if (!this.running) return;
    
    try {
      const tasks = await this.fetchPendingTasks();
      if (tasks.length > 0) {
        console.log(`[EcosystemConnector] Found ${tasks.length} pending task(s)`);
        for (const task of tasks) {
          await this.injectTask(task);
        }
      }
    } catch (error) {
      console.error('[EcosystemConnector] Poll error:', error.message);
    }
    
    this.pollTimer = setTimeout(() => this.poll(), CONFIG.pollInterval);
  }

  async fetchPendingTasks() {
    const response = await fetch(`${CONFIG.orchestratorUrl}/queue`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.githubToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.tasks || [];
  }

  async injectTask(ecosystemTask) {
    // Map ecosystem task types to scheduler task types
    const taskType = this.mapTaskType(ecosystemTask.type);
    
    const task = await this.scheduler.addTask({
      type: taskType,
      priority: ecosystemTask.priority || 5,
      payload: {
        ...ecosystemTask.payload,
        ecosystemTaskId: ecosystemTask.id,
        repo: ecosystemTask.repo,
        agent: ecosystemTask.agent
      },
      metadata: {
        source: 'ecosystem',
        originalTask: ecosystemTask
      }
    });
    
    console.log(`[EcosystemConnector] Injected task: ${task.id} (from ${ecosystemTask.id})`);
    return task;
  }

  mapTaskType(ecosystemType) {
    const typeMap = {
      'security_scan': 'system_check',
      'debug_fix': 'shell_command',
      'refactor': 'shell_command',
      'performance_opt': 'shell_command',
      'github_pr': 'shell_command',
      'github_issue': 'shell_command'
    };
    return typeMap[ecosystemType] || 'shell_command';
  }

  async reportResult(task, status, error = null) {
    const ecosystemTaskId = task.payload?.ecosystemTaskId;
    if (!ecosystemTaskId) return; // Not an ecosystem task
    
    const result = {
      taskId: ecosystemTaskId,
      schedulerTaskId: task.id,
      status,
      result: task.result,
      duration: task.duration,
      error: error ? error.message : null,
      completedAt: new Date().toISOString()
    };
    
    try {
      const response = await fetch(`${CONFIG.orchestratorUrl}/results`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(result)
      });
      
      if (response.ok) {
        console.log(`[EcosystemConnector] Reported result for ${ecosystemTaskId}`);
      } else {
        console.error(`[EcosystemConnector] Failed to report: HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('[EcosystemConnector] Report error:', err.message);
    }
  }
}

export { EcosystemConnector, CONFIG };
export default EcosystemConnector;
