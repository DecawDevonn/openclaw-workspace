/**
 * systemAgent.js
 * System Agent — Health monitoring, resource management, maintenance
 */

import os from 'os';
import fs from 'fs/promises';

export class SystemAgent {
  constructor(config = {}) {
    this.config = {
      ...config
    };
    this.metrics = { runs: 0, successes: 0, failures: 0 };
  }

  async execute(payload) {
    this.metrics.runs++;
    
    const { action, params = {} } = payload;
    
    try {
      let result;
      
      switch (action) {
        case 'health_check':
          result = await this.healthCheck();
          break;
        case 'disk_usage':
          result = await this.diskUsage(params.path || '/');
          break;
        case 'cleanup':
          result = await this.cleanup(params.pattern, params.maxAge);
          break;
        case 'get_metrics':
          result = this.getSystemMetrics();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      this.metrics.successes++;
      return result;
      
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }

  async healthCheck() {
    return {
      healthy: true,
      timestamp: new Date().toISOString(),
      uptime: os.uptime(),
      load: os.loadavg(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: os.cpus().length
    };
  }

  async diskUsage(path) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync(`df -h ${path}`);
    return { path, usage: stdout };
  }

  async cleanup(pattern, maxAge = 86400000) {
    // Implementation for cleanup tasks
    return { cleaned: 0, pattern, maxAge };
  }

  getSystemMetrics() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAvg: os.loadavg()
    };
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

export function createAgent(config) {
  return new SystemAgent(config);
}

export default SystemAgent;
