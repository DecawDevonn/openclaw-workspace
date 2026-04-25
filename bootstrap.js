#!/usr/bin/env node
/**
 * bootstrap.js
 * Single entry point — The only cron job needed
 * Replaces all static cron with autonomous event-driven execution
 */

import { startEventLoop } from './core/eventLoop.js';
import { startHealthGovernor } from './core/healthGovernor.js';

async function bootstrap() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     MYCLAW AUTONOMOUS SCHEDULER OS v2.0               ║');
  console.log('║                                                        ║');
  console.log('║  Event-driven ✦ Self-healing ✦ Adaptive ✦ Learning   ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const config = {
    maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT || '5'),
    executionIntervalMs: parseInt(process.env.EXECUTION_INTERVAL || '2000'),
    enableLearning: process.env.ENABLE_LEARNING !== 'false'
  };
  
  try {
    const scheduler = await startEventLoop(config);
    const healthGovernor = startHealthGovernor();
    
    healthGovernor.start();
    
    process.on('SIGINT', () => {
      console.log('\n[ Bootstrap ] Shutdown signal received...');
      scheduler.stop();
      healthGovernor.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n[ Bootstrap ] Termination signal received...');
      scheduler.stop();
      healthGovernor.stop();
      process.exit(0);
    });
    
    console.log('[ Bootstrap ] System online. Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('[ Bootstrap ] Fatal error:', error.message);
    process.exit(1);
  }
}

bootstrap();
