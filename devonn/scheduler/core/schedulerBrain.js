/**
 * Scheduler Brain - Central Intelligence
 * 
 * Holds all tasks, assigns priority, decides what runs next.
 * The core decision-making engine of the autonomous scheduler.
 */

class SchedulerBrain {
  constructor() {
    this.tasks = new Map();
    this.agents = new Map();
    this.running = false;
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksRetried: 0,
      avgProcessingTime: 0
    };
  }

  /**
   * Register a new task with the scheduler
   */
  registerTask(taskConfig) {
    const task = {
      id: taskConfig.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: taskConfig.type || 'generic',
      priority: taskConfig.priority || 5,
      status: 'pending',
      retries: 0,
      maxRetries: taskConfig.maxRetries || 5,
      lastRun: null,
      nextRun: taskConfig.nextRun || Date.now(),
      dependencies: taskConfig.dependencies || [],
      payload: taskConfig.payload || {},
      createdAt: Date.now(),
      executionHistory: [],
      ...taskConfig
    };

    this.tasks.set(task.id, task);
    console.log(`📋 Task registered: ${task.id} (priority: ${task.priority})`);
    return task.id;
  }

  /**
   * Get highest priority tasks ready for execution
   */
  getExecutableTasks(limit = 5) {
    const now = Date.now();
    const executable = [];

    for (const task of this.tasks.values()) {
      if (task.status === 'pending' && 
          task.nextRun <= now && 
          this.areDependenciesResolved(task)) {
        executable.push(task);
      }
    }

    // Sort by priority (highest first), then by nextRun (earliest first)
    executable.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.nextRun - b.nextRun;
    });

    return executable.slice(0, limit);
  }

  /**
   * Check if all task dependencies are resolved
   */
  areDependenciesResolved(task) {
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Mark task as running
   */
  markRunning(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'running';
      task.lastRun = Date.now();
      task.executionHistory.push({
        startedAt: Date.now(),
        status: 'started'
      });
    }
  }

  /**
   * Mark task as completed
   */
  markCompleted(taskId, result) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      const exec = task.executionHistory[task.executionHistory.length - 1];
      if (exec) {
        exec.completedAt = Date.now();
        exec.duration = exec.completedAt - exec.startedAt;
        exec.result = result;
      }
      this.metrics.tasksCompleted++;
      this.updateAvgProcessingTime(exec?.duration || 0);
      console.log(`✅ Task completed: ${taskId}`);
    }
  }

  /**
   * Mark task as failed
   */
  markFailed(taskId, error) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      const exec = task.executionHistory[task.executionHistory.length - 1];
      if (exec) {
        exec.failedAt = Date.now();
        exec.error = error.message;
      }
      this.metrics.tasksFailed++;
      console.log(`❌ Task failed: ${taskId} - ${error.message}`);
    }
  }

  /**
   * Update average processing time
   */
  updateAvgProcessingTime(duration) {
    const total = this.metrics.avgProcessingTime * (this.metrics.tasksCompleted - 1) + duration;
    this.metrics.avgProcessingTime = total / this.metrics.tasksCompleted;
  }

  /**
   * Get system status snapshot
   */
  getStatus() {
    const pending = Array.from(this.tasks.values()).filter(t => t.status === 'pending').length;
    const running = Array.from(this.tasks.values()).filter(t => t.status === 'running').length;
    const completed = Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
    const failed = Array.from(this.tasks.values()).filter(t => t.status === 'failed').length;

    return {
      running: this.running,
      tasks: { pending, running, completed, failed, total: this.tasks.size },
      metrics: { ...this.metrics },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    console.log("🧠 Scheduler Brain shutting down...");
    this.running = false;
    
    // Wait for running tasks to complete (with timeout)
    const running = Array.from(this.tasks.values()).filter(t => t.status === 'running');
    if (running.length > 0) {
      console.log(`   Waiting for ${running.length} running tasks...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log("✅ Scheduler Brain stopped");
  }
}

export const schedulerBrain = new SchedulerBrain();
