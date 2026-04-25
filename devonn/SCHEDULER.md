# DEVONN AUTONOMOUS SCHEDULER OS — SYSTEM ARCHITECTURE

> A self-managing execution brain that schedules, prioritizes, retries, heals, and learns from failures.

---

## ⚙️ Core Philosophy

| Before (Cron) | After (Autonomous OS) |
|--------------|----------------------|
| Fixed time schedules | Event-driven task engine |
| Blind execution | Priority queue execution |
| No system awareness | Health-aware scheduling |
| Manual failure handling | Self-healing retry graph |
| Static intervals | Adaptive timing |

---

## 🧩 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    📊 INTELLIGENCE LAYER                     │
│              (schedulerInsights.js - Learning)               │
│         Tracks failures, bottlenecks, optimal timing         │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    🧠 SCHEDULER BRAIN                        │
│                 (schedulerBrain.js)                          │
│     Holds tasks, assigns priority, decides execution         │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   📦 TASK     │    │   🩺 HEALTH   │    │   🔄 SELF-    │
│    QUEUE      │    │   GOVERNOR    │    │    HEALING    │
│ (taskQueue.js)│    │(healthGovernor│    │(selfHealing.js│
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    🔁 EVENT LOOP                             │
│                  (eventLoop.js)                              │
│          Continuous execution pulse (2s interval)            │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    🚨 DEAD LETTER QUEUE                      │
│               (deadLetterQueue.js)                           │
│       Permanent failure storage + root cause analysis        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 Core Components

### 1. Scheduler Brain (`~/devonn/core/schedulerBrain.js`)

**Responsibilities:**
- Hold all tasks in memory + persistent store
- Assign dynamic priority based on urgency/importance
- Decide what runs next
- Pause system under stress
- Route tasks to appropriate agents

**Priority Scale (1-10):**
| Priority | Level | Use Case |
|----------|-------|----------|
| 9-10 | Critical | System recovery, cascading failures |
| 7-8 | High | User-facing deadlines, security patches |
| 5-6 | Normal | Standard tasks, routine work |
| 3-4 | Low | Background optimization, cleanup |
| 1-2 | Background | Analytics, reporting, archiving |

---

### 2. Task Queue System (`~/devonn/queue/taskQueue.js`)

Replaces cron entirely. Tasks are first-class objects:

```typescript
interface Task {
  id: string;              // Unique identifier
  type: TaskType;          // agent_run, system_check, external_api, etc.
  priority: number;        // 1-10 dynamic priority
  status: TaskStatus;      // pending | running | completed | failed | retrying
  
  // Execution
  payload: object;         // Task-specific data
  agent: string;           // Which agent handles this
  
  // Retry Logic
  retries: number;         // Current retry count
  maxRetries: number;      // Max attempts (default: 3-5)
  retryDelay: number;      // Exponential backoff delay (ms)
  
  // Scheduling
  scheduledAt: Date;       // When to run (can be immediate)
  dependencies: string[];  // Task IDs that must complete first
  
  // Metadata
  createdAt: Date;
  lastRun: Date | null;
  completedAt: Date | null;
  errorHistory: Error[];   // Track failure patterns
}
```

---

### 3. Event Loop (`~/devonn/core/eventLoop.js`)

The system heartbeat. No fixed schedules—dynamic execution:

```javascript
const PULSE_INTERVAL = 2000; // 2 seconds

async function eventLoop() {
  while (systemRunning) {
    const startTime = Date.now();
    
    // 1. Check system health
    if (!systemHealthy()) {
      await pauseNonCriticalTasks();
      continue;
    }
    
    // 2. Get tasks ready to execute
    const tasks = await getRunnableTasks({
      limit: CONCURRENCY_LIMIT,
      orderBy: 'priority DESC, scheduledAt ASC'
    });
    
    // 3. Execute in parallel (up to concurrency limit)
    await Promise.all(tasks.map(task => executeTask(task)));
    
    // 4. Pulse timing - consistent interval
    const elapsed = Date.now() - startTime;
    const sleepTime = Math.max(0, PULSE_INTERVAL - elapsed);
    await sleep(sleepTime);
  }
}
```

---

### 4. Health Governor (`~/devonn/core/healthGovernor.js`)

Monitors system vitals and adjusts execution:

```typescript
interface SystemHealth {
  cpu: number;           // CPU usage %
  memory: number;        // Memory usage %
  apiFailureRate: number; // Rolling 5-min failure rate
  queueDepth: number;    // Pending tasks count
  agentCrashRate: number; // Crashes per minute
}

const HEALTH_RULES = {
  CPU_HIGH: { threshold: 85, action: 'reduce_concurrency' },
  CPU_CRITICAL: { threshold: 95, action: 'pause_non_critical' },
  MEMORY_HIGH: { threshold: 90, action: 'gc_and_throttle' },
  API_FAIL_SPIKE: { threshold: 0.3, action: 'backoff_external_calls' },
  QUEUE_BACKLOG: { threshold: 1000, action: 'scale_workers' }
};
```

---

### 5. Self-Healing Engine (`~/devonn/agents/selfHealing.js`)

Intelligent failure recovery:

```javascript
async function handleFailure(task, error) {
  // Analyze error type
  const errorType = classifyError(error);
  
  switch (errorType) {
    case 'TRANSIENT':
      // Network blip, rate limit, etc. → Retry with backoff
      if (task.retries < task.maxRetries) {
        task.priority += 2; // Elevate priority
        task.retryDelay *= 2; // Exponential backoff
        task.retries++;
        await requeue(task, { delay: task.retryDelay });
      }
      break;
      
    case 'DEPENDENCY_FAILED':
      // Wait for dependency retry
      await requeue(task, { delay: 30000 });
      break;
      
    case 'PERMANENT':
      // Code bug, bad config → Move to DLQ
      await moveToDeadLetterQueue(task, { 
        error, 
        suggestedAction: 'manual_review' 
      });
      break;
      
    case 'RESOURCE_EXHAUSTED':
      // Out of memory, disk full → Pause and alert
      await pauseQueue();
      await alertOperator(`Resource exhausted: ${error.message}`);
      break;
  }
}
```

---

### 6. Adaptive Scheduler Rules

```javascript
// Instead of: */5 * * * *
// Use: Dynamic frequency based on system state

const ADAPTIVE_RULES = {
  // When system is idle → Do more
  systemIdle: () => ({
    agentConcurrency: 10,
    enableBackgroundTasks: true,
    runOptimizations: true
  }),
  
  // When system is busy → Focus on critical only
  systemBusy: () => ({
    agentConcurrency: 3,
    minPriority: 5,  // Only priority 5+
    deferNonCritical: true
  }),
  
  // High failure rate → Conservatively
  highFailureRate: () => ({
    pauseRetries: true,
    requireApproval: true,
    alertOperator: true
  })
};
```

---

### 7. Intelligence Layer (`~/devonn/analytics/schedulerInsights.js`)

Learning from execution patterns:

```javascript
// Tracked metrics (auto-feed into scheduler decisions)
const INSIGHTS = {
  // Agent performance
  agentSpeed: Record<string, number>,        // Average execution time per agent
  agentReliability: Record<string, number>,  // Success rate per agent
  
  // Task patterns
  failureHotspots: string[],  // Which task types fail most
  peakHours: number[],        // Optimal execution times
  
  // System optimization
  bottleneckAnalysis: object,  // Where system slows down
  suggestedImprovements: string[]  // Auto-generated recommendations
};

// Feedback loop: Insights → SchedulerBrain → Better decisions
```

---

### 8. Dead Letter Queue (`~/devonn/queue/deadLetterQueue.js`)

Permanent failure storage with analysis:

```typescript
interface DeadLetterEntry {
  task: Task;
  failedAt: Date;
  finalError: Error;
  retryHistory: RetryAttempt[];
  rootCause: string;
  suggestedFix: string;
  manualReview: boolean;
}
```

---

## 🔥 REPLACEMENT: CRON → BOOTSTRAP ONLY

### Single Entry Point

```bash
# The ONLY cron job kept:
* * * * * cd ~/devonn && node bootstrap.js
```

### bootstrap.js

```javascript
#!/usr/bin/env node
import { startEventLoop } from './core/eventLoop.js';
import { startHealthGovernor } from './core/healthGovernor.js';
import { loadPersistentTasks } from './queue/taskQueue.js';
import { initializeInsights } from './analytics/schedulerInsights.js';

async function bootstrap() {
  console.log('[DEVONN] Autonomous Scheduler OS booting...');
  
  // 1. Load any persisted tasks
  await loadPersistentTasks();
  
  // 2. Start health monitoring
  const healthGovernor = startHealthGovernor();
  
  // 3. Start intelligence layer
  const insights = initializeInsights();
  
  // 4. Start the event loop (THE BRAIN)
  const scheduler = startEventLoop();
  
  // 5. Graceful shutdown handling
  process.on('SIGTERM', async () => {
    console.log('[DEVONN] Graceful shutdown...');
    await scheduler.stop();
    await healthGovernor.stop();
    process.exit(0);
  });
  
  console.log('[DEVONN] System online. Event loop running.');
}

bootstrap();
```

---

## 📊 RESULT: BEFORE vs AFTER

### BEFORE (Cron-Based)

| Aspect | State |
|--------|-------|
| Scheduling | Static intervals, fixed times |
| Execution | Blind—no system awareness |
| Failures | Manual restart required |
| Load handling | None—overload = crash |
| Optimization | Manual tuning |
| Recovery | Human intervention |

### AFTER (Autonomous OS)

| Aspect | State |
|--------|-------|
| Scheduling | Dynamic, priority-based |
| Execution | Health-aware, adaptive |
| Failures | Self-healing with retry graphs |
| Load handling | Auto-throttle, pause, scale |
| Optimization | Continuous learning |
| Recovery | Automatic with escalation |

---

## 🧬 IMPLEMENTATION ROADMAP

### Phase 1: Core Foundation (Week 1)
- [ ] Task queue data structure
- [ ] Event loop implementation
- [ ] Basic health monitoring
- [ ] Bootstrap entry point

### Phase 2: Intelligence Layer (Week 2)
- [ ] Priority scoring system
- [ ] Self-healing retry logic
- [ ] Error classification
- [ ] Dead letter queue

### Phase 3: Optimization (Week 3)
- [ ] Scheduler insights/analytics
- [ ] Adaptive timing rules
- [ ] Performance feedback loops
- [ ] Agent performance tracking

### Phase 4: Next Level (Optional)
- [ ] Multi-agent swarm scheduler
- [ ] DAG-based execution graphs
- [ ] Real-time visual dashboard
- [ ] GPT-driven task planner
- [ ] Distributed worker nodes
- [ ] Persistent graph memory

---

## 🔗 Related Documents

- `AGENTS.md` — Agent definitions and capabilities
- `JOB.md` — Task/job lifecycle and structure
- `QUEUE.md` — Legacy cron queue (to be deprecated)
- `REFLECTION.md` — Learning and optimization patterns

---

## 📌 Core Principle

> The system should manage itself: schedule intelligently, heal from failures, and improve continuously—without human micromanagement.

---

*Architecture designed: 2026-04-20*
