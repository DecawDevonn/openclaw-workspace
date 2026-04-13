# Devonn.ai Autonomous Scheduler v2.0

## 🎯 What This Is

This is a **self-managing execution brain** that replaces static cron jobs with an intelligent, event-driven orchestration system.

## 🧠 Core Philosophy

**Before:** Static cron jobs → blind execution → no memory → fragile restarts  
**After:** Event-driven tasks → intelligent routing → self-healing → adaptive scheduling

## 📁 Architecture

```
~/.openclaw/workspace/
├── bootstrap.ts              # Entry point - starts the system
├── core/
│   ├── eventLoop.ts         # The beating heart - schedules and executes
│   └── healthGovernor.ts    # Monitors system health, throttles under stress
├── queue/
│   └── taskQueue.ts         # Priority queue with persistence
├── agents/
│   └── agentRouter.ts       # Routes tasks to appropriate agents
├── api/
│   └── schedulerAPI.ts      # Programmatic interface
├── cli/
│   └── devonn.ts            # Command-line interface
└── cron/
    └── bootstrap.sh         # The ONE cron job that starts it all
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd ~/.openclaw/workspace
npm install
```

### 2. Start the Scheduler

```bash
# Manual start
npm start

# Or with tsx directly
npx tsx bootstrap.ts
```

### 3. Set Up the Single Cron Job

```bash
# Add to crontab (runs every minute to ensure system is up)
* * * * * /home/ubuntu/.openclaw/workspace/cron/bootstrap.sh >> /home/ubuntu/.openclaw/logs/cron.log 2>&1
```

## 🎮 Using the CLI

```bash
# Submit a task
devonn submit intelligence '{"prompt": "Analyze system performance"}' --priority 8
devonn submit terminal '{"command": "df -h"}'

# Check system status
devonn status

# Check specific task
devonn status task_1234567890

# List all pending tasks
devonn list pending

# Cancel a task
devonn cancel task_1234567890
```

## 🔧 Task Types

| Type | Purpose | Concurrency |
|------|---------|-------------|
| `web` | Web scraping, API calls, browser automation | 5 |
| `terminal` | Shell commands, file operations, git | 3 |
| `system` | Maintenance, cleanup, health checks | 2 |
| `intelligence` | LLM processing, analysis, generation | 10 |
| `orchestrator` | Multi-step workflows, coordination | 3 |

## 🩺 Self-Healing Features

1. **Health Monitoring**: Tracks CPU, memory, API failures
2. **Adaptive Throttling**: Slows down under high load
3. **Exponential Backoff**: Retries with increasing delays
4. **Priority Boosting**: Failed tasks get higher priority on retry
5. **Dead Letter Queue**: Permanently failed tasks stored for analysis
6. **Dependency Resolution**: Tasks wait for dependencies to complete

## 📊 System Behavior

### Under Normal Load
- Tasks execute immediately based on priority
- 2-second loop interval
- All agent types run at full concurrency

### Under High Load (CPU > 85% or Memory > 90%)
- Loop interval increases to 5 seconds
- Only high-priority tasks (8+) execute
- System continues monitoring and recovers automatically

### Critical Load (CPU > 95% or Memory > 95%)
- Execution pauses for 15 seconds
- System waits for resources to free up
- No new tasks started

## 🔌 API Usage

```typescript
import { schedulerAPI } from './api/schedulerAPI.js';

// Submit a task
const { taskId } = await schedulerAPI.submitTask({
  type: 'intelligence',
  priority: 8,
  payload: { prompt: 'Analyze this data' }
});

// Check status
const status = await schedulerAPI.getTaskStatus(taskId);

// Get system metrics
const metrics = await schedulerAPI.getSystemMetrics();
```

## 🧪 Testing

```bash
# Submit test tasks
for i in {1..10}; do
  devonn submit system '{"action": "test"}' --priority $((RANDOM % 10 + 1))
done

# Watch the system work
devonn status
```

## 📝 Task Persistence

Tasks are automatically persisted to:
- `~/.openclaw/queue/tasks.json` - Active tasks
- `~/.openclaw/queue/deadletter.json` - Failed tasks

This ensures tasks survive restarts and crashes.

## 🔄 Migration from Cron

Old cron jobs become tasks:

```bash
# Old way:
*/5 * * * * /path/to/script.sh

# New way - create a recurring task:
devonn submit system '{
  "action": "recurring",
  "interval": 300000,
  "command": "/path/to/script.sh"
}' --priority 5
```

## 🚦 Monitoring

```bash
# Real-time logs
tail -f ~/.openclaw/logs/scheduler.log

# System status
devonn status

# Queue depth
devonn list pending | wc -l
```

## 🔮 Future Enhancements

- [ ] DAG-based execution graphs
- [ ] Distributed worker nodes
- [ ] Web dashboard
- [ ] GPT-driven task planning
- [ ] Persistent vector memory
- [ ] Multi-device orchestration

---

**Core Principle:** The scheduler is not a tool—it's an autonomous execution partner that manages itself.
