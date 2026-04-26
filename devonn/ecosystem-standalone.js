#!/usr/bin/env node
/**
 * DEVONN Ecosystem Connector - Standalone Mode
 * Runs just the ecosystem connector without the full scheduler
 * For use when scheduler is already running as a service
 */

import { EcosystemConnector } from './ecosystem-connector.js';

const connector = new EcosystemConnector();

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║           DEVONN.ai Ecosystem Connector                  ║');
console.log('║                    Standalone Mode                       ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log();

connector.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[Connector] Shutting down...');
  connector.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[Connector] Shutting down...');
  connector.stop();
  process.exit(0);
});
