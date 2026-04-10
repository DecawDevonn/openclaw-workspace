# INTAKE.md — INPUT PROCESSING PIPELINE

How raw inputs become structured jobs.

This is the **entry point** where human intent enters the system and gets converted into executable work.

---

## 🎯 Purpose

The intake layer:
- Receives raw input from multiple sources
- Extracts intent and context
- Structures input into job format
- Routes to appropriate queues
- Provides immediate feedback

---

## 🔄 Intake Flow

```
┌─────────────────────────────────────────────────────────┐
│                   INPUT SOURCES                         │
│  Mobile  │  Terminal  │  Voice  │  API  │  Webhook    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  INTAKE ENDPOINT                        │
│              (Unified entry point)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              PREPROCESSING LAYER                        │
│  • Normalize format    • Extract metadata               │
│  • Detect language     • Timestamp                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              LLM BRAIN (Interpretation)                 │
│  • Intent classification                              │
│  • Entity extraction                                  │
│  • Priority assessment                                │
│  • Action decomposition                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              JOB STRUCTURING                            │
│  • Create job object    • Assign ID                   │
│  • Set priority         • Define actions              │
│  • Add metadata         • Set dependencies            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   QUEUE ROUTER                          │
│              (See QUEUE.md)                             │
└─────────────────────────────────────────────────────────┘
```

---

## 📱 Input Sources

### 1. MOBILE (Quick Capture)

**Channels:**
- iOS app
- Android app
- Progressive Web App

**Input Types:**
- Text notes
- Voice memos
- Photos/images
- Quick actions

**Processing:**
```javascript
{
  "source": "mobile",
  "input_type": "voice",
  "raw_content": "audio_blob",
  "metadata": {
    "location": "lat,long",
    "timestamp": "2026-04-10T17:46:00Z",
    "device": "iPhone15,2"
  }
}
```

**Pipeline:**
1. Receive on device
2. Transcribe (if voice)
3. Send to intake API
4. Confirm receipt
5. Background process

---

### 2. TERMINAL

**Channels:**
- CLI commands
- Shell scripts
- Direct system calls

**Input Types:**
- Commands (`myclaw capture "idea"`)
- File drops
- Git hooks

**Processing:**
```bash
# Example CLI usage
myclaw capture "Build AI agent system" --priority=high --tags=ai,urgent

myclaw task "Fix cron job" --due="2026-04-11"

myclaw idea "Self-healing infrastructure"
```

**Pipeline:**
1. Parse command
2. Validate auth
3. Structure payload
4. Send to intake
5. Return job ID

---

### 3. VOICE

**Channels:**
- Voice assistants
- Phone calls
- Voice memos

**Input Types:**
- Spoken commands
- Voice notes
- Call transcripts

**Processing:**
```javascript
{
  "source": "voice",
  "input_type": "transcript",
  "raw_content": "Hey Devonn, remind me to review the deployment at 5pm",
  "confidence": 0.94,
  "language": "en-US"
}
```

**Pipeline:**
1. Capture audio
2. Speech-to-text
3. Intent extraction
4. Create job
5. Voice confirmation

---

### 4. API

**Channels:**
- REST API
- GraphQL
- WebSocket
- gRPC

**Input Types:**
- Programmatic job creation
- Third-party integrations
- Webhook callbacks

**Processing:**
```http
POST /api/v1/jobs
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "task",
  "title": "Deploy backend",
  "description": "Deploy latest version to production",
  "priority": "high",
  "actions": [
    {
      "type": "command",
      "payload": "./deploy.sh production"
    }
  ]
}
```

**Pipeline:**
1. Authenticate request
2. Validate schema
3. Rate limit check
4. Create job
5. Return job ID

---

### 5. WEBHOOK

**Channels:**
- GitHub webhooks
- Slack events
- Email triggers
- Calendar invites

**Input Types:**
- Event notifications
- Status updates
- External triggers

**Processing:**
```javascript
{
  "source": "webhook",
  "provider": "github",
  "event": "push",
  "payload": {
    "repository": "devonn-ai/system",
    "commit": "abc123",
    "branch": "main"
  }
}
```

**Pipeline:**
1. Receive webhook
2. Verify signature
3. Parse event
4. Map to job type
5. Create job

---

## 🧠 LLM Brain Layer

