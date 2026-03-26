#!/usr/bin/env bash
set -euo pipefail

# ============================================
#   NetWatch — Quick Start (Linux)
#   Runs both the dashboard and monitor in
#   the foreground for development / testing.
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    echo
    echo -e "${YELLOW}Shutting down NetWatch...${NC}"
    # Kill background dashboard
    if [[ -n "${DASH_PID:-}" ]]; then
        kill "$DASH_PID" 2>/dev/null || true
        wait "$DASH_PID" 2>/dev/null || true
    fi
    echo "Done."
}
trap cleanup EXIT INT TERM

echo "============================================"
echo "  NetWatch — Quick Start"
echo "============================================"
echo

# Check deps
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is required. Install it first."
    exit 1
fi

if ! python3 -c "import psutil, requests" 2>/dev/null; then
    echo "Installing Python dependencies..."
    pip3 install psutil requests 2>/dev/null || python3 -m pip install psutil requests
fi

# Install Node deps if needed
cd "$PROJECT_DIR"
if [[ ! -d node_modules ]]; then
    echo "Installing Node.js dependencies..."
    npm install --silent
    npx drizzle-kit push 2>/dev/null
fi

# Start dashboard in background
echo -e "${GREEN}[1/2]${NC} Starting dashboard on http://localhost:5000 ..."
npm run dev &
DASH_PID=$!

# Wait for dashboard
echo "     Waiting for dashboard to start..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:5000 >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo -e "${GREEN}[2/2]${NC} Starting network monitor..."
echo
echo -e "${YELLOW}NOTE:${NC} For full connection tracking, run with sudo:"
echo "  sudo $0"
echo
echo "Press Ctrl+C to stop."
echo "--------------------------------------------"
echo

# Start monitor in foreground
python3 "$SCRIPT_DIR/netwatch_monitor.py" --verbose
