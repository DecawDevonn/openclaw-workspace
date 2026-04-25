/**
 * Event Loop - Main execution pulse of the autonomous scheduler
 * Replaces cron with continuous, adaptive execution
 */

import { SchedulerBrain } from './schedulerBrain.js';

class EventLoop {
  constructor(config = {}) {
    this.config = {
      tickInterval: config.tickInterval || 2000,
      adaptiveInterval: config.adaptiveInterval !== false,
      minInterval: config.minInterval || 500,
      maxInterval: config.maxInterval || 30000,
      ...config
    };

    this.scheduler = new SchedulerBrain(this.config);
    this.running = false;
    this.stats = {
      ticks: 0,
      tasksExecuted: 0,
      avgTickDuration: 0,
      startTime: null
    };
  }

  /**
   * Start the event loop
   */
  async start() {
    if (this.running) {
      console.log('[EventLoop] Already running');
      return;
    }

    console.log('[EventLoop] Starting autonomous event loop...');
    this.running = true;
    this.stats.startTime = Date.now();

    // Initialize scheduler
    await this.scheduler.start();

    // Register event handlers
    this.scheduler.on('task:complete', (task) => {
      this.stats.tasksExecuted++;
      this.emitMetric('task.complete', task);
    });

    this.scheduler.on('task:fail', (task, error) => {
      this.emitMetric('task.fail', { task, error: error.message });
    });

    this.scheduler.on('system:stress', (level) => {
      this.emitMetric('system.stress', { level });
    });

    console.log('[EventLoop] Autonomous scheduler started');
    console.log(`[EventLoop] Tick interval: ${this.config.tickInterval}ms (adaptive: ${this.config.adaptiveInterval})`);
  }

  /**
   * Stop the event loop gracefully
   */
  async stop() {
    console.log('[EventLoop] Stopping event loop...');
    this.running = false;
    
    await this.scheduler.stop();
    
    const uptime = Date.now() - this.stats.startTime;
    console.log('[EventLoop] Stopped');
    console.log(`[EventLoop] Uptime: ${this.formatDuration(uptime)}`);
    console.log(`[EventLoop] Total ticks: ${this.stats.ticks}`);
    console.log(`[EventLoop] Tasks executed: ${this.stats.tasksExecuted}`);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      running: this.running,
      ...this.stats,
      scheduler: this.scheduler.getStatus(),
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0
    };
  }

  /**
   * Emit metric (for external monitoring)
   */
  emitMetric(name, data) {
    // This can be connected to monitoring systems
    // For now, just log important metrics
    if (name === 'task.fail') {
      console.log(`[Metric] ${name}:`, data.task.id, data.error);
    }
  }

  /**
   * Format duration as human-readable string
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Run a single tick (exposed for manual execution/testing)
   */
  async tick() {
    return this.scheduler.tick();
  }

  /**
   * Add task to scheduler
   */
  async addTask(taskSpec) {
    return this.scheduler.addTask(taskSpec);
  }
}

// Export singleton instance and class
let instance = null;

export function getEventLoop(config) {
  if (!instance) {
    instance = new EventLoop(config);
  }
  return instance;
}

export function resetEventLoop() {
  instance = null;
}

export { EventLoop };
