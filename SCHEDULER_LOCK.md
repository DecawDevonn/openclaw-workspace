# SCHEDULER LOCK — Active Path Configuration

## ⚠️ DEPRECATION NOTICE

**Active System:** `/devonn/`  
**Deprecated:** Root `/core/` and `/queue/` directories

---

## Status

| Component | Path | Status |
|-----------|------|--------|
| Scheduler Brain | `/devonn/core/schedulerBrain.js` | ✅ Active |
| Event Loop | `/devonn/core/eventLoop.js` | ✅ Active |
| Health Governor | `/devonn/core/healthGovernor.js` | ✅ Active |
| Task Queue | `/devonn/queue/taskQueue.js` | ✅ Active |
| Self-Healing | `/devonn/agents/selfHealing.js` | ✅ Active |
| Bootstrap | `/devonn/bootstrap.js` | ✅ Active |

---

## Deprecated (Do Not Use)

| Component | Path | Status |
|-----------|------|--------|
| Event Loop (incomplete) | `/core_incomplete_rewrite_backup/eventLoop.js` | ❌ Deprecated |
| Health Governor (incomplete) | `/core_incomplete_rewrite_backup/healthGovernor.js` | ❌ Deprecated |
| Task Queue (incomplete) | `/queue_incomplete_rewrite_backup/taskQueue.js` | ❌ Deprecated |

---

## Launch Command

```bash
cd /home/ubuntu/.openclaw/workspace/devonn && node bootstrap.js
```

## Check Status

```bash
ps aux | grep "node bootstrap.js"
tail -f /home/ubuntu/.openclaw/workspace/devonn/scheduler.log
```

---

## Reconciliation Plan

The root-level rewrite in `/core/` and `/queue/` was an incomplete refactor attempt.  
The `/devonn/` implementation is complete and production-ready.

**Future:** When ready to refactor, reconcile the two implementations by:
1. Reviewing `/devonn/` for lessons learned
2. Planning a proper migration path
3. Testing thoroughly before switching

---

*Locked: 2026-04-25*  
*Active Scheduler: /devonn/*
