# Devonn Ecosystem Link

> How this scheduler connects to the broader Devonn.ai Auto-Healer Mesh

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVONN.AI ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────┐        │
│  │  Central Orchestrator │◄────►│   OpenClaw Gateway   │        │
│  │  (Render Cloud)       │      │   (Render Cloud)     │        │
│  └──────────┬───────────┘      └──────────┬───────────┘        │
│             │                             │                      │
│             │  Webhooks / API             │  Routes Events      │
│             │                             │                      │
│             ▼                             ▼                      │
│  ┌──────────────────────────────────────────────────────┐        │
│  │           THIS SCHEDULER (Local/Edge)               │        │
│  │                                                      │        │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────┐  │        │
│  │  │ Task Queue  │◄──►│  Scheduler  │◄──►│ Agents  │  │        │
│  │  │             │    │   Brain     │    │         │  │        │
│  │  └─────────────┘    └──────┬──────┘    └─────────┘  │        │
│  │                            │                        │        │
│  │                    ┌─────────▼──────────┐             │        │
│  │                    │ Ecosystem Connector│             │        │
│  │                    │ (Polls/Reports)    │             │        │
│  │                    └─────────┬──────────┘             │        │
│  │                              │                        │        │
│  └──────────────────────────────┼────────────────────────┘        │
│                                 │                                │
│                    ┌────────────┴────────────┐                  │
│                    ▼                         ▼                  │
│           ┌──────────────┐        ┌──────────────┐             │
│           │  GitHub API  │        │   LLM API    │             │
│           │ (PRs/Issues) │        │ (OpenAI/etc) │             │
│           └──────────────┘        └──────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repository Map

| Repository | Account | Role | Connection |
|------------|---------|------|------------|
| `openclaw-workspace` | **DecawDevonn** | This scheduler + workspace | Local execution |
| `supreme-ai-deployment-hub` | wesship | MCP API + Frontend | Cloud (Render) |
| `central-orchestrator` | wesship | Task dispatcher | Cloud (Render) |
| `openclaw-gateway` | wesship | Event router | Cloud (Render) |
| `devonn-autonomous-upgrade` | wesship | Agent definitions | GitHub integration |
| `devonn-dashboard` | wesship | Monitoring UI | Cloud (Render) |

---

## Connection Modes

### Mode 1: Standalone (Default)
```bash
# Just the scheduler, no cloud connection
node bootstrap.js
```
- Tasks added locally
- Executes on this machine
- No external dependencies

### Mode 2: Ecosystem-Connected
```bash
# Connect to the full Devonn mesh
export ENABLE_ECOSYSTEM=true
export ORCHESTRATOR_URL=https://central-orchestrator.onrender.com
export GATEWAY_URL=https://openclaw-gateway-2t9e.onrender.com
export GITHUB_TOKEN=ghp_xxx
export ORGANIZATION=wesship

node bootstrap.js
```
- Polls orchestrator for tasks
- Reports results back
- Participates in distributed execution

---

## Task Flow

### Incoming (Orchestrator → Scheduler)

1. **GitHub Event** → Central Orchestrator
2. **Orchestrator** creates task (Security/Debug/Refactor/Performance)
3. **Scheduler** polls `/queue` endpoint
4. **Scheduler** injects task into local queue
5. **Scheduler** executes via appropriate agent

### Outgoing (Scheduler → Orchestrator)

1. **Task completes** → Scheduler reports to `/results`
2. **Orchestrator** updates task status
3. **Orchestrator** may trigger follow-up actions (PR creation, etc.)

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_ECOSYSTEM` | No | `false` | Enable cloud connection |
| `ORCHESTRATOR_URL` | If enabled | Render URL | Central orchestrator endpoint |
| `GATEWAY_URL` | If enabled | Render URL | OpenClaw gateway endpoint |
| `GITHUB_TOKEN` | If enabled | — | GitHub PAT for API access |
| `ORGANIZATION` | No | `wesship` | GitHub org/user |
| `POLL_INTERVAL` | No | `30000` | Poll frequency (ms) |

---

## Quick Start

### Standalone
```bash
cd /home/ubuntu/.openclaw/workspace/devonn
node bootstrap.js
```

### Connected to Ecosystem
```bash
# Set credentials
cp .env.example .env
# Edit .env with your tokens

# Start with ecosystem link
export ENABLE_ECOSYSTEM=true
node bootstrap.js
```

---

## Status

| Component | Status | PID |
|-----------|--------|-----|
| Scheduler | ✅ Running | 192519 |
| Ecosystem Link | ⏸️ Disabled | — |

To enable ecosystem mode, set `ENABLE_ECOSYSTEM=true` and restart.

---

*Part of the Devonn.ai Auto-Healer Mesh*
