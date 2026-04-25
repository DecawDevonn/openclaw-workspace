/**
 * terminalAgent.js
 * Terminal Agent — Shell command execution, file operations, git
 */

export class TerminalAgent {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 300000,
      shell: config.shell || '/bin/bash',
      cwd: config.cwd || process.cwd(),
      ...config
    };
    this.metrics = { runs: 0, successes: 0, failures: 0 };
  }

  async execute(payload) {
    this.metrics.runs++;
    
    const { command, args = [], cwd = this.config.cwd, env = {} } = payload;
    
    if (!command) {
      throw new Error('No command specified');
    }
    
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    
    console.log(`[TerminalAgent] Executing: ${fullCommand.substring(0, 100)}...`);
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const result = await execAsync(fullCommand, {
        cwd,
        env: { ...process.env, ...env },
        timeout: this.config.timeout,
        shell: this.config.shell
      });
      
      this.metrics.successes++;
      
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        executionTime: Date.now()
      };
      
    } catch (error) {
      this.metrics.failures++;
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

export function createAgent(config) {
  return new TerminalAgent(config);
}

export default TerminalAgent;
