import { taskQueue, Task } from '../queue/taskQueue.js';
import { healthGovernor } from './healthGovernor.js';
import { agentRouter } from '../agents/agentRouter.js';

export class EventLoop {
  private running: boolean = false;
  private loopId: NodeJS.Timeout | null = null;
  
  async start(): Promise<void> {
    if (this.running) return;
    
    this.running = true;
    console.log('[EventLoop] Starting autonomous execution loop...');
    
    // Start health governor
    healthGovernor.start();
    
    // Start the loop
    this.loop();
  }
  
  private async loop(): Promise<void> {
    if (!this.running) return;
    
    try {
      // Check system health - pause if critical
      const stressLevel = healthGovernor.getStressLevel();
      if (stressLevel === 'critical') {
        console.log('[EventLoop] System under critical stress - pausing execution');
        this.loopId = setTimeout(() => this.loop(), 15000);
        return;
      }
      
      // Get highest priority tasks
      const tasks = await taskQueue.getHighestPriority(5);
      
      for (const task of tasks) {
        if (!this.running) break;
        
        // Check if task can run
        if (await this.canExecute(task)) {
          this.executeTask(task);
        }
      }
      
      // Adaptive interval based on system health
      const interval = healthGovernor.isHealthy() ? 2000 : 5000;
      this.loopId = setTimeout(() => this.loop(), interval);
      
    } catch (error) {
      console.error('[EventLoop] Loop error:', error);
      this.loopId = setTimeout(() => this.loop(), 10000);
    }
  }
  
  private async canExecute(task: Task): Promise<boolean> {
    // Check dependencies
    if (task.dependencies?.length > 0) {
      const depsCompleted = await taskQueue.checkDependencies(task.id);
      if (!depsCompleted) return false;
    }
    
    // Check system health
    if (!healthGovernor.isHealthy() && task.priority < 8) {
      return false;
    }
    
    // Check concurrency limits
    const runningCount = await taskQueue.getRunningCount(task.type);
    const maxConcurrency = this.getMaxConcurrency(task.type);
    
    return runningCount < maxConcurrency;
  }
  
  private getMaxConcurrency(type: string): number {
    const limits: Record<string, number> = {
      'web': 5,
      'terminal': 3,
      'system': 2,
      'intelligence': 10,
      'orchestrator': 3
    };
    return limits[type] || 3;
  }
  
  private async executeTask(task: Task): Promise<void> {
    try {
      await taskQueue.markRunning(task.id);
      
      console.log(`[EventLoop] Executing task ${task.id} (${task.type})`);
      
      // Route to appropriate agent
      const result = await agentRouter.route(task);
      
      await taskQueue.markCompleted(task.id, result);
      
    } catch (error) {
      console.error(`[EventLoop] Task ${task.id} failed:`, error);
      await taskQueue.markFailed(task.id, error as Error);
    }
  }
  
  async stop(): Promise<void> {
    this.running = false;
    if (this.loopId) {
      clearTimeout(this.loopId);
    }
    healthGovernor.stop();
    console.log('[EventLoop] Stopped');
  }
}

export const eventLoop = new EventLoop();
export default eventLoop;
