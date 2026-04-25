# 🧠 DEVONN.ai Autonomous Scheduler OS v2

> Self-managing execution brain that schedules, prioritizes, retries, heals, and learns from failures.

---

## ⚡ Core Shift: Cron → Autonomous

| Before (Cron) | After (Autonomous OS) |
|---------------|----------------------|
| Fixed time schedules | Event-driven execution |
| Static intervals | Priority-based queue |
| Blind execution | Health-aware scheduling |
| Manual retries | Self-healing retry graph |
| No failure memory | Dead letter queue + learning |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SCHEDULER BRAIN                      │
│              (Central Decision Engine)                  │
└────────────────────┬────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│  Event  │    │ Health  │    │  Self   │
│  Loop   │    │Governor │    │ Healing │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    ▼
           ┌─────────────────┐
           │   Task Queue    │
           └────────┬────────┘
                    ▼
           ┌─────────────────┐
           │  Task Executor  │
           └─────────────────┘
```

---

## 📁 File Structure

```
devonn/scheduler/
├── bootstrap.js              # Single entry point
├── package.json
├── core/
│   ├── schedulerBrain.js     # Central intelligence
│   ├── eventLoop.js          # Continuous execution pulse
│   └── healthGovernor.js     # System health monitor
├── queue/
│   ├── taskQueue.js          # Task queue management
│   └── deadLetterQueue.js    # Failure memory
├── agents/
│   ├── taskExecutor.js       # Task execution engine
│   └── selfHealing.js        # Failure recovery
└── analytics/
    └── schedulerInsights.js  # Learning layer
```

---

## 🚀 Quick Start

```bash
# Start the autonomous scheduler
cd devonn/scheduler
node bootstrap.js

# Or with auto-reload during development
npm run dev
```

---

## 🔄 Task Lifecycle

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ PENDING │ → │ RUNNING │ → │COMPLETED│    │  DLQ    │
└────┬────┘    └────┬────┘    └─────────┘    └─────────┘
     │              │
     │              ↓
     │         ┌─────────┐
     └────────→│ FAILED  │
               └────┬────┘
                    │
                    ↓ (retry < max)
               ┌─────────┐
               │ PENDING │ (priority + delay)
               └─────────┘
```

---

## 🛠️ Registering Tasks

```javascript
import { schedulerBrain } from "./core/schedulerBrain.js";

// Register a task
schedulerBrain.registerTask({
  id: "daily_report",
  type: "agent_run",
  priority: 7,
  maxRetries: 3,
  nextRun: Date.now() + 60000, // Run in 1 minute
  payload: {
    agent: "intelligence",
    action: "generate_report"
  }
});
```

---

## 📊 Health Monitoring

The Health Governor monitors:
- CPU usage (>85% = critical)
- Memory pressure (>90% = critical)
- Failure rates (>25% = critical)
- Queue backlog

When stressed, the system automatically throttles execution.

---

## 🩹 Self-Healing

Failed tasks are automatically:
1. Analyzed for failure type
2. Retried with exponential backoff
3. Given priority boost
4. Adjusted (timeout increased, etc.)
5. Escalated to DLQ after max retries

---

## 📈 Intelligence Layer

Tracks:
- Slowest task types
- Highest failure rates
- System bottlenecks
- Optimal execution timing

Generates recommendations for continuous improvement.

---

## 🔥 Minimal Cron Setup

Only ONE cron job needed:

```bash
* * * * * cd ~/devonn/scheduler && node bootstrap.js
```

Everything else is handled by the autonomous system.

---

## 🧬 Next Level: Distributed AI OS

To extend to multi-node:
1. Add Redis for distributed queue
2. Implement worker nodes
3. Add DAG-based execution
4. Build visual control panel
5. Enable GPT-driven task planning

---

*Built for Devonn.ai by Devonn.ai*
