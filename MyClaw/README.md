# MYCLAW Autonomous Scheduler OS v2.0

> A self-managing execution brain that schedules, prioritizes, retries, heals, and learns from failures.

## 🎯 What This Is

This system upgrades from **static cron-based automation** to a **real autonomous orchestration system**:

| Before (Cron) | After (MyClaw OS) |
|---------------|-------------------|
| Fixed time schedules | Event-driven task engine |
| Blind execution | Priority queue with health awareness |
| No memory of failures | Self-healing retry graph |
| Static intervals | Adaptive timing based on system state |
| Fragile restarts | Persistent state and recovery |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    QUEUE LAYER                          │
│              (Tasks waiting to execute)                 │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │  WEB    │  │ TERMINAL│  │ SYSTEM  │
   │  AGENT  │  │  AGENT  │  │  AGENT  │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   EXECUTION ENGINE                      │
│         (Self-Healing, Retry, Learning)                 │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
MyClaw/
├── bootstrap.js              # Main entry point - starts everything
├── package.json              # NPM configuration
│
├── core/
│   ├── schedulerBrain.js     # Central brain - task management
│   ├── eventLoop.js          # Main execution loop
│   └── healthGovernor.js     # System health monitoring
│
├── queue/
│   ├── taskQueue.js          # Active task queue
│   └── deadLetterQueue.js    # Failed task storage
│
├── agents/
│   ├── executor.js           # Task execution router
│   └── selfHealing.js        # Auto-retry and recovery
│
└── analytics/
    └── schedulerInsights.js  # Learning and optimization
```

---

## 🚀 Quick Start

### 1. Start the System

```bash
cd ~/MyClaw
node bootstrap.js
```

### 2. Submit a Task

```javascript
import { getEventLoop } from './core/eventLoop.js';

const eventLoop = getEventLoop();

const taskId = await eventLoop.brain.submitTask({
  type: 'system',
  priority: 8,
  payload: {
    action: 'health_check'
  }
});

console.log('Task submitted:', taskId);
```

### 3. Check System Status

```bash
# View queue statistics
npm run queue:stats

# View dead letter queue
npm run dlq:inspect

# View insights and recommendations
npm run insights
```

---

## 🧠 Core Concepts

### Task Object

```javascript
{
  id: "task_1234567890_abc123",     // Unique ID
  type: "web",                       // Agent type
  priority: 8,                       // 1-10 (higher = more urgent)
  status: "pending",                 // pending|running|completed|failed
  retries: 0,                        // Current retry count
  maxRetries: 5,                     // Max retries before DLQ
  dependencies: [],                  // Task IDs that must complete first
  payload: {                         // Task-specific data
    url: "https://api.example.com",
    method: "GET"
  }
}
```

### Agent Types

| Type | Purpose | Example |
|------|---------|---------|
| `web` | HTTP/API calls | Fetch data from APIs |
| `terminal` | Shell commands | Run scripts, deploy code |
| `system` | Maintenance | Health checks, cleanup |
| `intelligence` | Analysis | Summarize, classify data |
| `orchestrator` | Multi-step | Coordinate workflows |

### Priority Levels

| Priority | Use Case |
|----------|----------|
| 10 | Critical - immediate execution |
| 8-9 | High priority tasks |
| 5-7 | Normal tasks (default) |
| 3-4 | Low priority, can wait |
| 1-2 | Background maintenance |

---

## 🩺 Health Governor

The system monitors:

- **CPU usage** → Slows execution if >85%
- **Memory pressure** → Pauses if >90%
- **API failures** → Throttles if rate limited
- **Queue backlog** → Scales workers if needed
- **Agent crash rate** → Escalates if >20%

### Adaptive Behavior

```
Health: HEALTHY   → Run 5 concurrent tasks
Health: WARNING   → Reduce to 2 concurrent tasks
Health: CRITICAL  → Pause non-critical tasks
```

---

## 🔄 Self-Healing

### Retry Strategies

| Error Type | Strategy |
|------------|----------|
| `TIMEOUT` | Retry with exponential backoff (max 30s) |
| `RATE_LIMIT` | Wait 1+ minutes, increase priority |
| `NETWORK` | Quick retry (max 10s delay) |
| `AUTH` | No retry - escalate immediately |
| `PARSE` | No retry - escalate immediately |

### Dead Letter Queue

Tasks that fail after max retries are moved to the DLQ with:
- Full retry history
- Root cause analysis
- Suggested corrections

---

## 📊 Intelligence Layer

The system learns from:

- Which tasks fail most often
- Optimal execution timing
- System bottlenecks
- Resource usage patterns

### Recommendations

```javascript
[
  {
    type: "high_failure_rate",
    severity: "critical",
    message: "Task type 'web' has 35% failure rate",
    suggestion: "Review dependencies and error logs"
  }
]
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Data directory (default: ~/.myclaw/data)
MYCLAW_DATA_DIR=/path/to/data

# Max concurrent tasks (default: 5)
MYCLAW_MAX_CONCURRENT=5

# Tick interval in ms (default: 2000)
MYCLAW_TICK_INTERVAL=2000

# Health check interval in ms (default: 5000)
MYCLAW_HEALTH_INTERVAL=5000
```

### SchedulerBrain Config

```javascript
{
  maxConcurrentTasks: 5,
  defaultPriority: 5,
  maxRetries: 5,
  baseRetryDelay: 1000,  // 1 second
  healthCheckInterval: 5000,
  executionInterval: 2000
}
```

---

## 📈 Monitoring

### Real-time Metrics

```javascript
const metrics = eventLoop.brain.getMetrics();
// {
//   tasksCompleted: 1523,
//   tasksFailed: 23,
//   tasksRetried: 45,
//   avgExecutionTime: 12400,
//   activeTasks: 3,
//   pendingTasks: 12,
//   health: { status: "healthy", ... }
// }
```

### Queue Statistics

```javascript
const stats = await eventLoop.brain.taskQueue.getStats();
// {
//   total: 45,
//   pending: 12,
//   running: 3,
//   completed: 28,
//   failed: 2
// }
```

---

## 🔥 Advanced Usage

### Dependencies

```javascript
const taskA = await eventLoop.brain.submitTask({
  type: 'web',
  priority: 5,
  payload: { url: 'https://api.example.com/data' }
});

const taskB = await eventLoop.brain.submitTask({
  type: 'intelligence',
  priority: 5,
  dependencies: [taskA],  // Won't run until taskA completes
  payload: { operation: 'analyze', data: 'from_task_a' }
});
```

### Custom Agent Types

Add new handlers in `agents/executor.js`:

```javascript
async function executeCustomTask(task) {
  // Your custom logic
  return { result: 'custom' };
}

AGENT_HANDLERS.custom = executeCustomTask;
```

### Event Hooks

```javascript
eventLoop.brain.on('task:completed', (task, result) => {
  console.log(`Task ${task.id} completed!`);
});

eventLoop.brain.on('task:failed', (task, error) => {
  console.error(`Task ${task.id} failed:`, error.message);
});

eventLoop.brain.on('health:changed', (health) => {
  console.log(`Health changed to: ${health.status}`);
});
```

---

## 🧪 Testing

```bash
# Run system test
node -e "
import('./core/eventLoop.js').then(async ({ getEventLoop }) => {
  const loop = getEventLoop();
  await loop.start();
  
  // Submit test tasks
  for (let i = 0; i < 5; i++) {
    await loop.brain.submitTask({
      type: 'system',
      priority: 5,
      payload: { action: 'metrics' }
    });
  }
  
  console.log('Test