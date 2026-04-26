#!/bin/bash
# DEVONN Scheduler Service Installer
# Run with sudo

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        DEVONN Scheduler Service Installer               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root or with sudo"
  exit 1
fi

WORKSPACE_DIR="/home/ubuntu/.openclaw/workspace"
SERVICE_DIR="$WORKSPACE_DIR/devonn"

echo "📁 Installing services from $SERVICE_DIR..."

# Copy service files
cp "$SERVICE_DIR/devonn-scheduler.service" /etc/systemd/system/
cp "$SERVICE_DIR/devonn-ecosystem.service" /etc/systemd/system/

echo "✅ Service files copied"

# Create .env if not exists
if [ ! -f "$WORKSPACE_DIR/.env" ]; then
  echo "⚠️  Creating default .env file..."
  cat > "$WORKSPACE_DIR/.env" << 'EOF'
# DEVONN Scheduler Environment
DEVONN_TICK_INTERVAL=2000
DEVONN_MAX_CONCURRENT=5
DEVONN_DEFAULT_TIMEOUT=300000
DEVONN_DATA_PATH=./data
DEVONN_API_PORT=7373
ENABLE_ECOSYSTEM=false
EOF
  echo "⚠️  Please edit $WORKSPACE_DIR/.env and add your GITHUB_TOKEN"
fi

# Fix permissions
chown -R ubuntu:ubuntu "$WORKSPACE_DIR"
chmod 644 /etc/systemd/system/devonn-*.service

echo "✅ Permissions set"

# Reload systemd
systemctl daemon-reload

echo "✅ Systemd reloaded"

# Enable services
systemctl enable devonn-scheduler
systemctl enable devonn-ecosystem

echo "✅ Services enabled"

echo
echo "═══════════════════════════════════════════════════════════"
echo "  Installation complete!"
echo "═══════════════════════════════════════════════════════════"
echo
echo "Next steps:"
echo "  1. Edit .env:   nano $WORKSPACE_DIR/.env"
echo "  2. Start:      sudo systemctl start devonn-scheduler"
echo "  3. Check:       sudo systemctl status devonn-scheduler"
echo "  4. Logs:        sudo journalctl -u devonn-scheduler -f"
echo
echo "Health check:"
echo "  curl http://localhost:7373/health"
echo
