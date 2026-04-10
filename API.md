# API.md — External Interface Specifications

How external systems interact with Devonn.ai.

This is the **contract layer** that defines programmatic access to the system.

---

## 🎯 Purpose

API.md provides:
- RESTful endpoint specifications
- Authentication methods
- Request/response formats
- Error handling
- Rate limiting
- Webhook integrations

---

## 🌐 Base URL

```
Production:  https://api.devonn.ai/v1
Staging:     https://api-staging.devonn.ai/v1
Local:       http://localhost:3000/v1
```

---

## 🔐 Authentication

### API Key Authentication

```http
GET /v1/jobs
Authorization: Bearer {api_key}
```

**Headers:**
| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {api_key}` | Yes |
| `Content-Type` | `application/json` | Yes (for POST/PUT) |
| `X-Request-ID` | UUID | Recommended |

### API Key Levels

| Level | Permissions | Rate Limit |
|-------|-------------|------------|
| `read` | GET operations only | 100/min |
| `write` | GET + POST + PUT | 500/min |
| `admin` | Full access | 1000/min |

---

## 📋 Endpoints

### 1. Jobs API

#### Create Job

```http
POST /v1/jobs
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "type": "task",
  "title": "Deploy backend",
  "description": "Deploy to production",
  "priority": "high",
  "actions": [
    {
      "type": "command",
      "payload": "./deploy.sh production"
    }
  ],
  "tags": ["deployment", "backend"],
  "scheduled_for": "2026-04-10T18:00:00Z"
}
```

**Response (201 Created):**
```json
{
  "id": "job_abc123",
  "status": "pending",
  "created_at": "2026-04-10T17:50:00Z",
  "estimated_completion": "2026-04-10T17:55:00Z",
  "queue_position": 3
}
```

---

#### Get Job

```http
GET /v1/jobs/{job_id}
Authorization: Bearer {api_key}
```

**Response (200 OK):**
```json
{
  "id": "job_abc123",
  "type": "task",
  "title": "Deploy backend",
  "status": "running",
  "priority": "high",
  "created_at": "2026-04-10T17:50:00Z",
  "started_at": "2026-04-10T17:51:00Z",
  "progress": 65,
  "logs": [
    {
      "timestamp": "2026-04-10T17:51:05Z",
      "level": "info",
      "message": "Building Docker image..."
    }
  ]
}
```

---

#### List Jobs

```http
GET /v1/jobs?status=running&limit=10
Authorization: Bearer {api_key}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `type` | string | Filter by type |
| `priority` | string | Filter by priority |
| `limit` | integer | Max results (default: 20) |
| `offset` | integer | Pagination offset |

**Response (200 OK):**
```json
{
  "jobs": [
    { "id": "job_abc123", "status": "running", ... },
    { "id": "job_def456", "status": "pending", ... }
  ],
  "total": 45,
  "limit": 10,
  "offset": 0
}
```

---

#### Cancel Job

```http
DELETE /v1/jobs/{job_id}
Authorization: Bearer {api_key}
```

**Response (200 OK):**
```json
{
  "id": "job_abc123",
  "status": "cancelled",
  "cancelled_at": "2026-04-10T17:52:00Z"
}
```

---

### 2. Capture API

#### Quick Capture

```http
POST /v1/capture
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "content": "Build AI agent marketplace",
  "type": "idea",
  "source": "mobile",
  "metadata": {
    "location": "40.7128,-74.0060",
    "context": "commuting"
  }
}
```

**Response (202 Accepted):**
```json
{
  "capture_id": "cap_xyz789",
  "status": "processing",
  "estimated_processing_time": "2s"
}
```

---

#### Voice Capture

```http
POST /v1/capture/voice
Authorization: Bearer {api_key}
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="audio"; filename="memo.m4a"
Content-Type: audio/m4a

[binary audio data]
--boundary--
```

**Response (202 Accepted):**
```json
{
  "capture_id": "cap_voice123",
  "status": "transcribing",
  "estimated_processing_time": "5s"
}
```

---

### 3. Agents API

#### List Agents

```http
GET /v1/agents
Authorization: Bearer {api_key}
```

**Response (200 OK):**
```json
{
  "agents": [
    {
      "id": "agent_web_1",
      "type": "web",
      "status": "healthy",
      "jobs_completed": 1523,
      "current_load": 2
    },
    {
      "id": "agent_terminal_1",
      "type": "terminal",
      "status": "healthy",
      "jobs_completed": 892,
      "current_load": 0
    }
  ]
}
```

---

#### Get Agent Status

```http
GET /v1/agents/{agent_id}
Authorization: Bearer {api_key}
```

