# NetWatch — Home Network Traffic Monitor

A real-time network traffic monitor for **Windows and Linux** that tracks both IPv4 and IPv6 traffic across your home network. Features a live web dashboard with bandwidth charts, connection logging, protocol split visualization, and configurable alerts.

## Architecture

```
┌─────────────────────┐     REST API      ┌──────────────────────┐
│  netwatch_monitor.py │ ──────────────── │  Node.js Dashboard   │
│  (Python, psutil)    │   POST /api/*    │  (Express + React)   │
│                      │                  │  port 8080           │
│  Captures:           │     WebSocket    │                      │
│  - Bandwidth (v4/v6) │ ◄────────────── │  Pushes live data    │
│  - Connections       │                  │  to all browsers     │
│  - Alert triggers    │                  │                      │
└─────────────────────┘                  └──────────────────────┘
         ▲                                         ▲
         │ psutil + /proc (Linux)                  │ browser
     ┌───┴───┐                                 ┌───┴───┐
     │  NIC  │                                 │  You  │
     └───────┘                                 └───────┘
```

## Features

- **Dual-stack monitoring** — Tracks IPv4 and IPv6 traffic separately with per-protocol bandwidth charts
- **Live bandwidth chart** — Real-time area chart with 2-second resolution, filterable by protocol
- **Connection logging** — Active TCP/UDP connections with remote IP, port, process name, and status
- **Protocol split visualization** — Donut charts showing IPv4 vs IPv6 bandwidth and connection ratios
- **Alert engine** — Detects traffic spikes and threshold breaches with configurable rules
- **Web dashboard** — Dark-themed, responsive UI accessible from any device on your network
- **Cross-platform** — Works on Windows and Linux with platform-specific optimizations
- **Background service** — Windows service or Linux systemd daemon for always-on monitoring

### Linux-Specific Enhancements

- **Real per-protocol byte counters** — Reads `/proc/net/snmp6` and `/proc/net/netstat` for exact IPv4/IPv6 traffic split instead of estimating from connection ratios
- **Default interface detection** — Reads the kernel routing table (`/proc/net/route`) to find the primary NIC
- **Virtual interface filtering** — Automatically skips Docker, libvirt, VirtualBox, and other virtual adapters
- **systemd integration** — Proper service units with security hardening (capability-based privileges, filesystem protection)

## Prerequisites

