/**
 * bootstrap.js — The Only Entry Point
 * 
 * Minimal bootstrap that starts the health governor and event loop.
 * This is the only file that needs to be called to start the entire system.
 */

import { startHealthGovernor } from './core/healthGovernor.js';
import { getEventLoop } from './core/eventLoop.js';

// Global reference for graceful shutdown
let eventLoop = null;

async function bootstrap() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     MYCLAW AUTONOMOUS SCHEDULER OS v2.0                 ║');
  console.log('║     Self-Managing Execution Brain                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  
  try {
    // Start health governor first
    console.log('[BOOTSTRAP] Starting Health Governor...');
    const governor = startHealthGovernor();
    
    // Start the event loop (the brain)
    console.log('[BOOTSTRAP] Starting Event Loop...');
    eventLoop = getEventLoop();
    await eventLoop.start();
    
    // Register a sample task to demonstrate the system is working
    const testTaskId = await eventLoop.brain.submitTask({
      type: 'system',
      priority: 5,
      payload: {
        action: 'health_check'
      }
    });
    
    console.log(`[BOOTSTRAP] Registered test task: ${testTaskId}`);
    console.log('[BOOTSTRAP] System is running. Press Ctrl+C to stop.');
    console.log();
    
    // Set up graceful shutdown
    setupGracefulShutdown();
    
  } catch (error) {
    console.error('[BOOTSTRAP] Failed to start:', error.message);
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log();
    console.log(`[SHUTDOWN] Received ${signal}, stopping gracefully...`);
    
    try {
      if (eventLoop) {
        await eventLoop.stop();
      }
      
      console.log('[SHUTDOWN] System stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('[SHUTDOWN] Error during shutdown:', error.message);
      process.exit(1);
    }
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
}

// Start the system
bootstrap();

export { bootstrap };
export default bootstrap;
