#!/usr/bin/env bash
set -euo pipefail

# ============================================
#   NetWatch — Linux Uninstall Script
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[✗]${NC} This script must be run as root (use sudo)."
    exit 1
fi

echo "============================================"
echo "  NetWatch — Uninstall"
echo "============================================"
echo

read -p "This will remove NetWatch completely. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo "Stopping services..."
systemctl disable --now netwatch-dashboard.service 2>/dev/null || true
systemctl disable --now netwatch-monitor.service 2>/dev/null || true

echo "Removing service files..."
rm -f /etc/systemd/system/netwatch-dashboard.service
rm -f /etc/systemd/system/netwatch-monitor.service
systemctl daemon-reload

echo "Removing installation directory..."
rm -rf /opt/netwatch

echo "Removing netwatch user..."
userdel netwatch 2>/dev/null || true

echo
echo -e "${GREEN}[✓]${NC} NetWatch has been uninstalled."
