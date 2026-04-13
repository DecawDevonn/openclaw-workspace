#!/bin/bash
# Devonn.ai Autonomous Scheduler - Bootstrap Entry Point
# This is the ONLY cron job needed - everything else is event-driven

export HOME=/home/ubuntu
export PATH="$HOME/.local/bin:$PATH"

cd "$HOME/.openclaw/workspace"

# Check if already running
if pgrep -f "tsx bootstrap.ts" > /dev/null; then
    echo "[$(date)] Scheduler already running"
    exit 0
fi

# Start the autonomous scheduler
echo "[$(date)] Starting Devonn.ai Autonomous Scheduler..."
npx tsx bootstrap.ts > "$HOME/.openclaw/logs/scheduler.log" 2>&1 &
echo $! > "$HOME/.openclaw/scheduler.pid"
echo "[$(date)] Scheduler started with PID $(cat "$HOME/.openclaw/scheduler.pid")"
