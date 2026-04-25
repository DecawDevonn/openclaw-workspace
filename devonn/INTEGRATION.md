# DEVONN.ai Scheduler Integration Guide

## Overview

The DEVONN.ai Autonomous Scheduler OS is now fully operational. This document explains how to integrate it with the existing capture system and cron infrastructure.

## What Changed

### BEFORE: Static Cron Jobs
- Multiple cron entries for different tasks
- Fixed time intervals
- No failure recovery
- No prioritization
- No system awareness

### AFTER: Autonomous Scheduler
- Single cron entry (bootstrap only)
- Event-driven execution
- Self-healing with retries
- Priority-based queues
- Health-aware throttling

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON (1 entry only)                      │
│              * * * * * devonn/cron-bootstrap.sh             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     BOOTSTRAP                               │
│              (starts scheduler if not running)              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 SCHEDULER BRAIN                             │
│     ┌─────────────┐  ┌──────────────┐  ┌─────────────┐     │
│     │  TaskQueue  │  │HealthGovernor│  │Self-Healing │     │
│     └─────────────┘  └──────────────┘  └─────────────┘     │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │  WEB    │    │TERMINAL │    │ SYSTEM  │
   │  AGENT  │    │  AGENT  │    │  AGENT  │
   └─────────┘    └─────────┘    └─────────┘
```

## Installation

### 1. Update Crontab

Replace all existing DEVONN cron entries with this single line:

```bash
# Edit crontab
crontab -e

# Add this line (checks every minute if scheduler is running)
* * * * * /home/ubuntu/.openclaw/workspace/devonn/cron-bootstrap.sh
```

### 2. Start Scheduler Manually (First Time)

```bash
cd /home/ubuntu/.openclaw/workspace/devonn
node bootstrap.js
```

Or use the cron script:
```bash
./cron-bootstrap.sh
```

### 3. Verify Operation

```bash
# Check status
npm run status

# View queue
npm run queue

# Check system health
npm run health
```

## Submitting Tasks

### Via CLI

```bash
# Submit a shell command task
npm run submit -- shell_command 8 '{"action":"shell","command":"ls -la"}'

# Submit a web scrape task
npm run submit -- web_scrape 7 '{"action":"scrape","url":"https://example.com"}'

# Submit a system check
npm run submit -- system_check 8 '{"action":"health_check"}'
```

### Via JavaScript API

```javascript
import { SchedulerBrain } from './core/schedulerBrain.js';

const scheduler = new SchedulerBrain();
await scheduler.init();
scheduler.start();

// Submit task
await scheduler.submitTask({
  type: 'web_scrape',
  priority: 7,
  payload: { 
    action: 'scrape',
    url: 'https://example.com'
  },
  maxRetries: 3
});
```

### Via HTTP API (Capture Integration)

The capture API can submit tasks directly to the scheduler:

```javascript
// POST /api/tasks
{
  "type": "intelligence",
  "priority": 6,
  "payload": {
    "action": "analyze",
    "data": "..."
  }
}
```

## Migration from Existing Cron Jobs

### Step 1: Identify Current Cron Jobs

```bash
crontab -l | grep -E "(devonn|myclaw)"
```

### Step 2: Convert Each Cron Job to a Scheduled Task

For each existing cron job, create a recurring task:

```javascript
// Old: */5 * * * * /path/to/script.sh
// New: Submit recurring task
await scheduler.submitTask({
  type: 'system_check',
  priority: 5,
  payload: {
    action: 'health_check',
    recurring: true,
    interval: 300000  // 5 minutes in ms
  }
});
```

### Step 3: Remove Old Cron Entries

```bash
# Remove all old DEVONN entries, keep only the bootstrap
crontab -l | grep -v "devonn" | crontab -
```

## Queue Priority System

| Priority | Queue | Use Case |
|----------|-------|----------|
| 9-10 | **critical** | System health, emergencies |
| 7-8 | **high** | User-facing, real-time tasks |
| 4-6 | **normal** | Standard operations |
| 1-3 | **low** | Cleanup, maintenance |
| 0 | **background** | Analytics, reports |

## Health-Based Throttling

The Health Governor automatically adjusts execution:

| Health | CPU | Memory | Action |
|--------|-----|--------|--------|
| 🟢 Healthy | <85% | <85% | Full speed |
| 🟡 Degraded | >85% | >85% | Throttle 50% |
| 🔴 Critical | >95% | >95% | Pause execution |

## Self-Healing Behavior

When tasks fail, the system:

1. **Classifies** error type (timeout, network, rate limit, etc.)
2. **Selects** appropriate recovery strategy
3. **Retries** with exponential backoff
4. **Escalates** priority if transient
5. **Moves to DLQ** if max retries exceeded

## Monitoring

### View Logs

```bash
# Real-time logstail -f /home/ubuntu/.openclaw/workspace/devonn/data/scheduler.log

# View last 100 lines
tail -100 /home/ubuntu/.openclaw/workspace/devonn/data/scheduler.log
```

### Check Status

```bash
cd /home/ubuntu/.openclaw/workspace/devonn
npm run status
```

### System Metrics

```bash
cd /home/ubuntu/.openclaw/workspace/devonn
npm run health
```

## Troubleshooting

### Scheduler Not Starting

```bash
# Check if Node.js is available
node --version

# Check file permissions
ls -la bootstrap.js

# Try running directly
node bootstrap.js
```

### Tasks Not Executing

```bash
# Check queue depth
npm run queue

# Check system health
npm run health

# View recent logs
tail -50 data/scheduler.log
```

### High Failure Rate

```bash
# Check failure patterns
npm run status

# Look for recommendations in output
# Review dead letter queue
cat data/taskQueue.dlq.json | head -50
```

## Files

| File | Purpose |
|------|---------|
| `bootstrap.js` | Main entry point |
| `cli.js` | Command-line interface |
| `cron-bootstrap.sh` | Cron wrapper script |
| `core/schedulerBrain.js` | Central orchestration |
| `core/healthGovernor.js` | System health monitoring |
| `queue/taskQueue.js` | Priority queue management |
| `agents/agentRouter.js` | Task routing to agents |
| `agents/selfHealing.js` | Failure recovery |
| `analytics/schedulerInsights.js` | Performance learning |
| `data/taskQueue.json` | Persisted queue state |
| `data/insights.json` | Analytics data |
| `data/scheduler.log` | Runtime logs |

## Next Steps

1. **Monitor** the system for a few days
2. **Tune** priorities based on actual patterns
3. **Migrate** remaining cron jobs to scheduled tasks
4. **Extend** with custom agent types as needed
5. **Scale** to multi-node if needed (Phase 2)

## Support

- Check logs: `data/scheduler.log`
- View status: `npm run status`
- Read docs: `SCHEDULER.md`
