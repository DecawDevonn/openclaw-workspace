import { Task } from '../queue/taskQueue.js';
import { healthGovernor } from '../core/healthGovernor.js';

interface Agent {
  type: string;
  execute: (payload: any) => Promise<any>;
}

class AgentRouter {
  private agents: Map<string, Agent> = new Map();
  
  constructor() {
    this.registerAgents();
  }
  
  private registerAgents(): void {
    // Web Agent
    this.agents.set('web', {
      type: 'web',
      execute: async (payload) => {
        console.log(`[WebAgent] Executing: ${payload.action || 'web task'}`);
        // Simulate web agent execution
        await this.simulateExecution(1000);
        return { status: 'success', agent: 'web', timestamp: Date.now() };
      }
    });
    
    // Terminal Agent
    this.agents.set('terminal', {
      type: 'terminal',
      execute: async (payload) => {
        console.log(`[TerminalAgent] Executing: ${payload.command || 'terminal task'}`);
        // Simulate terminal execution
        await this.simulateExecution(2000);
        return { status: 'success', agent: 'terminal', timestamp: Date.now() };
      }
    });
    
    // System Agent
    this.agents.set('system', {
      type: 'system',
      execute: async (payload) => {
        console.log(`[SystemAgent] Executing: ${payload.action || 'system task'}`);
        // Simulate system maintenance
        await this.simulateExecution(500);
        return { status: 'success', agent: 'system', timestamp: Date.now() };
      }
    });
    
    // Intelligence Agent
    this.agents.set('intelligence', {
      type: 'intelligence',
      execute: async (payload) => {
        console.log(`[IntelligenceAgent] Executing: ${payload.prompt || 'analysis task'}`);
        // Simulate LLM processing
        await this.simulateExecution(3000);
        return { status: 'success', agent: 'intelligence', timestamp: Date.now() };
      }
    });
    
    // Orchestrator Agent
    this.agents.set('orchestrator', {
      type: 'orchestrator',
      execute: async (payload) => {
        console.log(`[OrchestratorAgent] Executing: ${payload.workflow || 'workflow task'}`);
        // Simulate workflow orchestration
        await this.simulateExecution(5000);
        return { status: 'success', agent: 'orchestrator', timestamp: Date.now() };
      }
    });
  }
  
  private async simulateExecution(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async route(task: Task): Promise<any> {
    const agent = this.agents.get(task.type);
    
    if (!agent) {
      throw new Error(`No agent registered for type: ${task.type}`);
    }
    
    // Record API call for health tracking
    try {
      const result = await agent.execute(task.payload);
      healthGovernor.recordApiCall(true);
      return result;
    } catch (error) {
      healthGovernor.recordApiCall(false);
      throw error;
    }
  }
  
  register(type: string, agent: Agent): void {
    this.agents.set(type, agent);
    console.log(`[AgentRouter] Registered agent: ${type}`);
  }
  
  getRegisteredTypes(): string[] {
    return Array.from(this.agents.keys());
  }
}

export const agentRouter = new AgentRouter();
export default agentRouter;
