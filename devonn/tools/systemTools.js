/**
 * System Tools - Shell execution and system operations
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(execCallback);

/**
 * Execute a shell command
 */
export async function exec(command, options = {}) {
  console.log(`[SystemTools] Executing: ${command}`);
  
  const timeout = options.timeout || 30000;
  
  try {
    const { stdout, stderr } = await execAsync(command, { 
      timeout,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    });
    
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      command
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      command
    };
  }
}

/**
 * Check disk space
 */
export async function checkDiskSpace() {
  try {
    const result = await exec('df -h .');
    return {
      success: result.success,
      output: result.stdout
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cleanup old files
 */
export async function cleanupOldFiles(pattern, maxAge) {
  console.log(`[SystemTools] Cleaning up files matching ${pattern} older than ${maxAge}ms`);
  
  // Implementation would scan and delete old files
  return {
    success: true,
    cleaned: 0,
    pattern,
    maxAge
  };
}

/**
 * Get system info
 */
export async function getSystemInfo() {
  const os = await import('os');
  
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime()
  };
}
