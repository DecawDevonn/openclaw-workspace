# DEVONN.ai Autonomous Scheduler OS

> A self-managing execution brain that schedules, prioritizes, retries, heals, and learns from failures.

## 🎯 What This Is

This is **not** a cron replacement. This is an **autonomous orchestration system**.

| Cron | DEVONN Scheduler |
|------|------------------|
| Fixed time intervals | Event-driven execution |
| Blind execution | Health-aware throttling |
| Silent failures | Self-healing with retries |
| No prioritization | Priority-based queues |
| Static | Adaptive & learning |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEDULER BRAIN                          │
│     ┌─────────────┐  ┌──────────────┐  ┌─────────────┐     │
│     │  TaskQueue  │  │HealthGovernor│  │Self-Healing │     │
│     │  (Priority) │  │  (Monitor)   │  │  (Recover)  │     │
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

## 🚀 Quick Start

### 1. Start the Scheduler

```bash
cd /home/ubuntu/.openclaw/workspace/devonn
npm start
```

### 2. Check Status

```bash
npm run status
```

### 3. Submit a Task

```bash
npm run submit -- shell_command 8 '{"action":"shell","command":"ls -la"}'
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the scheduler |
| `npm run api` | Start the API server |
| `npm run status` | View system status |
| `npm run queue` | View task queue |
| `npm run health` | Check system health |
| `npm run submit` | Submit a task |
| `npm run logs` | View real-time logs |

## 🔌 API Endpoints

When running `npm run api`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check |
| `/tasks` | POST | Submit new task |
| `/queue` | GET | View queue status |
| `/tasks/:id` | GET | Get task status |
| `/insights` | GET | Analytics & recommendations |

### Submit Task Example

```bash
curl -X POST http://localhost:3456/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web_scrape",
    "priority": 7,
    "payload": {
      "action": "scrape",
      "url": "https://example.com"
    }
  }'
```

## 📊 Priority Queues

| Priority | Queue | Use Case |
|----------|-------|----------|
| 9-10 | **critical** | System health, emergencies |
| 7-8 | **high** | User-facing, real-time tasks |
| 4-6 | **normal** | Standard operations |
| 1-3 | **low** | Cleanup, maintenance |
| 0 | **background** | Analytics, reports |

## 🩺 Health-Based Throttling

The system automatically adjusts execution based on health:

| Health | CPU | Memory | Action |
|--------|-----|--------|--------|
| 🟢 Healthy | <85% | <85% | Full speed |
| 🟡 Degraded | >85% | >85% | Throttle 50% |
| 🔴 Critical | >95% | >95% | Pause execution |

## 🔄 Self-Healing

When tasks fail, the system:

1. **Classifies** error type (timeout, network, rate limit, auth, resource)
2. **Selects** appropriate recovery strategy
3. **Retries** with exponential backoff + jitter
4. **Escalates** priority if transient
5. **Moves to DLQ** if max retries exceeded

## 🧠 Learning System

The analytics layer tracks:

- Task type performance
- Agent success rates
- Optimal execution times
- Failure patterns
- System bottlenecks

Generates recommendations for continuous optimization.

## 🔧 Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVONN_TICK_INTERVAL` | 2000 | Event loop tick (ms) |
| `DEVONN_MAX_CONCURRENT` | 5 | Max parallel tasks |
| `DEVONN_DEFAULT_TIMEOUT` | 300000 | Default task timeout (ms) |
| `DEVONN_DATA_PATH` | ./data | Data storage path |
| `DEVONN_API_PORT` | 3456 | API server port |
| `DEVONN_API_HOST` | 127.0.0.1 | API server host |

## 📁 File Structure

```
devonn/
├── bootstrap.js           # Main entry point
├── api-server.js          # HTTP API server
├── cli.js                 # Command-line interface
├── cron-bootstrap.sh      # Cron wrapper script
├── package.json           # Dependencies
├── INTEGRATION.md         # Integration guide
├── core/
│   ├── schedulerBrain.js  # Central orchestration
│   └── healthGovernor.js  # System health monitoring
├── queue/
│   └── taskQueue.js       # Priority queue management
├── agents/
│   ├── agentRouter.js     # Task routing
│   └── selfHealing.js     # Failure recovery
├── analytics/
│   └── schedulerInsights.js # Performance learning
└── data/                  # Persisted state
    ├── taskQueue.json
    ├── taskQueue.dlq.json
    ├── insights.json
    └── scheduler.log
```

## 🔒 Production Deployment

### Systemd Service

```bash
# Copy service files
sudo cp devonn-scheduler.service /etc/systemd/system/
sudo cp devonn-api.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable devonn-scheduler
sudo systemctl enable devonn-api
sudo systemctl start devonn-scheduler
sudo systemctl start devonn-api

# Check status
sudo systemctl status devonn-scheduler
sudo systemctl status devonn-api
```

### Cron Bootstrap (Alternative)

Add to crontab:

```bash
* * * * * /home/ubuntu/.openclaw/workspace/devonn/cron-bootstrap.sh
```

## 📈 Monitoring

```bash
# View logs
tail -f data/scheduler.log

# Check status
npm run status

# System health
npm run health

# Queue depth
npm run queue
```

## 🚧 Troubleshooting

### Scheduler Won't Start

```bash
# Check Node.js version
node --version  # Requires >= 18

# Check permissions
ls -la bootstrap.js

# Run directly for errors
node bootstrap.js
```

### Tasks Not Executing

```bash
# Check queue
npm run queue

# Check health
npm run health

# View logs
tail -100 data/scheduler.log
```

### High Failure Rate

```bash
# Check status for recommendations
npm run status

# View dead letter queue
cat data/taskQueue.dlq.json | head -50
```

## 🔄 Migration from Cron

See `INTEGRATION.md` for detailed migration guide.

Quick summary:

1. Replace all cron entries with single bootstrap
2. Convert cron jobs to scheduled tasks
3. Use CLI or API to submit tasks
4. Monitor and tune

## 🛣️ Roadmap

- [x] Core scheduler brain
- [x] Priority queues
- [x] Health governor
- [x] Self-healing engine
- [x] Analytics layer
- [x] HTTP API
- [ ] Distributed multi-node
- [ ] DAG-based workflows
- [ ] Real-time dashboard
- [ ] GPT-driven task planning

## 📜 License

MIT

---

Built for autonomous execution. No more static scheduling.
