"""
NetWatch Windows Service Wrapper
Runs the network monitor as a Windows background service.

Install:  python netwatch_service.py install
Start:    python netwatch_service.py start
Stop:     python netwatch_service.py stop
Remove:   python netwatch_service.py remove

Or via sc.exe:
  sc create NetWatch binPath= "C:\\Python3xx\\python.exe C:\\NetWatch\\netwatch_service.py"
  sc start NetWatch
  sc stop NetWatch
  sc delete NetWatch

Requires: pip install pywin32 psutil requests
Must be run as Administrator.
"""

import os
import sys
import time
import logging

# Add the monitor directory to the path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

try:
    import win32serviceutil
    import win32service
    import win32event
    import servicemanager
except ImportError:
    print("""
ERROR: pywin32 is required for Windows service support.
Install with: pip install pywin32

After installing, run: python Scripts/pywin32_postinstall.py -install
(from your Python installation directory)

Alternatively, run netwatch_monitor.py directly for manual operation.
""")
    sys.exit(1)

from netwatch_monitor import NetWatchMonitor

# Configuration
API_URL = os.environ.get("NETWATCH_API_URL", "http://localhost:5000")
LOG_DIR = os.path.join(os.environ.get("PROGRAMDATA", "C:\\ProgramData"), "NetWatch")


class NetWatchService(win32serviceutil.ServiceFramework):
    _svc_name_ = "NetWatch"
    _svc_display_name_ = "NetWatch Network Monitor"
    _svc_description_ = "Monitors IPv4 and IPv6 network traffic on your home network"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.monitor = None

        # Setup logging
        os.makedirs(LOG_DIR, exist_ok=True)
        logging.basicConfig(
            filename=os.path.join(LOG_DIR, "netwatch.log"),
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(message)s",
        )

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        if self.monitor:
            self.monitor.stop()
        logging.info("NetWatch service stopping")

    def SvcDoRun(self):
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, ""),
        )
        logging.info("NetWatch service starting")
        self.main()

    def main(self):
        self.monitor = NetWatchMonitor(API_URL)
        self.monitor.run()


if __name__ == "__main__":
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(NetWatchService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(NetWatchService)