**Response (200 OK):**
```json
{
  "id": "agent_web_1",
  "type": "web",
  "status": "healthy",
  "uptime": 86400,
  "metrics": {
    "jobs_completed": 1523,
    "jobs_failed": 23,
    "success_rate": 0.985,
    "avg_processing_time": 12.4
  }
}
```

---

### 4. System API

#### Health Check

```http
GET /v1/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "version": "1.2.3",
  "timestamp": "2026-04-10T17:50:00Z",
  "services": {
    "api": "up",
    "queue": "up",
    "agents": "up",
    "database": "up"
  }
}
```

---

#### System Metrics

```http
GET /v1/metrics
Authorization: Bearer {api_key}
```

**Response (200 OK):**
```json
{
  "jobs": {
    "total_24h": 1250,
    "completed_24h": 1234,
    "failed_24h": 16,
    "success_rate": 0.987
  },
  "queues": {
    "critical": { "depth": 0, "wait_time": 0 },
    "standard": { "depth": 12, "wait_time": 3.2 },
    "background": { "depth": 45, "wait_time": 120 }
  },
  "agents": {
    "total": 5,
    "healthy": 5,
    "utilization": 0.72
  }
}
```

---

## 🔄 Webhooks

### Receiving Webhooks

Devonn.ai can send webhooks to your system:

```http
POST https://your-domain.com/webhook/devonn
Content-Type: application/json
X-Devonn-Signature: sha256={signature}

{
  "event": "job.completed",
  "timestamp": "2026-04-10T17:50:00Z",
  "data": {
    "job_id": "job_abc123",
    "status": "completed",
    "result": { ... }
  }
}
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `job.created` | New job submitted |
| `job.started` | Job began execution |
| `job.completed` | Job finished successfully |
| `job.failed` | Job failed |
| `job.cancelled` | Job was cancelled |
| `agent.offline` | Agent went offline |
| `system.alert` | System warning/error |

### Webhook Security

Verify signatures:
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

---

## ⚠️ Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request body is invalid",
    "details": {
      "field": "priority",
      "issue": "must be one of: low, medium, high, critical"
    },
    "request_id": "req_abc123",
    "timestamp": "2026-04-10T17:50:00Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | Invalid or missing API key |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `invalid_request` | 400 | Malformed request |
| `rate_limited` | 429 | Too many requests |
| `internal_error` | 500 | Server error |
| `service_unavailable` | 503 | System maintenance |

---

## 📊 Rate Limiting

### Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1712770800
```

### Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /v1/jobs` | 100 | 1 minute |
| `GET /v1/jobs` | 200 | 1 minute |
| `GET /v1/agents` | 60 | 1 minute |
| `POST /v1/capture` | 60 | 1 minute |

### Exceeding Limits

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Reset: 1712770830

{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Try again in 30 seconds."
  }
}
```

---

## 🔌 SDK Examples

### JavaScript/TypeScript

```typescript
import { DevonnClient } from '@devonn/sdk';

const client = new DevonnClient({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.devonn.ai/v1'
});

// Create a job
const job = await client.jobs.create({
  type: 'task',
  title: 'Deploy backend',
  priority: 'high',
  actions: [{
    type: 'command',
    payload: './deploy.sh'
  }]
});

// Check status
const status = await client.jobs.get(job.id);
console.log(status.progress);
```

### Python

```python
from devonn import Client

client = Client(api_key="your_api_key")

# Create a job
job = client.jobs.create(
    type="task",
    title="Deploy backend",
    priority="high",
    actions=[{
        "type": "command",
        "payload": "./deploy.sh"
    }]
)

# Check status
status = client.jobs.get(job.id)
print(status.progress)
```

### cURL

```bash
# Create job
curl -X POST https://api.devonn.ai/v1/jobs \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "task",
    "title": "Deploy backend",
    "priority": "high"
  }'

# Get job status
curl https://api.devonn.ai/v1/jobs/job_abc123 \
  -H "Authorization: Bearer $API_KEY"
```

---

## 📚 API Versioning

### Current Version

**v1** (2026-04-10)

### Versioning Strategy

- URL path versioning: `/v1/`, `/v2/`
- Breaking changes → new version
- Deprecation notices 6 months in advance
- Sunset period 12 months

---

## 🔗 Related Documents

- `TOOLS.md` — Internal tool specifications
- `JOB.md` — Job structure and lifecycle
- `AGENTS.md` — Agent capabilities
- `QUEUE.md` — Queue routing logic

---

## 📌 Core Principle

> The API is the system's nervous system. Make it predictable, reliable, and well-documented.

---

*Last updated: 2026-04-10*
