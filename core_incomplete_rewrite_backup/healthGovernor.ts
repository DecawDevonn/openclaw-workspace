import { EventEmitter } from 'events';
import os from 'os';

interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  freeMemory: number;
  loadAverage: number[];
  apiFailures: number;
  lastCheck: number;
}

interface HealthThresholds {
  maxCpuPercent: number;
  maxMemoryPercent: number;
  maxLoadAverage: number;
  maxApiFailureRate: number;
}

class HealthGovernor extends EventEmitter {
  private metrics: HealthMetrics;
  private thresholds: HealthThresholds;
  private checkInterval: NodeJS.Timeout | null = null;
  private startTime: number;
  private apiCallCount: number = 0;
  private apiFailureCount: number = 0;
  
  constructor() {
    super();
    this.startTime = Date.now();
    this.thresholds = {
      maxCpuPercent: 85,
      maxMemoryPercent: 90,
      maxLoadAverage: os.cpus().length * 2,
      maxApiFailureRate: 0.1 // 10%
    };
    
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
      apiFailures: 0,
      lastCheck: Date.now()
    };
  }
  
  start(): void {
    console.log('[HealthGovernor] Starting health monitoring...');
    this.checkInterval = setInterval(() => this.checkHealth(), 5000);
    this.checkHealth(); // Initial check
  }
  
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[HealthGovernor] Stopped');
  }
  
  private checkHealth(): void {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercent = (usedMem / totalMem) * 100;
    
    // Calculate CPU usage (simplified - would need more sophisticated measurement for accuracy)
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuPercent = Math.min((loadAvg / cpuCount) * 100, 100);
    
    // Calculate API failure rate
    const apiFailureRate = this.apiCallCount > 0 
      ? this.apiFailureCount / this.apiCallCount 
      : 0;
    
    this.metrics = {
      cpuUsage: cpuPercent,
      memoryUsage: memoryPercent,
      totalMemory: totalMem,
      freeMemory: freeMem,
      loadAverage: os.loadavg(),
      apiFailures: apiFailureRate,
      lastCheck: Date.now()
    };
    
    // Check thresholds and emit warnings
    if (cpuPercent > this.thresholds.maxCpuPercent) {
      this.emit('health:warning', { type: 'cpu', value: cpuPercent, threshold: this.thresholds.maxCpuPercent });
    }
    
    if (memoryPercent > this.thresholds.maxMemoryPercent) {
      this.emit('health:warning', { type: 'memory', value: memoryPercent, threshold: this.thresholds.maxMemoryPercent });
    }
    
    if (apiFailureRate > this.thresholds.maxApiFailureRate) {
      this.emit('health:warning', { type: 'api', value: apiFailureRate, threshold: this.thresholds.maxApiFailureRate });
    }
    
    this.emit('health:check', this.metrics);
  }
  
  isHealthy(): boolean {
    return (
      this.metrics.cpuUsage < this.thresholds.maxCpuPercent &&
      this.metrics.memoryUsage < this.thresholds.maxMemoryPercent &&
      this.metrics.apiFailures < this.thresholds.maxApiFailureRate
    );
  }
  
  getStressLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const { cpuUsage, memoryUsage } = this.metrics;
    
    if (cpuUsage > 95 || memoryUsage > 95) return 'critical';
    if (cpuUsage > 85 || memoryUsage > 90) return 'high';
    if (cpuUsage > 70 || memoryUsage > 80) return 'medium';
    return 'low';
  }
  
  recordApiCall(success: boolean): void {
    this.apiCallCount++;
    if (!success) {
      this.apiFailureCount++;
    }
    
    // Reset counters periodically to prevent unbounded growth
    if (this.apiCallCount > 1000) {
      this.apiCallCount = Math.floor(this.apiCallCount / 2);
      this.apiFailureCount = Math.floor(this.apiFailureCount / 2);
    }
  }
  
  getMetrics(): HealthMetrics & { uptime: number; isHealthy: boolean } {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      isHealthy: this.isHealthy()
    };
  }
}

export const healthGovernor = new HealthGovernor();
export default healthGovernor;
