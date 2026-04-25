#!/bin/bash
# install.sh — Install MyClaw Autonomous Scheduler OS

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INSTALL_DIR="${HOME}/MyClaw"
DATA_DIR="${HOME}/.myclaw/data"
LOG_DIR="${HOME}/.myclaw/logs"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     MyClaw Autonomous Scheduler OS v2.0                  ║${NC}"
echo -e "${BLUE}║     Installation Script                                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo

# Check Node.js version
echo -e "${YELLOW}→ Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version 18+ required. Found: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Create directories
echo -e "${YELLOW}→ Creating directories...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"
echo -e "${GREEN}✓ Directories created${NC}"

# Check if source files exist
if [ ! -f "bootstrap.js" ]; then
    echo -e "${RED}✗ Installation must be run from the MyClaw directory${NC}"
    exit 1
fi

# Install dependencies (if any)
if [ -f "package.json" ]; then
    echo -e "${YELLOW}→ Installing dependencies...${NC}"
    npm install --production
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Create CLI symlink
echo -e "${YELLOW}→ Installing CLI...${NC}"
CLI_PATH="${INSTALL_DIR}/cli.js"
if [ -f "cli.js" ]; then
    chmod +x cli.js
fi

# Create systemd service file (optional)
echo -e "${YELLOW}→ Creating systemd service file...${NC}"
SERVICE_FILE="${HOME}/.config/systemd/user/myclaw.service"
mkdir -p "$(dirname "$SERVICE_FILE")"

cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=MyClaw Autonomous Scheduler OS
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/MyClaw
ExecStart=/usr/bin/node bootstrap.js
Restart=always
RestartSec=5
Environment="NODE_ENV=production"

[Install]
WantedBy=default.target
EOF

echo -e "${GREEN}✓ Service file created${NC}"
echo -e "  ${BLUE}To enable: systemctl --user enable myclaw.service${NC}"
echo -e "  ${BLUE}To start:  systemctl --user start myclaw.service${NC}"

# Create cron wrapper
echo -e "${YELLOW}→ Creating cron wrapper...${NC}"
CRON_WRAPPER="${INSTALL_DIR}/cron-wrapper.sh"

cat > "$CRON_WRAPPER" << 'EOF'
#!/bin/bash
# cron-wrapper.sh — Keep MyClaw running via cron

INSTALL_DIR="$HOME/MyClaw"
LOCK_FILE="$HOME/.myclaw/scheduler.lock"
LOG_FILE="$HOME/.myclaw/logs/cron.log"

mkdir -p "$(dirname "$LOCK_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

# Check if already running
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "$(date): MyClaw already running (PID: $PID)" >> "$LOG_FILE"
        exit 0
    else
        echo "$(date): Removing stale lock file" >> "$LOG_FILE"
        rm -f "$LOCK_FILE"
    fi
fi

# Start MyClaw
echo "$(date): Starting MyClaw..." >> "$LOG_FILE"
cd "$INSTALL_DIR" || exit 1

# Start in background
node bootstrap.js >> "$LOG_FILE" 2>&1 &
NEWPID=$!

# Save PID
echo "$NEWPID" > "$LOCK_FILE"

sleep 2

# Verify it started
if ps -p "$NEWPID" > /dev/null 2>&1; then
    echo "$(date): MyClaw started successfully (PID: $NEWPID)" >> "$LOG_FILE"
else
    echo "$(date): MyClaw failed to start" >> "$LOG_FILE"
    rm -f "$LOCK_FILE"
    exit 1
fi

exit 0
EOF

chmod +x "$CRON_WRAPPER"
echo -e "${GREEN}✓ Cron wrapper created${NC}"

# Create crontab entry suggestion
echo

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  CRON SETUP                                               ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo
echo -e "Add this to your crontab to keep MyClaw running:"
echo
echo -e "  ${GREEN}* * * * * $CRON_WRAPPER${NC}"
echo
echo -e "Or run once at boot:"
echo
echo -e "  ${GREEN}@reboot $CRON_WRAPPER${NC}"
echo

# Final summary
echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Installation Complete!                               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${BLUE}Installation Directory:${NC} $INSTALL_DIR"
echo -e "${BLUE}Data Directory:${NC}       $DATA_DIR"
echo -e "${BLUE}Log Directory:${NC}        $LOG_DIR"
echo
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. ${GREEN}cd $INSTALL_DIR${NC}"
echo -e "  2. ${GREEN}node bootstrap.js${NC} to start the system"
echo -e "  3. Or use cron to keep it running automatically"
echo

echo -e "${BLUE}For help:${NC} node cli.js --help"
echo
