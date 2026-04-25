/**
 * MyClaw Autonomous Scheduler OS - Bootstrap
 * 
 * The only entry point. Starts the autonomous execution brain.
 * Replaces static cron with event-driven, self-healing orchestration.
 */

import { startEventLoop } from "./core/eventLoop.js";
import { startHealthGovernor } from "./core/healthGovernor.js";
import { schedulerBrain } from "./core/schedulerBrain.js";
import { taskQueue } from "./queue/taskQueue.js";
import { selfHealingEngine } from "./agents/selfHealing.js";
import { schedulerInsights } from "./analytics/schedulerInsights.js";

console.log("🧠 MyClaw Autonomous Scheduler OS v2.0");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Initialize core systems
async function bootstrap() {
  try {
    // Start health monitoring first
    console.log("[1/5] Starting Health Governor...");
    await startHealthGovernor();
    
    // Initialize task queue
    console.log("[2/5] Initializing Task Queue...");
    await taskQueue.initialize();
    
    // Start self-healing engine
    console.log("[3/5] Starting Self-Healing Engine...");
    await selfHealingEngine.start();
    
    // Initialize analytics
    console.log("[4/5] Starting Intelligence Layer...");
    await schedulerInsights.initialize();
    
    // Start the main event loop
    console.log("[5/5] Starting Event Loop...");
    await startEventLoop();
    
    console.log("\n✅ Autonomous Scheduler OS is running");
    console.log("   Event-driven | Self-healing | Adaptive\n");
    
  } catch (error) {
    console.error("❌ Bootstrap failed:", error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  await schedulerBrain.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  await schedulerBrain.shutdown();
  process.exit(0);
});

// Start the system
bootstrap();
