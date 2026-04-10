# QUEUE.md — JOB ROUTING & QUEUE MANAGEMENT

How jobs move through the system: routing, prioritization, and execution orchestration.

This is the **transport layer** that connects captured work to executing agents.

---

## 🎯 Purpose

The queue system:
- Receives jobs from the intake layer
- Routes them to appropriate workers
- Manages priority and ordering
- Handles retries and failures
- Provides visibility into system state

---

## 🧩 Queue Architecture

### Primary Queues

```
┌─────────────────────────────────────────────────────────┐
│                     INTAKE LAYER                        │
│              (Jobs created from capture)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    ROUTER / DISPATCHER                  │
│         (Analyzes job type, priority, dependencies)     │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ CRITICAL│  │ STANDARD│  │BACKGROUND│
   │  QUEUE  │  │  QUEUE  │  │  QUEUE   │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   WORKER POOL                           │
│              (Agents execute jobs)                      │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ Queue Types

### 1. CRITICAL QUEUE
**Characteristics:**
- Bypasses normal ordering
- Immediate execution
- Reserved for: system failures, user interrupts, safety issues

**Examples:**
- System health alerts
- User cancellation requests
- Security incidents

**Config:**
```json
{
  "name": "critical",
  "concurrency": 5,
  "priority": 100,
  "retry": false
}
```

---

### 2. STANDARD QUEUE
**Characteristics:**
- FIFO with priority weighting
- Main work queue
- Balanced throughput

**Examples:**
- User tasks
- API requests
- Scheduled jobs

**Config:**
```json
{
  "name": "standard",
  "concurrency": 10,
  "priority": 50,
  "retry": true,
  "retry_limit": 3
}
```

---

### 3. BACKGROUND QUEUE
**Characteristics:**
- Lowest priority
- Runs when resources available
- Can be paused during high load

**Examples:**
- Data cleanup
- Report generation
- Analytics processing

**Config:**
```json
{
  "name": "background",
  "concurrency": 3,
  "priority": 10,
  "retry": true,
  "retry_limit": 5,
  "rate_limit": "100/hour"
}
```

---

### 4. SCHEDULED QUEUE
**Characteristics:**
- Time-based execution
- Cron-like scheduling
- Future-dated jobs

**Examples:**
- Daily reports
- Weekly summaries
- Maintenance windows

**Config:**
```json
{
  "name": "scheduled",
  "type": "delayed",
  "check_interval": "1m"
}
```

---

## 🔄 Job Routing Logic

```javascript
function routeJob(job) {
  // 1. Check for critical conditions
  if (job.priority === 'critical' || job.tags.includes('urgent')) {
    return 'critical';
  }
  
  // 2. Check for scheduled time
  if (job.scheduled_for && job.scheduled_for > now()) {
    return 'scheduled';
  }
  
  // 3. Check job type
  if (job.type === 'system' || job.type === 'automation') {
    return 'background';
  }
  
  // 4. Default to standard
  return 'standard';
}
```

---

## 📊 Priority Calculation

Jobs are scored based on:

```javascript
priority_score = (
  base_priority * 0.4 +
  age_factor * 0.2 +
  user_priority * 0.2 +
  system_load_factor * 0.2
)
```

**Factors:**
- `base_priority`: Job type default (critical=100, standard=50, background=10)
- `age_factor`: Older jobs get slight boost (prevent starvation)
- `user_priority`: Explicit user marking (high/medium/low)
- `system_load_factor`: Adjust based on current capacity

---

## 🛡️ Reliability Features

### 1. Dead Letter Queue (DLQ)

Jobs that fail permanently go to DLQ for:
- Manual inspection
- Debugging
- Replay capability

```json
{
  "name": "dead_letter",
  "retention": "30d",
  "alert_on_add": true
}
```

### 2. Checkpoint System

Long-running jobs must checkpoint:
```javascript
{
  "checkpoint_enabled": true,
  "checkpoint_interval": "5m",
  "resume_from_checkpoint": true
}
```

### 3. Circuit Breaker

If a worker fails repeatedly:
- Pause new jobs to that worker
- Alert system
- Route to healthy workers

---

## 📈 Observability

### Metrics Tracked

| Metric | Description |
|--------|-------------|
| `queue_depth` | Jobs waiting per queue |
| `processing_time` | Time from queue to completion |
| `success_rate` | % of jobs completing successfully |
| `retry_count` | Average retries per job type |
| `worker_utilization` | % capacity used per worker |

### Health Checks

```javascript
// Queue health thresholds
const health = {
  critical_depth: '< 10',
  standard_depth: '< 100',
  background_depth: '< 500',
  processing_time: '< 30s avg',
  success_rate: '> 95%'
};
```

---

## 🔧 Implementation Notes

### Recommended Stack

**Option 1: BullMQ (Redis-based)**
- Pros: Mature, feature-rich, TypeScript support
- Cons: Requires Redis
- Best for: Production systems

**Option 2: Node.js EventEmitter**
- Pros: No dependencies, simple
- Cons: No persistence, single-process
- Best for: Prototypes, single-node

**Option 3: PostgreSQL Queue**
- Pros: ACID compliance, existing DB
- Cons: Higher latency
- Best for: Data-heavy systems

### Configuration Example (BullMQ)

```typescript
import { Queue, Worker } from 'bullmq';

const standardQueue = new Queue('standard', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

const worker = new Worker('standard', async (job) => {
  return await executeJob(job.data);
}, {
  connection: redis,
  concurrency: 10
});
```

---

## 🚫 Anti-Patterns

- **Infinite retries** — Always set limits
- **No visibility** — Must log all state transitions
- **No backpressure** — Queue must handle overload
- **Synchronous blocking** — Workers must be async
- **No dead letter** — Failed jobs need a destination

---

## 🔗 Related Documents

- `JOB.md` — Job structure and lifecycle
- `INTAKE.md` — How jobs enter the system
- `AGENTS.md` — Worker/agent definitions
- `REFLECTION.md` — Learning from queue metrics

---

## 📌 Core Principle

> The queue is not a holding pen. It is a smart router that optimizes for throughput, reliability, and priority.

---

*Last updated: 2026-04-10*
