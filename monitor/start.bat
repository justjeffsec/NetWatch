@echo off
echo Starting NetWatch...
echo.

:: Start the dashboard server in background
echo [1/2] Starting dashboard on http://localhost:5000 ...
cd /d "%~dp0.."
start "NetWatch Dashboard" cmd /c "npm run dev"

:: Wait for server to start
timeout /t 5 /nobreak >nul

:: Start the monitor
echo [2/2] Starting network monitor (requires admin)...
echo.
echo NOTE: For full connection tracking, run this terminal as Administrator.
echo Press Ctrl+C to stop monitoring.
echo.
cd /d "%~dp0"
python netwatch_monitor.py --verbose

pause