### Intent Classification

```javascript
const intents = {
  TASK: {
    patterns: ['do', 'fix', 'build', 'deploy', 'update'],
    action_required: true,
    priority_boost: 0
  },
  IDEA: {
    patterns: ['idea', 'thought', 'consider', 'maybe'],
    action_required: false,
    priority_boost: -10
  },
  QUESTION: {
    patterns: ['what', 'how', 'why', 'when'],
    action_required: false,
    priority_boost: 0
  },
  URGENT: {
    patterns: ['urgent', 'asap', 'critical', 'emergency'],
    action_required: true,
    priority_boost: 50
  }
};
```

### Entity Extraction

Extract from input:
- **Dates/Times** → `scheduled_for`
- **People** → `assignee`, `stakeholders`
- **Projects** → `tags`, `project_id`
- **Priority words** → `priority`
- **Actions** → `actions[]`

### Example Transformation

**Raw Input:**
```
"Hey I need to deploy the backend by Friday, it's urgent"
```

**Extracted:**
```javascript
{
  "intent": "TASK",
  "title": "Deploy backend",
  "priority": "high",
  "scheduled_for": "2026-04-17T17:00:00Z",
  "tags": ["deployment", "backend"],
  "urgency": true
}
```

**Structured Job:**
```javascript
{
  "id": "job_abc123",
  "type": "task",
  "title": "Deploy backend",
  "description": "Deploy backend by Friday (urgent)",
  "priority": "high",
  "status": "pending",
  "scheduled_for": "2026-04-17T17:00:00Z",
  "tags": ["deployment", "backend"],
  "source": "mobile",
  "actions": [
    {
      "type": "command",
      "payload": "./deploy.sh backend"
    }
  ]
}
```

---

## ⚡ Real-Time Processing

### Immediate Response

All intake must return within 2 seconds:

```javascript
async function intake(input) {
  // 1. Acknowledge immediately
  const jobId = generateId();
  
  // 2. Queue for processing
  await processingQueue.add({
    jobId,
    input,
    status: 'processing'
  });
  
  // 3. Return to user
  return {
    jobId,
    status: 'received',
    message: 'Processing your request...'
  };
}
```

### Background Processing

Actual structuring happens asynchronously:

```javascript
processingQueue.process(async (job) => {
  // 1. LLM interpretation
  const interpretation = await llm.interpret(job.data.input);
  
  // 2. Structure job
  const structuredJob = createJob(interpretation);
  
  // 3. Route to queue
  await routeToQueue(structuredJob);
  
  // 4. Notify user
  await notifyUser(job.data.jobId, 'ready');
});
```

---

## 🛡️ Validation & Safety

### Input Validation

```javascript
const schema = {
  type: 'object',
  required: ['source', 'content'],
  properties: {
    source: { enum: ['mobile', 'terminal', 'voice', 'api', 'webhook'] },
    content: { type: 'string', maxLength: 10000 },
    priority: { enum: ['low', 'medium', 'high', 'critical'] },
    metadata: { type: 'object' }
  }
};
```

### Rate Limiting

| Source | Rate Limit |
|--------|-----------|
| Mobile | 60/minute |
| Terminal | 120/minute |
| API | 1000/hour (key-based) |
| Webhook | 100/minute per source |

### Content Filtering

- Block spam patterns
- Sanitize HTML/script
- Flag sensitive content
- Log anomalies

---

## 📊 Intake Metrics

### Key Metrics

| Metric | Target |
|--------|--------|
| Intake latency | < 2s |
| Processing time | < 5s |
| Success rate | > 99% |
| Error rate | < 1% |
| Queue depth | < 100 |

### Monitoring

```javascript
{
  "intake": {
    "requests_per_minute": 45,
    "avg_latency_ms": 120,
    "error_rate": 0.002,
    "by_source": {
      "mobile": 20,
      "terminal": 15,
      "api": 8,
      "voice": 2
    }
  }
}
```

---

## 🔗 Related Documents

- `JOB.md` — Job structure after intake
- `QUEUE.md` — Where jobs go after structuring
- `AGENTS.md` — Who processes the jobs
- `USER.md` — Preferences for interpretation

---

## 📌 Core Principle

> Intake is not just data entry. It's the moment human intent becomes system action.

---

*Last updated: 2026-04-10*