| Requirement | Windows | Linux | Docker |
|---|---|---|---|
| **Node.js** 18+ | [nodejs.org](https://nodejs.org/) | `apt install nodejs npm` | Not needed |
| **Python** 3.9+ | [python.org](https://www.python.org/downloads/) | `apt install python3 python3-pip` | Not needed |
| **Docker** (optional) | [Docker Desktop](https://docker.com) | `apt install docker.io docker-compose-v2` | Required |

---

## Docker Setup (Recommended)

The easiest way to run NetWatch. Two containers: the dashboard (Node.js) and the monitor (Python).

```bash
# Clone the repo
git clone https://github.com/justjeffsec/NetWatch.git
cd NetWatch

# Build and start both services
docker compose up -d
```

Dashboard: **http://localhost:8080**

### Docker Commands

```bash
# View logs
docker compose logs -f
docker compose logs -f monitor    # monitor only
docker compose logs -f dashboard   # dashboard only

# Stop
docker compose down

# Rebuild after pulling updates
git pull
docker compose up -d --build

# Reset database
docker compose down -v
docker compose up -d
```

### How it works

- The **dashboard** container runs the Node.js server on port 8080
- The **monitor** container runs with `network_mode: host` so it can see your real network interfaces and connections (not just Docker's virtual network)
- SQLite data is persisted in a Docker volume (`netwatch-data`)
- The monitor waits for the dashboard health check to pass before starting
- Both containers auto-restart on failure

### Docker Requirements

The monitor needs `NET_ADMIN` and `NET_RAW` capabilities (configured in `docker-compose.yml`) and host networking to see real traffic. This is similar to running with `sudo` — it's needed for `psutil` to read `/proc/net` and enumerate connections.

---

## Linux Setup

### Quick Start (Development)

```bash
# Clone or extract NetWatch, then:
cd netwatch

# Install dependencies
npm install
npx drizzle-kit push
pip3 install psutil requests

# Start everything (dashboard + monitor)
./monitor/start-linux.sh

# For full connection tracking, run with sudo:
sudo ./monitor/start-linux.sh
```

The dashboard will be available at **http://localhost:8080**

### One-Command Install (Production)

Installs to `/opt/netwatch` with systemd services that start on boot:

```bash
sudo ./monitor/install-linux.sh
```

This will:
1. Check that Node.js and Python 3 are available
2. Install Python dependencies (psutil, requests)
3. Create a dedicated `netwatch` system user
4. Copy the project to `/opt/netwatch` and build it
5. Install and enable two systemd services
6. Start everything automatically

### Service Management

```bash
# Check status
sudo systemctl status netwatch-dashboard
sudo systemctl status netwatch-monitor

# View live monitor logs
sudo journalctl -u netwatch-monitor -f

# Restart after config changes
sudo systemctl restart netwatch-dashboard
sudo systemctl restart netwatch-monitor

# Stop
sudo systemctl stop netwatch-dashboard netwatch-monitor

# Disable auto-start
sudo systemctl disable netwatch-dashboard netwatch-monitor
```

### Uninstall (Linux)

```bash
sudo ./monitor/uninstall-linux.sh
```

Or manually:
```bash
sudo systemctl disable --now netwatch-dashboard netwatch-monitor
sudo rm /etc/systemd/system/netwatch-*.service
sudo rm -rf /opt/netwatch
sudo userdel netwatch
```

### Linux Permissions

The monitor needs elevated privileges for full connection tracking:

| Method | Pros | Cons |
|---|---|---|
| `sudo` | Full visibility | Runs entire script as root |
| `CAP_NET_ADMIN` capability | Least-privilege | Needs `setcap` on the Python binary |
| systemd service | Auto-handled by the unit file | Requires install script |

The systemd service file grants `CAP_NET_ADMIN` and `CAP_NET_RAW` capabilities without running as root.

To run the monitor manually with capabilities:
```bash
sudo setcap cap_net_admin,cap_net_raw+ep $(which python3)
python3 monitor/netwatch_monitor.py
```

### Firewall (Linux)

To access the dashboard from other devices on your LAN:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 8080/tcp comment "NetWatch"

# firewalld (Fedora/RHEL)
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

---

## Windows Setup

### Quick Start

```powershell
cd netwatch
npm install
npx drizzle-kit push
pip install psutil requests

# Start the dashboard
npm run dev

# Open a new terminal as Administrator, start the monitor
cd monitor
python netwatch_monitor.py
```

### Batch Files

```powershell
# First time setup (run as Administrator)
monitor\install.bat

# Start everything
monitor\start.bat
```

### Windows Service (Optional)

For always-on monitoring that starts with Windows:

```powershell
pip install pywin32
python -c "import win32com" 2>nul || python Scripts\pywin32_postinstall.py -install

cd monitor
python netwatch_service.py install
python netwatch_service.py start
```

Service management:
```powershell
python netwatch_service.py stop
python netwatch_service.py remove
```

### Firewall (Windows)

```powershell
netsh advfirewall firewall add rule name="NetWatch" dir=in action=allow protocol=tcp localport=8080
```

---

## Dashboard Overview

| Section | Description |
|---|---|
| **KPI Cards** | Download/upload rates, active connections, alert count — all split by IPv4/IPv6 |
| **Bandwidth Chart** | Real-time area chart with tabs to filter All / IPv4 / IPv6 |
| **Protocol Split** | Donut charts showing IPv4 vs IPv6 ratio for bandwidth and connections |
| **Alerts Panel** | Live alert feed with dismiss controls |
| **Connections Table** | Filterable table of active connections with IP, port, process, and status |

## How It Works

### Bandwidth Tracking

The Python monitor uses `psutil.net_io_counters(pernic=True)` to sample byte counters on each network interface every 2 seconds and calculates throughput deltas.

**Linux:** Reads `/proc/net/netstat` (IpExt InOctets/OutOctets) and `/proc/net/snmp6` (Ip6InOctets/Ip6OutOctets) for the real per-protocol byte split. This is kernel-level accounting — no estimation needed.

**Windows:** Estimates the IPv4/IPv6 split based on the ratio of active connections per address family (`AF_INET` vs `AF_INET6`).

### Connection Scanning

Every 5 seconds, the monitor calls `psutil.net_connections(kind="inet")` to enumerate all TCP and UDP connections. Each connection includes protocol, address family, local/remote addresses with ports, status, and process name.

### Alert Engine

The monitor maintains a rolling 30-sample baseline. If current throughput exceeds 5x the baseline, a spike alert fires (with a 60-second cooldown).

### Real-time Updates

The dashboard uses WebSocket to push data to all connected browsers instantly.

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/bandwidth?since=<ms>` | Bandwidth snapshots since timestamp |
| GET | `/api/bandwidth/latest` | Latest 20 bandwidth records |
| POST | `/api/bandwidth` | Push a bandwidth snapshot |
| GET | `/api/connections?limit=200` | Recent connections |
| GET | `/api/connections/active` | Currently established connections |
| POST | `/api/connections` | Push a connection record |
| GET | `/api/alerts?limit=100` | Recent alerts |
| PATCH | `/api/alerts/:id/dismiss` | Dismiss an alert |
| POST | `/api/alerts/dismiss-all` | Dismiss all alerts |
| GET | `/api/thresholds` | List alert thresholds |
| POST | `/api/thresholds` | Create a threshold |
| DELETE | `/api/thresholds/:id` | Delete a threshold |
| GET | `/api/stats` | Summary statistics |

## Troubleshooting

| Issue | Platform | Solution |
|---|---|---|
| No connections shown | Both | Run with elevated privileges (sudo / Administrator) |
| Dashboard won't start | Both | Check port 8080: `ss -tlnp \| grep 8080` or `netstat -an \| findstr 8080` |
| Monitor can't connect | Both | Verify dashboard is running, check `--api-url` |
| Empty IPv6 data on Linux | Linux | Verify `/proc/net/snmp6` exists: `cat /proc/net/snmp6 \| head` |
| Service won't start | Linux | Check logs: `journalctl -u netwatch-monitor -e` |
| Service won't install | Windows | Install pywin32 and run the postinstall script |

## File Structure

```
netwatch/
├── client/                          # React frontend
│   └── src/
│       ├── components/              # Dashboard components
│       ├── lib/                     # Utilities, WebSocket hook
│       └── pages/                   # Dashboard page
├── server/                          # Express backend
│   ├── routes.ts                    # API routes + WebSocket + simulator
│   └── storage.ts                   # SQLite database layer
├── shared/
│   └── schema.ts                    # Database schema (Drizzle ORM)
├── monitor/                         # Python network monitor
│   ├── netwatch_monitor.py          # Cross-platform monitor script
│   ├── netwatch_service.py          # Windows service wrapper
│   ├── netwatch-dashboard.service   # Linux systemd unit (dashboard)
│   ├── netwatch-monitor.service     # Linux systemd unit (monitor)
│   ├── Dockerfile                   # Monitor container image
│   ├── install.bat                  # Windows setup script
│   ├── start.bat                    # Windows quick start
│   ├── install-linux.sh             # Linux setup script (production)
│   ├── start-linux.sh               # Linux quick start (development)
│   ├── uninstall-linux.sh           # Linux uninstall script
│   └── requirements.txt             # Python dependencies
├── Dockerfile                       # Dashboard container image
├── docker-compose.yml               # Docker orchestration
├── .dockerignore                    # Docker build exclusions
└── README.md
```
