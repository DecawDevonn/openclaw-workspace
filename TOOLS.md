# TOOLS.md — API Integrations & Environment Details

The complete inventory of external tools, APIs, and integrations available to the Devonn.ai system.

This is the **capability registry** that defines what the system can do and how it connects to the outside world.

---

## 🎯 Purpose

TOOLS.md provides:
- Complete inventory of available tools
- Authentication and configuration details
- Usage patterns and best practices
- Rate limits and constraints
- Error handling guidelines

---

## 🛠️ Tool Categories

```
┌─────────────────────────────────────────────────────────┐
│                    TOOL ECOSYSTEM                       │
├─────────────────────────────────────────────────────────┤
│  Communication  │  GitHub  │  System  │  Data  │  AI   │
│  ─────────────  │  ──────  │  ──────  │  ────  │  ───  │
│  • Discord      │  • API   │  • Exec  │  • Web │  • LLM│
│  • Telegram     │  • CLI   │  • Files │  • DB  │  • TTS│
│  • Email        │  • Web   │  • Cron  │  • API │  • STT│
│  • Slack        │          │  • Proc  │        │       │
└─────────────────────────────────────────────────────────┘
```

---

## 📡 Communication Tools

### Discord
**Purpose:** Community engagement, notifications, bot interactions

**Capabilities:**
- Send messages to channels
- Create threads
- React with emojis
- Manage roles
- Voice channel operations

**Authentication:** `DISCORD_BOT_TOKEN`

**Rate Limits:**
- 5 messages/5 seconds per channel
- 50 reactions/minute

**Usage:**
```javascript
{
  "tool": "message",
  "action": "send",
  "channel": "discord",
  "target": "general",
  "content": "Deployment complete!"
}
```

---

### Telegram
**Purpose:** Personal notifications, mobile alerts, 1:1 interactions

**Capabilities:**
- Send messages
- Send photos/documents
- Create polls
- Reply to messages

**Authentication:** `TELEGRAM_BOT_TOKEN`

**Rate Limits:**
- 30 messages/second
- 20 messages/minute to same chat

**Usage:**
```javascript
{
  "tool": "message",
  "action": "send",
  "channel": "telegram",
  "target": "@username",
  "content": "Task completed successfully"
}
```

---

### Email (Gmail)
**Purpose:** Formal communications, reports, alerts

**Capabilities:**
- Send emails
- Read inbox
- Search messages
- Manage labels

**Authentication:** OAuth2 via `api-gateway` skill

**Rate Limits:**
- 100 emails/day (send)
- 1B quota units/day

**Usage:**
```javascript
{
  "tool": "api-gateway",
  "service": "gmail",
  "action": "send",
  "to": "user@example.com",
  "subject": "Daily Report",
  "body": "..."
}
```

---

## 🔧 Development Tools

### GitHub
**Purpose:** Code management, collaboration, CI/CD

**Capabilities:**
- Repository operations
- Issue/PR management
- Actions workflows
- Code review
- Releases

**Authentication:** `GH_TOKEN` (classic or fine-grained)

**Rate Limits:**
- 5,000 requests/hour (authenticated)
- 60 requests/hour (unauthenticated)

**Scopes Required:**
- `repo` - Full repository access
- `workflow` - Actions management
- `read:org` - Organization read

**Usage:**
```bash
# CLI
gh repo create my-project --public
gh issue create --title "Bug fix" --body "..."

# API
GH_TOKEN=xxx gh api repos/:owner/:repo/issues
```

---

### Git Operations
**Purpose:** Local version control

**Capabilities:**
- Clone/pull/push
- Branch management
- Commit operations
- Diff viewing

**Authentication:** SSH keys or HTTPS tokens

**Usage:**
```javascript
{
  "tool": "exec",
  "command": "git clone https://github.com/user/repo.git"
}
```

---

## ⚙️ System Tools

