#!/usr/bin/env node
/**
 * DEVONN.ai - Scheduler HTTP API Server
 * 
 * Provides REST endpoints for external systems to submit tasks.
 * Integrates with the capture API and other external services.
 */

import http from 'http';
import { SchedulerBrain } from './core/schedulerBrain.js';

const PORT = process.env.DEVONN_API_PORT || 3456;
const HOST = process.env.DEVONN_API_HOST || '127.0.0.1';

// Initialize scheduler
const scheduler = new SchedulerBrain({
  tickInterval: 2000,
  maxConcurrentTasks: 5,
  defaultTimeout: 300000
});

// Track API requests for rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Check rate limit
 */
function checkRateLimit(clientId) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;
  
  const requests = requestCounts.get(clientId) || [];
  const recentRequests = requests.filter(t => t > windowStart);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  requestCounts.set(clientId, recentRequests);
  return true;
}

/**
 * Clean up old rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;
  
  for (const [clientId, requests] of requestCounts.entries()) {
    const recent = requests.filter(t => t > windowStart);
    if (recent.length === 0) {
      requestCounts.delete(clientId);
    } else {
      requestCounts.set(clientId, recent);
    }
  }
}, 60000);

/**
 * Request handler
 */
async function handleRequest(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Rate limiting
  const clientId = req.headers['x-client-id'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientId)) {
    sendJSON(res, 429, { error: 'Rate limit exceeded', retryAfter: 60 });
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  try {
    // Health check
    if (path === '/health' && req.method === 'GET') {
      const status = scheduler.getStatus();
      sendJSON(res, 200, {
        status: 'ok',
        scheduler: status.status,
        uptime: status.uptime,
        tasks: status.tasks,
        health: status.health
      });
      return;
    }
    
    // Submit task
    if (path === '/tasks' && req.method === 'POST') {
      const body = await parseBody(req);
      
      // Validate required fields
      if (!body.type) {
        sendJSON(res, 400, { error: 'Missing required field: type' });
        return;
      }
      
      // Submit to scheduler
      const taskId = await scheduler.submitTask({
        type: body.type,
        priority: body.priority || 5,
        payload: body.payload || {},
        maxRetries: body.maxRetries || 3,
        timeout: body.timeout || 300000,
        dependencies: body.dependencies || []
      });
      
      sendJSON(res, 201, {
        success: true,
        taskId,
        status: 'pending',
        message: 'Task submitted successfully'
      });
      return;
    }
    
    // Get queue status
    if (path === '/queue' && req.method === 'GET') {
      const status = scheduler.getStatus();
      sendJSON(res, 200, {
        queue: status.queue,
        timestamp: Date.now()
      });
      return;
    }
    
    // Get task status
    if (path.startsWith('/tasks/') && req.method === 'GET') {
      const taskId = path.split('/')[2];
      const task = await scheduler.taskQueue.getTask(taskId);
      
      if (!task) {
        sendJSON(res, 404, { error: 'Task not found' });
        return;
      }
      
      sendJSON(res, 200, {
        task: {
          id: task.id,
          type: task.type,
          priority: task.priority,
          status: task.status,
          retries: task.retries,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          duration: task.duration,
          result: task.result,
          error: task.error
        }
      });
      return;
    }
    
    // Get system insights
    if (path === '/insights' && req.method === 'GET') {
      const stats = scheduler.insights.getStats();
      const recommendations = scheduler.insights.getRecommendations();
      
      sendJSON(res, 200, {
        stats,
        recommendations,
        timestamp: Date.now()
      });
      return;
    }
    
    // 404 for unknown paths
    sendJSON(res, 404, { error: 'Not found' });
    
  } catch (error) {
    console.error('[API] Error handling request:', error);
    sendJSON(res, 500, { error: 'Internal server error', message: error.message });
  }
}

/**
 * Start the API server
 */
async function startServer() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           DEVONN.ai Scheduler API Server                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  
  // Initialize scheduler
  await scheduler.init();
  scheduler.start();
  
  // Create HTTP server
  const server = http.createServer(handleRequest);
  
  server.listen(PORT, HOST, () => {
    console.log(`[API] Server running at http://${HOST}:${PORT}`);
    console.log('[API] Endpoints:');
    console.log('  GET  /health    - System health check');
    console.log('  POST /tasks     - Submit new task');
    console.log('  GET  /queue     - View queue status');
    console.log('  GET  /tasks/:id - Get task status');
    console.log('  GET  /insights  - View analytics and recommendations');
    console.log();
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[API] Shutting down...');
    scheduler.stop();
    server.close(() => {
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('[API] Shutting down...');
    scheduler.stop();
    server.close(() => {
      process.exit(0);
    });
  });
}

// Start
startServer().catch(error => {
  console.error('[API] Fatal error:', error);
  process.exit(1);
});
