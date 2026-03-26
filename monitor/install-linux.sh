#!/usr/bin/env bash
set -euo pipefail

# ============================================
#   NetWatch — Linux Installation Script
# ============================================

INSTALL_DIR="/opt/netwatch"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; }

# --- Pre-flight checks ---

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)."
    exit 1
fi

echo "============================================"
echo "  NetWatch — Network Traffic Monitor Setup"
echo "  Platform: Linux ($(uname -r))"
echo "============================================"
echo

# --- Check dependencies ---

echo "[1/6] Checking dependencies..."

if ! command -v node &>/dev/null; then
    error "Node.js is not installed."
    echo "  Install with your package manager:"
    echo "    Ubuntu/Debian: sudo apt install nodejs npm"
    echo "    Fedora/RHEL:   sudo dnf install nodejs npm"
    echo "    Arch:           sudo pacman -S nodejs npm"
    echo "  Or use nvm: https://github.com/nvm-sh/nvm"
    exit 1
fi
info "Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
    error "npm is not installed. Install it alongside Node.js."
    exit 1
fi

if ! command -v python3 &>/dev/null; then
    error "Python 3 is not installed."
    echo "  Install with: sudo apt install python3 python3-pip"
    exit 1
fi
info "Python $(python3 --version 2>&1 | cut -d' ' -f2)"

# --- Install Python deps ---

echo
echo "[2/6] Installing Python dependencies..."
pip3 install --quiet psutil requests 2>/dev/null || \
    python3 -m pip install --quiet psutil requests
info "psutil and requests installed"

# --- Create netwatch user ---

echo
echo "[3/6] Setting up netwatch user..."
if ! id -u netwatch &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin netwatch
    info "Created system user 'netwatch'"
else
    info "User 'netwatch' already exists"
fi

# --- Copy project ---

echo
echo "[4/6] Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
# Copy project files (exclude node_modules, .git, db files)
rsync -a --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.db' \
    --exclude='*.db-wal' \
    --exclude='*.db-shm' \
    --exclude='dist' \
    "$PROJECT_DIR/" "$INSTALL_DIR/"

# Install Node dependencies and build
cd "$INSTALL_DIR"
npm install --production=false --silent 2>/dev/null
npx drizzle-kit push 2>/dev/null
npm run build 2>/dev/null
info "Project installed and built"

# Fix ownership
chown -R netwatch:netwatch "$INSTALL_DIR"

# --- Install systemd services ---

echo
echo "[5/6] Installing systemd services..."
cp "$SCRIPT_DIR/netwatch-dashboard.service" /etc/systemd/system/
cp "$SCRIPT_DIR/netwatch-monitor.service" /etc/systemd/system/
systemctl daemon-reload
info "Systemd units installed"

# --- Enable and start ---

echo
echo "[6/6] Starting services..."
systemctl enable --now netwatch-dashboard.service
sleep 3
systemctl enable --now netwatch-monitor.service
info "Services started"

echo
echo "============================================"
echo -e "  ${GREEN}NetWatch installation complete!${NC}"
echo "============================================"
echo
echo "  Dashboard:  http://localhost:5000"
echo "              (or http://$(hostname -I 2>/dev/null | awk '{print $1}'):5000)"
echo
echo "  Service commands:"
echo "    sudo systemctl status  netwatch-dashboard"
echo "    sudo systemctl status  netwatch-monitor"
echo "    sudo systemctl restart netwatch-dashboard"
echo "    sudo systemctl restart netwatch-monitor"
echo "    sudo journalctl -u netwatch-monitor -f     # live logs"
echo
echo "  To uninstall:"
echo "    sudo systemctl disable --now netwatch-dashboard netwatch-monitor"
echo "    sudo rm /etc/systemd/system/netwatch-*.service"
echo "    sudo rm -rf $INSTALL_DIR"
echo "    sudo userdel netwatch"
echo "============================================"
