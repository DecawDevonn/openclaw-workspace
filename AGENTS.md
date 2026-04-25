# AGENTS.md — WORKER DEFINITIONS & BEHAVIORS

Who executes jobs and how they decide what to do.

This is the **workforce layer** that brings the system to life.

---

## 🎯 Purpose

Agents are the execution engines of Devonn.ai. They:
- Pull jobs from queues
- Execute defined actions
- Report results and logs
- Handle failures and retries
- Learn from outcomes

---

## 🤖 Agent Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    QUEUE LAYER                          │
│              (Jobs waiting to execute)                  │
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
│         (Tools, APIs, Scripts, LLM Calls)               │
└─────────────────────────────────────────────────────────┘
```

---

## 🧩 Agent Types

### 1. WEB AGENT
**Purpose:** Handle web-based interactions and research

**Capabilities:**
- Web scraping and data extraction
- API integrations
- Browser automation
- Content generation
- Social media operations

**Tools:**
- `browser` — Web automation
- `web_search` — Information retrieval
- `web_fetch` — Content extraction
- `api_gateway` — Third-party integrations

**Queue:** standard
**Concurrency:** 5
**Timeout:** 30s

**Example Jobs:**
- Research competitor pricing
- Post to social media
- Scrape documentation
- Monitor website changes

---

### 2. TERMINAL AGENT
**Purpose:** Execute system commands and file operations

**Capabilities:**
- Shell command execution
- File system operations
- Git operations
- Build and deployment
- System maintenance

**Tools:**
- `exec` — Shell commands
- `read/write/edit` — File operations
- `process` — Process management
- `gateway` — Service control

**Queue:** standard
**Concurrency:** 3
**Timeout:** 300s

**Example Jobs:**
- Deploy application
- Run tests
- Update dependencies
- Clean up logs
- Backup data

---

### 3. SYSTEM AGENT
**Purpose:** Internal system maintenance and optimization

**Capabilities:**
- Health monitoring
- Resource management
- Queue optimization
- Log aggregation
- Metric collection

**Tools:**
- `cron` — Scheduled tasks
- `sessions_list/status` — Session management
- `memory_search` — Knowledge retrieval
- `gateway` — System control

**Queue:** background
**Concurrency:** 2
**Timeout:** 60s

**Example Jobs:**
- Generate daily reports
- Clean old sessions
- Optimize queue depths
- Update system metrics
- Check disk space

---

### 4. INTELLIGENCE AGENT
**Purpose:** LLM-powered analysis and decision making

**Capabilities:**
- Natural language understanding
- Content generation
- Pattern recognition
- Summarization
- Classification

**Tools:**
- `sessions_spawn` — Sub-agent creation
- `memory_search/get` — Knowledge access
- `web_search/fetch` — Research
- `tts` — Voice generation

**Queue:** standard
**Concurrency:** 10
**Timeout:** 120s

**Example Jobs:**
- Summarize meeting notes
- Classify incoming tasks
- Generate documentation
- Analyze sentiment
- Create content

---

### 5. ORCHESTRATOR AGENT
**Purpose:** Coordinate multi-step workflows

**Capabilities:**
- Job decomposition
- Parallel execution
- Dependency management
- Result aggregation
- Error handling

**Tools:**
- `sessions_spawn` — Create sub-agents
- `subagents` — Manage agent pool
- `cron` — Schedule follow-ups
- `message` — Notifications

**Queue:** critical
**Concurrency:** 3
**Timeout:** 600s

**Example Jobs:**
- Deploy full stack
- Run integration tests
- Process large datasets
- Coordinate team workflows

---

## ⚙️ Agent Configuration

### Base Agent Structure

```json
{
  "id": "uuid",
  "type": "web | terminal | system | intelligence | orchestrator",
  "name": "descriptive-name",
  "status": "idle | running | paused | error",
  
  "capabilities": ["tool1", "tool2"],
  "queue": "queue-name",
  
  "config": {
    "concurrency": 5,
    "timeout": 30000,
    "retry": 3,
    "backoff": "exponential"
  },
  
  "metrics": {
    "jobs_completed": 0,
    "jobs_failed": 0,
    "avg_processing_time": 0,
    "last_active": "timestamp"
  },
  
  "health": {
    "status": "healthy",
    "last_check": "timestamp",
    "errors": []
  }
}
```

---

## 🔄 Agent Lifecycle

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  INIT   │ → │  IDLE   │ → │ RUNNING │ → │COMPLETE │
└─────────┘    └─────────┘    └────┬────┘    └─────────┘
     │              ↑              │
     │              └──────────────┘
     │                   (next job)
     │
     └──────────────────────────────────→ [ERROR]
                                               │
                                               ▼
                                         ┌─────────┐
                                         │  RETRY  │
                                         └────┬────┘
                                              │
                    ┌─────────────────────────┘
                    ▼
              ┌─────────┐
              │  DLQ    │ (max retries exceeded)
              └─────────┘
```

