# JOB.md — MYCLAW EXECUTION MODEL

The runtime definition of how work gets created, processed, and completed inside your system.

This is the bridge between:
- **Capture** (mobile / terminal)
- **Intelligence** (LLM brain)
- **Execution** (agents / cron / queues)

---

## 🧠 Definition

A **Job** is the atomic unit of execution inside the system.

Every idea, task, or action becomes a job.

---

## 🧩 Job Structure (Canonical Format)

```json
{
  "id": "uuid",
  "type": "task | idea | automation | system",
  "title": "short description",
  "description": "full context",
  
  "status": "pending | queued | running | completed | failed",
  
  "priority": "low | medium | high | critical",
  
  "source": "mobile | terminal | agent | system",
  
  "created_at": "timestamp",
  "scheduled_for": "timestamp | null",
  
  "tags": ["ai", "build", "automation"],
  
  "actions": [
    {
      "type": "command | api_call | script | llm",
      "payload": {}
    }
  ],
  
  "dependencies": [],
  
  "retry_policy": {
    "retries": 3,
    "backoff": "exponential"
  },
  
  "result": null,
  "logs": []
}
```

---

## ⚙️ Job Lifecycle

### 1. Capture

Input enters system:
- mobile note
- voice
- terminal command
- agent-generated task

→ Sent to intake endpoint

### 2. LLM Processing (Brain Layer)

System extracts:
- intent
- task type
- priority
- required actions

→ converts into structured job

### 3. Queueing

Jobs are placed into:
- **immediate queue** (urgent)
- **scheduled queue** (future)
- **background queue** (low priority)

### 4. Execution

Worker / agent picks job:
- runs defined actions
- updates status in real-time
- logs all activity

### 5. Completion

On success:
- mark `completed`
- store result
- trigger follow-ups (if needed)

On failure:
- retry (based on policy)
- escalate if persistent

### 6. Reflection Layer

System analyzes:
- success/failure patterns
- execution time
- optimization opportunities

→ feeds learning system

---

## 🤖 Job Types

### TASK
User-defined actionable work
- Example: "deploy backend", "fix cron bug"

### IDEA
Raw thought → may convert into task later
- Example: "build AI agent marketplace"

### AUTOMATION
Recurring or triggered workflow
- Example: "daily report generation"

### SYSTEM
Internal maintenance
- Example: "cleanup logs", "restart worker"

---

## 🔄 State Machine

```
pending → queued → running → completed
  ↓
failed → retry → running
```

---

## ⚡ Execution Rules

- Critical jobs bypass queue
- Jobs with dependencies wait
- Failed jobs retry automatically
- Long-running jobs must checkpoint

---

## 🧠 Intelligence Hooks

Each job can trigger:
- LLM enhancement (rewrite, expand, plan)
- Priority adjustment
- Auto-decomposition (break into sub-jobs)

---

## 🔥 Advanced Features

### 1. Job Decomposition
Large job → split into smaller jobs

### 2. Parallel Execution
Independent jobs run simultaneously

### 3. Event Triggers
Jobs can trigger other jobs

### 4. Self-Generation
System creates jobs based on:
- detected inefficiencies
- missed opportunities
- recurring patterns

---

## 📡 Integration Points

- **API:** `/jobs/create`
- **Queue:** Redis / BullMQ
- **Scheduler:** cron / event-based
- **Workers:** Node / Python agents

---

## 🚫 Anti-Patterns

- Unstructured tasks
- Manual tracking outside system
- No retry logic
- Silent failures

---

## 🧠 System Directive

Every input must become:
→ a structured job
→ executed or scheduled
→ logged and learned from

---

## 📌 Core Principle

> If it is not a job, it does not exist in the system.

---

## 🔗 Related Documents

- `INTAKE.md` — Mobile → API → LLM → Job pipeline
- `QUEUE.md` — How jobs move (Redis / BullMQ / priority lanes)
- `AGENTS.md` — Who executes jobs and how they decide
- `REFLECTION.md` — Learning + optimization layer

---

*Last updated: 2026-04-10*
