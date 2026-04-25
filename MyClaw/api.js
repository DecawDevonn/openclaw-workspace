/**
 * api.js — HTTP API for MyClaw Scheduler
 * 
 * Provides REST endpoints for external integration.
 */

import { createServer } from 'http';
import { getEventLoop } from './core/eventLoop.js';
import { getTaskQueue } from './queue/taskQueue.js';
import { getDeadLetterQueue } from './queue/deadLetterQueue.js';
import { getSchedulerInsights } from './analytics/schedulerInsights.js';

const PORT = process.env.MYCLAW_PORT || 3456;

class SchedulerAPI {
  constructor() {
    this.server = null;
  }
  
  async start() {
    this.server = createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const path = url.pathname;
      
      try {
        if (path === '/health') {
          await this.handleHealth(req, res);
        } else if (path === '/status') {
          await this.handleStatus(req, res);
        } else if (path === '/tasks' && req.method === 'GET') {
          await this.handleListTasks(req, res, url);
        } else if (path === '/tasks' && req.method === 'POST') {
          await this.handleSubmitTask(req, res);
        } else if (path.startsWith('/tasks/') && req.method === 'GET') {
          await this.handleGetTask(req, res, path);
        } else if (path.startsWith('/tasks/') && req.method === 'DELETE') {
          await this.handleCancelTask(req, res, path);
        } else if (path === '/stats') {
          await this.handleStats(req, res);
        } else if (path === '/dlq') {
          await this.handleDlq(req, res);
        } else if (path === '/insights') {
          await this.handleInsights(req, res);
        } else {
          this.sendError(res, 404, 'Not found');
        }
      } catch (error) {
        console.error('[API] Error:', error.message);
        this.sendError(res, 500, error.message);
      }
    });
    
    this.server.listen(PORT, () => {
      console.log(`[API] Server listening on port ${PORT}`);
    });
    
    return this.server;
  }
  
  async stop() {
    if (this.server) {
      this.server.close();
      console.log('[API] Server stopped');
    }
  }
  
  sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }
  
  sendError(res, status, message) {
    this.sendJSON(res, status, { error: message });
  }
  
  async handleHealth(req, res) {
    const eventLoop = getEventLoop();
    const metrics = eventLoop.brain.getMetrics();
    
    this.sendJSON(res, 200, {
      status: metrics.health.status,
      cpu: metrics.health.cpu,
      memory: metrics.health.memory,
      queueDepth: metrics.health.queueDepth,
      timestamp: Date.now()
    });
  }
  
  async handleStatus(req, res) {
    const eventLoop = getEventLoop();
    const metrics = eventLoop.brain.getMetrics();
    
    this.sendJSON(res, 200, {
      running: eventLoop.isRunning,
      health: metrics.health.status,
      activeTasks: metrics.activeTasks,
      pendingTasks: metrics.pendingTasks,
      completedTasks: metrics.tasksCompleted,
      failedTasks: metrics.tasksFailed,
      uptime: metrics.uptime
    });
  }
  
  async handleListTasks(req, res, url) {
    const status = url.searchParams.get('status');
    const queue = await getTaskQueue();
    
    let tasks;
    if (status) {
      tasks = await queue.getByStatus(status);
    } else {
      tasks = await queue.getPending();
    }
    
    this.sendJSON(res, 200, {
      count: tasks.length,
      tasks: tasks.map(t => ({
        id: t.id,
        type: t.type,
        priority: t.priority,
        status: t.status,
        retries: t.retries,
        createdAt: t.createdAt
      }))
    });
  }
  
  async handleSubmitTask(req, res) {
    const body = await this.readBody(req);
    const data = JSON.parse(body);
    
    const eventLoop = getEventLoop();
    const taskId = await eventLoop.brain.submitTask({
      type: data.type || 'generic',
      priority: data.priority || 5,
      dependencies: data.dependencies || [],
      payload: data.payload || {}
    });
    
    this.sendJSON(res, 201, {
      taskId,
      status: 'submitted',
      timestamp: Date.now()
    });
  }
  
  async handleGetTask(req, res, path) {
    const taskId = path.replace('/tasks/', '');
    const eventLoop = getEventLoop();
    const task = await eventLoop.brain.getTask(taskId);
    
    if (!task) {
      this.sendError(res, 404, 'Task not found');
      return;
    }
    
    this.sendJSON(res, 200, task);
  }
  
  async handleCancelTask(req, res, path) {
    const taskId = path.replace('/tasks/', '');
    const eventLoop = getEventLoop();
    const cancelled = await eventLoop.brain.cancelTask(taskId);
    
    if (cancelled) {
      this.sendJSON(res, 200, { taskId, status: 'cancelled' });
    } else {
      this.sendError(res, 400, 'Task not found or already running');
    }
  }
  
  async handleStats(req, res) {
    const queue = await getTaskQueue();
    const stats = await queue.getStats();
    
    this.sendJSON(res, 200, stats);
  }
  
  async handleDlq(req, res) {
    const dlq = await getDeadLetterQueue();
    const stats = await dlq.getStats();
    
    this.sendJSON(res, 200, stats);
  }
  
  async handleInsights(req, res) {
    const insights = await getSchedulerInsights();
    
    this.sendJSON(res, 200, {
      summary: insights.getSummary(),
      recommendations: insights.getRecommendations()
    });
  }
  
  async readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const api = new SchedulerAPI();
  api.start();
}

export { SchedulerAPI };
export default SchedulerAPI;
