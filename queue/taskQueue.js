import { EventEmitter } from 'events';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface Task {
  id: string;
  type: 'web' | 'terminal' | 'system' | 'intelligence' | 'orchestrator';
  priority: number; // 1-10, higher = more important
  status: 'pending' | 'running' | 'completed' | 'failed' | 'dead';
  retries: number;
  maxRetries: number;
  createdAt: number;
  lastRun: number | null;
  dependencies: string[];
  payload: any;
  result?: any;
  error?: string;
  retryDelay?: number;
}

class TaskQueue extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private queueDir: string;
  
  constructor() {
    super();
    this.queueDir = path.join(process.env.HOME || '/home/ubuntu', '.openclaw', 'queue');
    this.init();
  }
  
  private async init(): Promise<void> {
    if (!existsSync(this.queueDir)) {
      await mkdir(this.queueDir, { recursive: true });
    }
    await this.loadPersistedTasks();
  }
  
  private async loadPersistedTasks(): Promise<void> {
    try {
      const files = await readFile(path.join(this.queueDir, 'tasks.json'), 'utf-8')
        .then(data => JSON.parse(data))
        .catch(() => []);
      
      for (const task of files) {
        this.tasks.set(task.id, task);
      }
      console.log(`[TaskQueue] Loaded ${this.tasks.size} persisted tasks`);
    } catch (error) {
      console.log('[TaskQueue] No persisted tasks found');
    }
  }
  
  private async persist(): Promise<void> {
    const tasks = Array.from(this.tasks.values());
    await writeFile(
      path.join(this.queueDir, 'tasks.json'),
      JSON.stringify(tasks, null, 2)
    );
  }
  
  async add(task: Omit<Task, 'id' | 'createdAt' | 'retries' | 'status'>): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      retries: 0,
      status: 'pending',
      retryDelay: task.retryDelay || 1000
    };
    
    this.tasks.set(newTask.id, newTask);
    await this.persist();
    
    this.emit('task:added', newTask);
    console.log(`[TaskQueue] Added task ${newTask.id} (priority: ${newTask.priority})`);
    
    return newTask;
  }
  
  async getHighestPriority(limit: number = 10): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        // Priority first, then age (older = higher priority)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      })
      .slice(0, limit);
  }
  
  async markRunning(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'running';
      task.lastRun = Date.now();
      await this.persist();
      this.emit('task:running', task);
    }
  }
  
  async markCompleted(id: string, result: any): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'completed';
      task.result = result;
      await this.persist();
      this.emit('task:completed', task);
      console.log(`[TaskQueue] Task ${id} completed`);
    }
  }
  
  async markFailed(id: string, error: Error): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.retries++;
      task.error = error.message;
      
      if (task.retries >= task.maxRetries) {
        task.status = 'dead';
        await deadLetterQueue.add(task);
        this.emit('task:dead', task);
        console.log(`[TaskQueue] Task ${id} moved to dead letter queue`);
      } else {
        // Exponential backoff
        task.retryDelay = (task.retryDelay || 1000) * 2;
        task.priority = Math.min(task.priority + 1, 10); // Boost priority
        task.status = 'pending';
        this.emit('task:retry', task);
        console.log(`[TaskQueue] Task ${id} retry ${task.retries}/${task.maxRetries} in ${task.retryDelay}ms`);
      }
      
      await this.persist();
    }
  }
  
  async checkDependencies(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task || !task.dependencies?.length) return true;
    
    return task.dependencies.every(depId => {
      const dep = this.tasks.get(depId);
      return dep?.status === 'completed';
    });
  }
  
  async getRunningCount(type?: string): Promise<number> {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'running' && (!type || t.type === type))
      .length;
  }
  
  async getMetrics(): Promise<any> {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'dead').length,
      byType: {
        web: tasks.filter(t => t.type === 'web').length,
        terminal: tasks.filter(t => t.type === 'terminal').length,
        system: tasks.filter(t => t.type === 'system').length,
        intelligence: tasks.filter(t => t.type === 'intelligence').length,
        orchestrator: tasks.filter(t => t.type === 'orchestrator').length
      }
    };
  }
  
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }
  
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
}

// Dead Letter Queue for failed tasks
class DeadLetterQueue {
  private tasks: Task[] = [];
  private dlqPath: string;
  
  constructor() {
    this.dlqPath = path.join(process.env.HOME || '/home/ubuntu', '.openclaw', 'queue', 'deadletter.json');
    this.load();
  }
  
  private async load(): Promise<void> {
    try {
      const data = await readFile(this.dlqPath, 'utf-8');
      this.tasks = JSON.parse(data);
    } catch {
      this.tasks = [];
    }
  }
  
  async add(task: Task): Promise<void> {
    this.tasks.push({
      ...task,
      failedAt: Date.now()
    });
    await writeFile(this.dlqPath, JSON.stringify(this.tasks, null, 2));
  }
  
  getAll(): Task[] {
    return this.tasks;
  }
}

export const deadLetterQueue = new DeadLetterQueue();
export const taskQueue = new TaskQueue();
export default taskQueue;
