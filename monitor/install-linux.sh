#!/usr/bin/env bash
set -euo pipefail

# ============================================
#   NetWatch — Linux Installation Script
#   Compatible with PEP 668 (externally-managed)
#   distros like Kali, Debian 12+, Ubuntu 23.04+
# ============================================

INSTALL_DIR="/opt/netwatch"
VENV_DIR="/opt/netwatch/monitor/venv"
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

echo "[1/7] Checking dependencies..."

if ! command -v node &>/dev/null; then
    error "Node.js is not installed."
    echo "  Install with your package manager:"
    echo "    Kali/Debian:  sudo apt install nodejs npm"
    echo "    Fedora/RHEL:  sudo dnf install nodejs npm"
    echo "    Arch:          sudo pacman -S nodejs npm"
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
    echo "  Install with: sudo apt install python3 python3-venv"
    exit 1
fi
info "Python $(python3 --version 2>&1 | cut -d' ' -f2)"

# Ensure python3-venv is available (needed on Debian/Kali/Ubuntu)
if ! python3 -m venv --help &>/dev/null; then
    warn "python3-venv not found — attempting to install..."
    if command -v apt &>/dev/null; then
        apt install -y python3-venv
    else
        error "Cannot install python3-venv automatically. Install it manually:"
        echo "  Debian/Kali/Ubuntu: sudo apt install python3-venv"
        echo "  Fedora/RHEL:        sudo dnf install python3"
        exit 1
    fi
fi

# --- Create Python virtual environment ---

echo
echo "[2/7] Creating Python virtual environment..."
mkdir -p "$INSTALL_DIR/monitor"
python3 -m venv "$VENV_DIR"
info "Virtual environment created at $VENV_DIR"

# --- Install Python deps into venv ---

echo
echo "[3/7] Installing Python dependencies (in venv)..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip 2>/dev/null
"$VENV_DIR/bin/pip" install --quiet psutil requests
info "psutil and requests installed"

# --- Create netwatch user ---

echo
echo "[4/7] Setting up netwatch user..."
if ! id -u netwatch &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin netwatch
    info "Created system user 'netwatch'"
else
    info "User 'netwatch' already exists"
fi

# --- Copy project ---

echo
echo "[5/7] Installing to $INSTALL_DIR..."
# Copy project files (exclude node_modules, .git, db files, existing venv)
rsync -a --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.db' \
    --exclude='*.db-wal' \
    --exclude='*.db-shm' \
    --exclude='dist' \
    --exclude='monitor/venv' \
    "$PROJECT_DIR/" "$INSTALL_DIR/"

# Move venv back if rsync --delete removed it
if [[ ! -d "$VENV_DIR" ]]; then
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --quiet --upgrade pip 2>/dev/null
    "$VENV_DIR/bin/pip" install --quiet psutil requests
fi

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
echo "[6/7] Installing systemd services..."
cp "$INSTALL_DIR/monitor/netwatch-dashboard.service" /etc/systemd/system/
cp "$INSTALL_DIR/monitor/netwatch-monitor.service" /etc/systemd/system/
systemctl daemon-reload
info "Systemd units installed"

# --- Enable and start ---

echo
echo "[7/7] Starting services..."
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
echo "    sudo ./monitor/uninstall-linux.sh"
echo "============================================"
