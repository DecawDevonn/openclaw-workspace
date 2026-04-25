#!/bin/bash
# DEVONN.ai - Cron Bootstrap Entry Point
# This is the ONLY cron job needed - starts the autonomous scheduler if not running

SCHEDULER_DIR="/home/ubuntu/.openclaw/workspace/devonn"
PIDFILE="$SCHEDULER_DIR/data/scheduler.pid"
LOGFILE="$SCHEDULER_DIR/data/scheduler.log"

# Check if already running
if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "[$(date)] Scheduler already running (PID: $PID)"
        exit 0
    else
        echo "[$(date)] Stale PID file found, removing"
        rm "$PIDFILE"
    fi
fi

# Start the scheduler
echo "[$(date)] Starting DEVONN.ai Autonomous Scheduler..."
cd "$SCHEDULER_DIR" || exit 1

# Run in background, log output
nohup node bootstrap.js >> "$LOGFILE" 2>&1 &
NEW_PID=$!

# Save PID
echo "$NEW_PID" > "$PIDFILE"
echo "[$(date)] Scheduler started (PID: $NEW_PID)"