### Shell Execution
**Purpose:** Run system commands

**Capabilities:**
- Execute shell commands
- Background processes
- File operations
- System management

**Constraints:**
- Sandbox restrictions apply
- No destructive commands without approval
- Timeout limits (default 30s)

**Usage:**
```javascript
{
  "tool": "exec",
  "command": "ls -la",
  "timeout": 10
}
```

---

### Process Management
**Purpose:** Monitor and control running processes

**Capabilities:**
- List processes
- Check status
- Send signals
- Read logs

**Usage:**
```javascript
{
  "tool": "process",
  "action": "list"
}
```

---

### File Operations
**Purpose:** Read, write, and edit files

**Capabilities:**
- Read files
- Write new files
- Edit existing files
- Search/replace

**Usage:**
```javascript
{
  "tool": "read",
  "path": "config.json"
}

{
  "tool": "write",
  "path": "output.txt",
  "content": "Hello world"
}

{
  "tool": "edit",
  "path": "config.json",
  "oldText": "version: 1.0",
  "newText": "version: 2.0"
}
```

---

### Cron Scheduling
**Purpose:** Schedule recurring tasks

**Capabilities:**
- One-time scheduled tasks
- Recurring jobs
- Cron expressions
- Job management

**Usage:**
```javascript
{
  "tool": "cron",
  "action": "add",
  "job": {
    "name": "daily-report",
    "schedule": { "kind": "cron", "expr": "0 9 * * *" },
    "payload": { "kind": "agentTurn", "message": "Generate daily report" }
  }
}
```

---

## 🌐 Web Tools

### Web Search
**Purpose:** Find information on the internet

**Capabilities:**
- DuckDuckGo search
- Result filtering
- Safe search options

**Rate Limits:**
- No API key required
- Respect rate limits (1 req/sec)

**Usage:**
```javascript
{
  "tool": "web_search",
  "query": "latest AI developments 2026",
  "count": 10
}
```

---

### Web Fetch
**Purpose:** Extract content from URLs

**Capabilities:**
- Fetch HTML pages
- Extract as markdown
- Handle redirects
- Content filtering

**Usage:**
```javascript
{
  "tool": "web_fetch",
  "url": "https://example.com/article",
  "extractMode": "markdown",
  "maxChars": 5000
}
```

---

### Browser Automation
**Purpose:** Interact with web applications

**Capabilities:**
- Navigate pages
- Click elements
- Fill forms
- Take screenshots
- Extract data

**Usage:**
```javascript
{
  "tool": "browser",
  "action": "open",
  "url": "https://example.com"
}

{
  "tool": "browser",
  "action": "act",
  "request": {
    "kind": "click",
    "ref": "Submit button"
  }
}
```

---

## 🤖 AI Tools

### LLM (Language Models)
**Purpose:** Natural language processing, generation, analysis

**Capabilities:**
- Text generation
- Code completion
- Analysis and summarization
- Question answering

**Models Available:**
- `myclaw/kimi-k2.5` (default)
- `myclaw/gpt-4o`
- `myclaw/claude-3-5-sonnet`

**Usage:**
```javascript
{
  "tool": "sessions_spawn",
  "runtime": "subagent",
  "task": "Analyze this data and summarize findings",
  "model": "myclaw/kimi-k2.5"
}
```

---

### Text-to-Speech
**Purpose:** Convert text to audio

**Capabilities:**
- Multiple voices
- Language support
- Audio playback

**Usage:**
```javascript
{
  "tool": "tts",
  "text": "Hello, your task is complete"
}
```

---

## 🔌 API Gateway

### Maton.ai Integration
**Purpose:** Connect to 100+ external services

**Supported Services:**
- Google Workspace (Gmail, Calendar, Drive)
- Microsoft 365
- GitHub
- Notion
- Slack
- Airtable
- HubSpot
- And more...

**Authentication:** OAuth2 per service

