/**
 * Health Governor - System Health Monitor
 * 
 * Monitors system health and adjusts execution accordingly.
 * Prevents overload and maintains system stability.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const THRESHOLDS = {
  CPU_WARNING: 70,
  CPU_CRITICAL: 85,
  MEMORY_WARNING: 80,
  MEMORY_CRITICAL: 90,
  FAILURE_RATE_WARNING: 0.1,
  FAILURE_RATE_CRITICAL: 0.25
};

class HealthGovernor {
  constructor() {
    this.metrics = {
      cpu: 0,
      memory: 0,
      failureRate: 0,
      queueDepth: 0,
      apiFailures: 0
    };
    this.status = 'healthy';
    this.monitoring = false;
    this.checkInterval = null;
    this.recentExecutions = [];
    this.maxHistory = 100;
  }

  async start() {
    if (this.monitoring) return;
    console.log("🩺 Health Governor starting...");
    this.monitoring = true;
    await this.checkHealth();
    this.checkInterval = setInterval(() => this.checkHealth(), 10000);
    console.log("   Health monitoring active (10s interval)");
  }

  stop() {
    this.monitoring = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("🛑 Health Governor stopped");
  }

  async checkHealth() {
    try {
      this.metrics.cpu = await this.getCPUUsage();
      this.metrics.memory = await this.getMemoryUsage();
      this.metrics.failureRate = this.calculateFailureRate();
      this.updateStatus();

      if (this.status !== 'healthy') {
        console.log(`⚠️  Health: ${this.status.toUpperCase()} | CPU: ${this.metrics.cpu}% | Memory: ${this.metrics.memory}%`);
      }
    } catch (error) {
      console.error("❌ Health check failed:", error.message);
    }
  }

  async getCPUUsage() {
    try {
      const { stdout } = await execAsync("cat /proc/loadavg | awk '{print $1}'");
      const load = parseFloat(stdout.trim());
      return Math.min((load / 4) * 100, 100);
    } catch {
      return 0;
    }
  }

  async getMemoryUsage() {
    try {
      const { stdout } = await execAsync("free | grep Mem | awk '{print ($3/$2) * 100.0}'");
      const usage = parseFloat(stdout.trim());
      return isNaN(usage) ? 0 : usage;
    } catch {
      return 0;
    }
  }

  calculateFailureRate() {
    if (this.recentExecutions.length === 0) return 0;
    const failures = this.recentExecutions.filter(e => !e.success).length;
    return failures / this.recentExecutions.length;
  }

  recordExecution(success) {
    this.recentExecutions.push({ success, timestamp: Date.now() });
    if (this.recentExecutions.length > this.maxHistory) {
      this.recentExecutions.shift();
    }
  }

  updateStatus() {
    const { cpu, memory, failureRate } = this.metrics;
    if (cpu > THRESHOLDS.CPU_CRITICAL || memory > THRESHOLDS.MEMORY_CRITICAL || failureRate > THRESHOLDS.FAILURE_RATE_CRITICAL) {
      this.status = 'critical';
    } else if (cpu > THRESHOLDS.CPU_WARNING || memory > THRESHOLDS.MEMORY_WARNING || failureRate > THRESHOLDS.FAILURE_RATE_WARNING) {
      this.status = 'warning';
    } else {
      this.status = 'healthy';
    }
  }

  getHealth() {
    return {
      status: this.status,
      metrics: { ...this.metrics },
      timestamp: new Date().toISOString()
    };
  }
}

export const healthGovernor = new HealthGovernor();
export const startHealthGovernor = () => healthGovernor.start();
