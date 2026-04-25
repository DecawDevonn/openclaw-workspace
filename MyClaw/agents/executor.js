/**
 * executor.js — Agent Task Executor
 * 
 * Executes agent tasks based on their type.
 * Routes to appropriate handlers for web, terminal, system, etc.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

const AGENT_HANDLERS = {
  web: executeWebTask,
  terminal: executeTerminalTask,
  system: executeSystemTask,
  intelligence: executeIntelligenceTask,
  orchestrator: executeOrchestratorTask,
  generic: executeGenericTask
};

/**
 * Main entry point for task execution
 */
export async function executeAgentTask(task) {
  console.log(`[EXECUTOR] Executing task ${task.id} (${task.type})`);
  
  const handler = AGENT_HANDLERS[task.type] || AGENT_HANDLERS.generic;
  
  const startTime = Date.now();
  
  try {
    const result = await handler(task);
    
    const duration = Date.now() - startTime;
    console.log(`[EXECUTOR] Task ${task.id} completed in ${duration}ms`);
    
    return {
      success: true,
      result,
      duration,
      taskId: task.id
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EXECUTOR] Task ${task.id} failed after ${duration}ms:`, error.message);
    
    throw error;
  }
}

/**
 * Execute web-based tasks (scraping, API calls, etc.)
 */
async function executeWebTask(task) {
  const { url, method = 'GET', headers = {}, body, extract } = task.payload;
  
  if (!url) {
    throw new Error('URL is required for web tasks');
  }
  
  // Use native fetch
  const response = await fetch(url, {
    method,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MyClaw-Agent/1.0',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Extract specific fields if requested
  if (extract && Array.isArray(extract)) {
    const extracted = {};
    for (const key of extract) {
      extracted[key] = data[key];
    }
    return extracted;
  }
  
  return data;
}

/**
 * Execute terminal/shell commands
 */
async function executeTerminalTask(task) {
  const { command, cwd, env = {}, timeout = 30000 } = task.payload;
  
  if (!command) {
    throw new Error('Command is required for terminal tasks');
  }
  
  return new Promise((resolve, reject) => {
    const args = command.split(' ');
    const cmd = args.shift();
    
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Execute system maintenance tasks
 */
async function executeSystemTask(task) {
  const { action, params = {} } = task.payload;
  
  switch (action) {
    case 'cleanup':
      // Clean up old tasks
      return { cleaned: true, timestamp: Date.now() };
      
    case 'health_check':
      return {
        healthy: true,
        timestamp: Date.now(),
        uptime: process.uptime()
      };
      
    case 'metrics':
      return {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      };
      
    default:
      throw new Error(`Unknown system action: ${action}`);
  }
}

/**
 * Execute intelligence/analysis tasks
 */
async function executeIntelligenceTask(task) {
  const { operation, data, options = {} } = task.payload;
  
  switch (operation) {
    case 'analyze':
      // Simple analysis - can be extended
      return {
        operation: 'analyze',
        inputSize: JSON.stringify(data).length,
        timestamp: Date.now(),
        result: 'analysis_complete'
      };
      
    case 'summarize':
      // Simple summarization
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      return {
        operation: 'summarize',
        originalLength: text.length,
        timestamp: Date.now(),
        summary: text.substring(0, 200) + (text.length > 200 ? '...' : '')
      };
      
    case 'classify':
      return {
        operation: 'classify',
        categories: options.categories || [],
        timestamp: Date.now(),
        classification: 'unclassified'
      };
      
    default:
      throw new Error(`Unknown intelligence operation: ${operation}`);
  }
}

/**
 * Execute orchestrator/coordination tasks
 */
async function executeOrchestratorTask(task) {
  const { workflow, steps = [] } = task.payload;
  
  const results = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    try {
      // Execute each step as a sub-task
      const result = await executeAgentTask({
        id: `${task.id}_step_${i}`,
        type: step.type || 'generic',
        payload: step.payload || {}
      });
      
      results.push({
        step: i,
        status: 'completed',
        result
      });
    } catch (error) {
      results.push({
        step: i,
        status: 'failed',
        error: error.message
      });
      
      // Stop workflow on failure unless configured otherwise
      if (!step.continueOnError) {
        break;
      }
    }
  }
  
  return {
    workflow,
    stepsExecuted: results.length,
    completed: results.filter(r => r.status === 'completed').length,
    failed: results.filter(r => r.status === 'failed').length,
    results
  };
}

/**
 * Execute generic/unknown tasks
 */
async function executeGenericTask(task) {
  const { action, params = {} } = task.payload;
  
  // Generic handler - just echo back
  return {
    type: 'generic',
    action: action || 'none',
    params,
    timestamp: Date.now(),
    note: 'No specific handler for this task type'
  };
}

export default executeAgentTask;