**Usage:**
```javascript
{
  "tool": "api-gateway",
  "service": "notion",
  "action": "create_page",
  "database_id": "xxx",
  "properties": { ... }
}
```

---

## 🗄️ Data Storage

### Memory System
**Purpose:** Long-term knowledge storage

**Capabilities:**
- Semantic search
- Document storage
- Session history
- Knowledge retrieval

**Usage:**
```javascript
{
  "tool": "memory_search",
  "query": "What did we decide about the architecture?",
  "maxResults": 5
}

{
  "tool": "memory_get",
  "path": "MEMORY.md",
  "from": 1,
  "lines": 50
}
```

---

## 📊 Tool Selection Guide

### When to Use What

| Task | Tool | Example |
|------|------|---------|
| Notify user | `message` | Send completion alert |
| Deploy code | `exec` + `gh` | Push to production |
| Research | `web_search` | Find documentation |
| Extract data | `web_fetch` | Get article content |
| Schedule work | `cron` | Daily reports |
| Store knowledge | `memory_search` | Recall decisions |
| Automate browser | `browser` | Fill web forms |
| Generate content | `sessions_spawn` | Write documentation |

---

## ⚠️ Tool Constraints

### Safety Limits

| Tool | Constraint |
|------|-----------|
| `exec` | No `rm -rf`, requires approval for destructive ops |
| `message` | No spam, rate limits apply |
| `web_search` | Respect robots.txt, no scraping |
| `browser` | Sandbox restrictions, no downloads |
| `api-gateway` | OAuth required per service |

### Approval Gates

These actions require explicit user approval:
- External API writes
- Production deployments
- Destructive file operations
- High-cost operations
- Messages to external parties

---

## 🔧 Environment Configuration

### Required Variables

```bash
# Communication
DISCORD_BOT_TOKEN=xxx
TELEGRAM_BOT_TOKEN=xxx

# Development
GH_TOKEN=ghp_xxx

# AI
OPENCLAW_API_KEY=xxx
MATON_API_KEY=xxx

# System
WORKSPACE_DIR=/home/ubuntu/.openclaw/workspace
```

### Tool Availability

| Tool | Status | Notes |
|------|--------|-------|
| `message` | ✅ Available | Discord, Telegram, Email |
| `exec` | ✅ Available | With safety constraints |
| `web_search` | ✅ Available | DuckDuckGo |
| `web_fetch` | ✅ Available | HTML extraction |
| `browser` | ✅ Available | Chromium-based |
| `api-gateway` | ✅ Available | OAuth per service |
| `memory_*` | ✅ Available | Local storage |
| `cron` | ✅ Available | Job scheduling |
| `sessions_*` | ✅ Available | Sub-agent spawning |
| `tts` | ✅ Available | Text-to-speech |

---

## 📝 Best Practices

### 1. Tool Composition

Combine tools for complex workflows:
```javascript
// Research → Summarize → Notify
const search = await web_search({ query: "AI trends" });
const summary = await sessions_spawn({ task: `Summarize: ${search}` });
await message({ channel: "discord", content: summary });
```

### 2. Error Handling

Always handle tool failures:
```javascript
try {
  await exec({ command: "deploy.sh" });
} catch (error) {
  await message({ 
    channel: "telegram", 
    content: `Deployment failed: ${error.message}` 
  });
}
```

### 3. Rate Limit Awareness

Respect limits and implement backoff:
```javascript
// Add delays between API calls
await sleep(1000);
await web_search({ query: "next topic" });
```

---

## 🔗 Related Documents

- `AGENTS.md` — Who uses these tools
- `JOB.md` — How tool calls become jobs
- `API.md` — External interface specifications
- `SKILL.md` (individual) — Deep dive per tool

---

## 📌 Core Principle

> Tools are capabilities. Use them wisely, compose them powerfully, respect their limits.

---

*Last updated: 2026-04-10*
