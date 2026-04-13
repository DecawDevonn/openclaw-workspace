import { taskQueue, Task } from '../queue/taskQueue.js';
import { healthGovernor } from '../core/healthGovernor.js';

export interface SubmitTaskRequest {
  type: 'web' | 'terminal' | 'system' | 'intelligence' | 'orchestrator';
  priority?: number;
  payload: any;
  dependencies?: string[];
  maxRetries?: number;
}

export interface TaskStatusResponse {
  id: string;
  status: Task['status'];
  type: string;
  priority: number;
  retries: number;
  createdAt: number;
  lastRun: number | null;
  error?: string;
}

export interface SystemMetrics {
  health: {
    status: 'healthy' | 'degraded' | 'critical';
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
  };
  queue: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  };
}

class SchedulerAPI {
  async submitTask(request: SubmitTaskRequest): Promise<{ taskId: string; status: string }> {
    const task = await taskQueue.add({
      type: request.type,
      priority: request.priority ?? 5,
      payload: request.payload,
      dependencies: request.dependencies ?? [],
      maxRetries: request.maxRetries ?? 3,
      lastRun: null
    });
    
    return {
      taskId: task.id,
      status: task.status
    };
  }
  
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse | null> {
    const task = await taskQueue.getTask(taskId);
    if (!task) return null;
    
    return {
      id: task.id,
      status: task.status,
      type: task.type,
      priority: task.priority,
      retries: task.retries,
      createdAt: task.createdAt,
      lastRun: task.lastRun,
      error: task.error
    };
  }
  
  async getSystemMetrics(): Promise<SystemMetrics> {
    const health = healthGovernor.getMetrics();
    const queue = await taskQueue.getMetrics();
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (!health.isHealthy) {
      status = health.cpuUsage > 95 || health.memoryUsage > 95 ? 'critical' : 'degraded';
    }
    
    return {
      health: {
        status,
        cpuUsage: health.cpuUsage,
        memoryUsage: health.memoryUsage,
        uptime: health.uptime
      },
      queue
    };
  }
  
  async listTasks(status?: Task['status']): Promise<TaskStatusResponse[]> {
    const tasks = await taskQueue.getAllTasks();
    return tasks
      .filter(t => !status || t.status === status)
      .map(t => ({
        id: t.id,
        status: t.status,
        type: t.type,
        priority: t.priority,
        retries: t.retries,
        createdAt: t.createdAt,
        lastRun: t.lastRun,
        error: t.error
      }));
  }
  
  async cancelTask(taskId: string): Promise<boolean> {
    const task = await taskQueue.getTask(taskId);
    if (!task || task.status !== 'pending') {
      return false;
    }
    
    // Mark as dead to prevent execution
    task.status = 'dead';
    return true;
  }
}

export const schedulerAPI = new SchedulerAPI();
export default schedulerAPI;
