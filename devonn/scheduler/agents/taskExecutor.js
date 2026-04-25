/**
 * Task Executor - Agent Execution Engine
 * 
 * Executes tasks based on their type.
 * Routes to appropriate agent handlers.
 */

import { schedulerBrain } from "../core/schedulerBrain.js";
import { healthGovernor } from "../core/healthGovernor.js";

class TaskExecutor {
  constructor() {
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }

  /**
   * Register default task handlers
   */
  registerDefaultHandlers() {
    this.registerHandler('agent_run', this.handleAgentRun.bind(this));
    this.registerHandler('shell_command', this.handleShellCommand.bind(this));
    this.registerHandler('web_fetch', this.handleWebFetch.bind(this));
    this.registerHandler('api_call', this.handleApiCall.bind(this));
    this.registerHandler('notification', this.handleNotification.bind(this));
  }

  /**
   * Register a handler for a task type
   */
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * Execute a task
   */
  async execute(task) {
    const handler = this.handlers.get(task.type);
    
    if (!handler) {
      throw new Error(`No handler for task type: ${task.type}`);
    }

    schedulerBrain.markRunning(task.id);
    const startTime = Date.now();

    try {
      const result = await handler(task.payload);
      const duration = Date.now() - startTime;
      
      schedulerBrain.markCompleted(task.id, result);
      healthGovernor.recordExecution(true);
      
      return { success: true, result, duration };
      
    } catch (error) {
      healthGovernor.recordExecution(false);
      schedulerBrain.markFailed(task.id, error);
      throw error;
    }
  }

  /**
   * Handle agent_run tasks
   */
  async handleAgentRun(payload) {
    console.log(`🤖 Executing agent: ${payload.agent || 'default'}`);
    
    // Simulate agent execution
    await new Promise(resolve => setTimeout(resolve, payload.duration || 1000));
    
    return {
      agent: payload.agent,
      output: `Agent ${payload.agent} completed successfully`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle shell_command tasks
   */
  async handleShellCommand(payload) {
    console.log(`💻 Executing shell: ${payload.command}`);
    
    // In real implementation, this would use exec tool
    return {
      command: payload.command,
      output: "Command executed (simulated)",
      exitCode: 0
    };
  }

  /**
   * Handle web_fetch tasks
   */
  async handleWebFetch(payload) {
    console.log(`🌐 Fetching: ${payload.url}`);
    
    return {
      url: payload.url,
      status: 200,
      contentLength: 1024
    };
  }

  /**
   * Handle api_call tasks
   */
  async handleApiCall(payload) {
    console.log(`🔌 API call: ${payload.endpoint}`);
    
    return {
      endpoint: payload.endpoint,
      status: 200,
      data: {}
    };
  }

  /**
   * Handle notification tasks
   */
  async handleNotification(payload) {
    console.log(`📢 Notification: ${payload.message}`);
    
    return {
      channel: payload.channel,
      sent: true
    };
  }
}

export const taskExecutor = new TaskExecutor();
