#!/usr/bin/env node
/**
 * DEVONN.ai - Bootstrap
 * 
 * Single entry point for the autonomous scheduler OS.
 * Replaces multiple cron jobs with one bootstrap that starts the event-driven system.
 */

import { SchedulerBrain } from './core/schedulerBrain.js';
import { HealthGovernor } from './core/healthGovernor.js';
import { EcosystemConnector } from './ecosystem-connector.js';
import { DashboardAPI } from './api-server.js';

// Configuration
const CONFIG = {
  tickInterval: parseInt(process.env.DEVONN_TICK_INTERVAL) || 2000,
  maxConcurrentTasks: parseInt(process.env.DEVONN_MAX_CONCURRENT) || 5,
  defaultTimeout: parseInt(process.env.DEVONN_DEFAULT_TIMEOUT) || 300000,
  dataPath: process.env.DEVONN_DATA_PATH || './data'
};

// Global state
let scheduler = null;
let ecosystemConnector = null;
let dashboardAPI = null;
let isShuttingDown = false;

/**
 * Initialize and start the system
 */
async function bootstrap() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           DEVONN.ai Autonomous Scheduler OS              ║');
  console.log('║                    Version 2.0.0                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('[Bootstrap] Starting initialization...');
  
  try {
    // Create scheduler brain
    scheduler = new SchedulerBrain(CONFIG);
    
    // Wire up event handlers
    scheduler.on('started', () => {
      console.log('[Bootstrap] Scheduler running');
      console.log('[Bootstrap] Event loop active (tick: ' + CONFIG.tickInterval + 'ms)');
    });
    
    scheduler.on('task:complete', (task) => {
      console.log(`[Bootstrap] ✓ Task completed: ${task.id} (${task.duration}ms)`);
    });
    
    scheduler.on('task:fail', (task, error) => {
      console.log(`[Bootstrap] ✗ Task failed: ${task.id} - ${error.message}`);
    });
    
    scheduler.on('error', (error) => {
      console.error('[Bootstrap] Scheduler error:', error);
    });
    
    // Start the scheduler (initializes and starts event loop)
    await scheduler.start();
    
    // Schedule some initial system tasks
    // Note: Using scheduler.addTask API
    await scheduleInitialTasks(scheduler);
    
    // Connect to Devonn Ecosystem if enabled
    if (process.env.ENABLE_ECOSYSTEM === 'true') {
      console.log('[Bootstrap] Connecting to Devonn Ecosystem...');
      ecosystemConnector = new EcosystemConnector(scheduler);
      global.ecosystemConnector = ecosystemConnector;
      await ecosystemConnector.start();
      console.log('[Bootstrap] Ecosystem connected');
    }
    
    // Start Dashboard API
    console.log('[Bootstrap] Starting Dashboard API...');
    dashboardAPI = new DashboardAPI(scheduler);
    dashboardAPI.start();
    
    console.log('[Bootstrap] System fully operational');
    
  } catch (error) {
    console.error('[Bootstrap] Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Schedule initial system tasks
 */
async function scheduleInitialTasks(scheduler) {
  // System health check (runs every minute)
  await scheduler.addTask({
    type: 'system_check',
    priority: 8,
    payload: {
      action: 'health_check',
      recurring: true,
      interval: 60000
    }
  });
  
  // Metrics collection (runs every 5 minutes)
  await scheduler.addTask({
    type: 'metrics_collection',
    priority: 5,
    payload: {
      action: 'metrics',
      recurring: true,
      interval: 300000
    }
  });
  
  console.log('[Bootstrap] Initial tasks scheduled');
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log();
  console.log(`[Bootstrap] Received ${signal}. Shutting down gracefully...`);
  
  if (dashboardAPI) {
    dashboardAPI.stop();
  }
  if (ecosystemConnector) {
    ecosystemConnector.stop();
  }
  if (scheduler) {
    scheduler.stop();
  }
  
  console.log('[Bootstrap] Shutdown complete');
  process.exit(0);
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Bootstrap] Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Bootstrap] Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the system
bootstrap();
