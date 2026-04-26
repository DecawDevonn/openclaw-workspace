#!/usr/bin/env node
/**
 * Deployment Checker Agent
 * Pings live URLs, verifies /health endpoints, logs uptime failures
 */

class DeploymentChecker {
  constructor(config = {}) {
    this.timeout = config.timeout || 10000;
    this.retries = config.retries || 2;
    this.defaultEndpoints = [
      { name: 'OpenClaw Gateway', url: 'https://openclaw-gateway-2t9e.onrender.com/health' },
      { name: 'Central Orchestrator', url: 'https://central-orchestrator.onrender.com/health' }
    ];
  }

  async checkEndpoint(endpoint) {
    const startTime = Date.now();
    let lastError = null;
    
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const res = await fetch(endpoint.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Devonn-HealthCheck/1.0' }
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        let healthData = null;
        if (res.headers.get('content-type')?.includes('application/json')) {
          try { healthData = await res.json(); } catch {}
        }
        
        return {
          name: endpoint.name,
          url: endpoint.url,
          status: res.status,
          statusText: res.statusText,
          healthy: res.ok,
          responseTime,
          healthData,
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        lastError = error;
        if (attempt < this.retries - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: 0,
      statusText: 'ERROR',
      healthy: false,
      responseTime: Date.now() - startTime,
      error: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }

  async checkAll(endpoints = null) {
    const targets = endpoints || this.defaultEndpoints;
    
    const results = await Promise.all(
      targets.map(e => this.checkEndpoint(e))
    );
    
    const healthy = results.filter(r => r.healthy).length;
    const failed = results.filter(r => !r.healthy);
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        healthy,
        failed: failed.length
      },
      results,
      alerts: failed.map(f => ({
        severity: 'critical',
        service: f.name,
        message: `${f.name} is DOWN: ${f.error || f.statusText}`,
        url: f.url
      }))
    };
  }

  /**
   * Check specific service types
   */
  async checkService(type) {
    const serviceMap = {
      gateway: { name: 'OpenClaw Gateway', url: 'https://openclaw-gateway-2t9e.onrender.com/health' },
      orchestrator: { name: 'Central Orchestrator', url: 'https://central-orchestrator.onrender.com/health' },
      scheduler: { name: 'Devonn Scheduler', url: 'http://localhost:7373/health' }
    };
    
    const endpoint = serviceMap[type];
    if (!endpoint) {
      throw new Error(`Unknown service type: ${type}`);
    }
    
    return await this.checkEndpoint(endpoint);
  }
}

/**
 * Execute deployment check task
 */
export async function executeDeploymentCheck(payload) {
  const checker = new DeploymentChecker(payload);
  
  switch (payload.action) {
    case 'check_all':
      return await checker.checkAll(payload.endpoints);
    
    case 'check_service':
      return await checker.checkService(payload.service);
    
    case 'check_endpoint':
      return await checker.checkEndpoint({
        name: payload.name,
        url: payload.url
      });
    
    default:
      throw new Error(`Unknown action: ${payload.action}`);
  }
}

export { DeploymentChecker };
export default DeploymentChecker;