---

## 🛡️ Safety & Controls

### Execution Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Max execution time | 600s | Prevent runaway jobs |
| Max memory | 512MB | Resource protection |
| Max file size | 100MB | Storage protection |
| Max API calls | 100/min | Rate limiting |
| Max retries | 3 | Failure handling |

### Sandboxing

- File system: Restricted to workspace
- Network: Allowed for approved domains
- Commands: Pre-approved list only
- Environment: Isolated from host

### Approval Gates

Certain actions require explicit approval:
- External API writes
- Production deployments
- Destructive operations
- High-cost operations

---

## 📊 Agent Metrics

### Per-Agent Tracking

```javascript
{
  "agent_id": "web-agent-1",
  "metrics": {
    "jobs_completed": 1523,
    "jobs_failed": 23,
    "success_rate": 0.985,
    "avg_processing_time": 12.4,
    "total_processing_time": 18923,
    "queue_depth": 5,
    "last_job": "2026-04-10T17:30:00Z",
    "errors_last_hour": 0
  }
}
```

### Health Indicators

| Status | Condition |
|--------|-----------|
| 🟢 Healthy | < 5% error rate, processing normally |
| 🟡 Warning | 5-10% error rate, or high latency |
| 🔴 Critical | > 10% error rate, or not processing |

---

## 🧠 Agent Intelligence

### Decision Making

Agents use this priority order:

1. **Explicit Instructions** — Job payload rules
2. **User Preferences** — From USER.md
3. **System Defaults** — From IDENTITY.md
4. **Learned Patterns** — From REFLECTION.md
5. **Safe Fallbacks** — Conservative defaults

### Context Awareness

Agents always have access to:
- Current job details
- User profile (USER.md)
- System identity (IDENTITY.md)
- Relevant memories
- Tool documentation

### Self-Improvement

Agents can:
- Log execution patterns
- Suggest optimizations
- Update their own configs
- Learn from failures

---

## 🔧 Agent Implementation

### Example: Terminal Agent

```typescript
class TerminalAgent {
  async execute(job: Job): Promise<Result> {
    // 1. Validate job
    if (!this.canHandle(job)) {
      return { status: 'rejected', reason: 'unsupported' };
    }
    
    // 2. Check safety
    if (this.requiresApproval(job)) {
      await this.requestApproval(job);
    }
    
    // 3. Execute
    const startTime = Date.now();
    try {
      const result = await this.runCommand(job.payload);
      
      // 4. Log success
      this.metrics.recordSuccess(Date.now() - startTime);
      
      return { status: 'completed', result };
    } catch (error) {
      // 5. Handle failure
      this.metrics.recordFailure(error);
      
      if (job.retries < job.maxRetries) {
        return { status: 'retry', error };
      }
      
      return { status: 'failed', error };
    }
  }
}
```

---

## 🚫 Anti-Patterns

- **Monolithic agents** — One agent doing everything
- **No timeouts** — Agents running forever
- **Silent failures** — Errors not logged or reported
- **No isolation** — Agents interfering with each other
- **Hard-coded logic** — No configuration or learning

---

## 🔄 Scheduler Integration

Agents are now orchestrated by the DEVONN.ai Autonomous Scheduler OS:

### Task Routing

```javascript
// Scheduler Brain determines agent type
determineAgentType(task) {
  const typeMap = {
    'web_scrape': 'web',
    'shell_command': 'terminal',
    'system_check': 'system',
    'llm_analysis': 'intelligence',
    'workflow': 'orchestrator'
  };
  return typeMap[task.type] || 'terminal';
}
```

### Priority-Based Execution

| Agent Type | Default Priority | Queue |
|------------|------------------|-------|
| System Agent | 8 | critical/high |
| Web Agent | 6-7 | high/normal |
| Terminal Agent | 5-6 | normal |
| Intelligence Agent | 4-7 | normal/high |
| Orchestrator Agent | 7-9 | high/critical |

### Execution Flow

1. Task submitted to Scheduler Brain
2. Priority determines queue (critical → background)
3. Health Governor checks system state
4. Dependencies verified
5. Task routed to appropriate agent
6. Agent executes via tool calls
7. Results logged, insights updated
8. On failure: Self-Healing Engine retries

---

## 🔗 Related Documents

- `JOB.md` — What agents execute
- `QUEUE.md` — Where agents get work
- `USER.md` — Who agents serve
- `IDENTITY.md` — How agents should behave
- `REFLECTION.md` — How agents improve
- `devonn/SCHEDULER.md` — Autonomous scheduler architecture

---

## 📌 Core Principle

> Agents are not tools. They are autonomous workers with context, judgment, and the ability to improve.

---

*Last updated: 2026-04-10*
