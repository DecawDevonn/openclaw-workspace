#!/usr/bin/env node
/**
 * DEVONN Scheduler Dashboard API v1
 * HTTP status endpoint for queue visibility and control
 */

import http from 'http';

const PORT = process.env.DEVONN_API_PORT || 7373;

class DashboardAPI {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.server = null;
    this.startTime = Date.now();
  }

  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(PORT, () => {
      console.log(`[DashboardAPI] Status server running on port ${PORT}`);
      console.log(`[DashboardAPI] Endpoints:`);
      console.log(`  GET http://localhost:${PORT}/status`);
      console.log(`  GET http://localhost:${PORT}/queue`);
      console.log(`  GET http://localhost:${PORT}/tasks`);
      console.log(`  GET http://localhost:${PORT}/metrics`);
      console.log(`  GET http://localhost:${PORT}/ecosystem`);
      console.log(`  POST http://localhost:${PORT}/tasks (add task)`);
    });

    return this.server;
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('[DashboardAPI] Server stopped');
    }
  }

  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      if (req.method === 'GET') {
        switch (path) {
          case '/status':
            return this.getStatus(res);
          case '/queue':
            return this.getQueue(res);
          case '/tasks':
            return this.getTasks(res, url.searchParams);
          case '/metrics':
            return this.getMetrics(res);
          case '/ecosystem':
            return this.getEcosystem(res);
          case '/health':
            return this.getHealth(res);
          default:
            return this.notFound(res);
        }
      } else if (req.method === 'POST' && path === '/tasks') {
        return this.addTask(req, res);
      } else {
        return this.notFound(res);
      }
    } catch (error) {
      this.error(res, error);
    }
  }

  getStatus(res) {
    const status = this.scheduler.getStatus();
    const health = this.scheduler.healthGovernor.getHealth();
    const uptime = Date.now() - this.startTime;

    this.ok(res, {
      scheduler: {
        running: status.running,
        tickCount: status.tickCount,
        uptime: { ms: uptime, formatted: this.formatDuration(uptime) },
        maxConcurrent: status.maxConcurrent
      },
      queue: {
        queued: status.queuedTasks,
        active: status.activeTasks,
        total: status.queuedTasks + status.activeTasks
      },
      health: {
        status: health.status,
        cpu: health.cpu,
        memory: health.memory,
        failureRate: health.failureRate,
        lastCheck: health.lastCheck,
        recommendations: health.recommendations?.slice(0, 3) || []
      },
      timestamp: new Date().toISOString()
    });
  }

  getQueue(res) {
    const queue = this.scheduler.taskQueue;
    const stats = queue.getStats();
    const pending = queue.peekByStatus('pending').slice(0, 10);
    const running = queue.peekByStatus('running').slice(0, 10);
    const completed = queue.peekByStatus('completed').slice(-10).reverse();
    const failed = queue.peekByStatus('failed').slice(-10).reverse();

    this.ok(res, {
      summary: stats,
      pending: pending.map(t => this.summarizeTask(t)),
      running: running.map(t => this.summarizeTask(t, true)),
      completed: completed.map(t => this.summarizeTask(t, true)),
      failed: failed.map(t => this.summarizeTask(t, true)),
      timestamp: new Date().toISOString()
    });
  }

  getTasks(res, params) {
    const status = params.get('status');
    const limit = parseInt(params.get('limit')) || 50;
    const queue = this.scheduler.taskQueue;
    let tasks = queue.peekAll();
    if (status) tasks = tasks.filter(t => t.status === status);
    tasks = tasks.sort((a, b) => new Date(b.metadata?.createdAt || 0) - new Date(a.metadata?.createdAt || 0)).slice(0, limit);

    this.ok(res, {
      count: tasks.length,
      tasks: tasks.map(t => this.summarizeTask(t, true)),
      timestamp: new Date().toISOString()
    });
  }

  getMetrics(res) {
    const history = this.scheduler.taskHistory.slice(-100);
    const completed = history.filter(t => t.status === 'completed').length;
    const failed = history.filter(t => t.status === 'failed').length;
    const total = completed + failed;
    const successRate = total > 0 ? (completed / total) : 1;
    const durations = history.filter(t => t.duration).map(t => t.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    this.ok(res, {
      executions: { total: history.length, completed, failed, successRate: Math.round(successRate * 100) + '%' },
      performance: { avgDuration: Math.round(avgDuration) + 'ms', avgDurationSec: (avgDuration / 1000).toFixed(2) + 's' },
      timestamp: new Date().toISOString()
    });
  }

  getEcosystem(res) {
    const connector = global.ecosystemConnector;
    this.ok(res, {
      mode: connector ? 'connected' : 'standalone',
      connector: connector ? {
        running: connector.running,
        pollInterval: connector.pollInterval,
        orchestratorUrl: process.env.ORCHESTRATOR_URL || 'not set',
        gatewayUrl: process.env.GATEWAY_URL || 'not set',
        organization: process.env.ORGANIZATION || 'not set'
      } : null,
      environment: {
        ENABLE_ECOSYSTEM: process.env.ENABLE_ECOSYSTEM === 'true',
        ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL ? 'set' : 'not set',
        GATEWAY_URL: process.env.GATEWAY_URL ? 'set' : 'not set',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ? 'set' : 'not set'
      },
      timestamp: new Date().toISOString()
    });
  }

  getHealth(res) {
    const health = this.scheduler.healthGovernor.getHealth();
    res.statusCode = health.status === 'healthy' ? 200 : 503;
    res.end(JSON.stringify({
      status: health.status,
      healthy: health.status === 'healthy',
      checks: { cpu: health.cpu < 90 ? 'pass' : 'fail', memory: health.memory < 90 ? 'pass' : 'fail' },
      timestamp: new Date().toISOString()
    }, null, 2));
  }

  async addTask(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const taskSpec = JSON.parse(body);
        const task = await this.scheduler.addTask(taskSpec);
        res.statusCode = 201;
        res.end(JSON.stringify({ success: true, taskId: task.id, status: task.status, timestamp: new Date().toISOString() }, null, 2));
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: error.message }, null, 2));
      }
    });
  }

  summarizeTask(task, includeResult = false) {
    const summary = { id: task.id, type: task.type, status: task.status, priority: task.priority, createdAt: task.metadata?.createdAt };
    if (includeResult) { summary.duration = task.duration; summary.result = task.result; summary.error = task.error?.message; }
    return summary;
  }

  formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return Math.floor(ms / 1000) + 's';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins + 'm ' + secs + 's';
  }

  ok(res, data) { res.statusCode = 200; res.end(JSON.stringify(data, null, 2)); }
  notFound(res) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' }, null, 2)); }
  error(res, err) { res.statusCode = 500; res.end(JSON.stringify({ error: err.message }, null, 2)); }
}

export { DashboardAPI };
