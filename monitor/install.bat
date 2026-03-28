@echo off
echo ============================================
echo   NetWatch - Network Traffic Monitor Setup
echo ============================================
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

:: Check Python
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Download from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/4] Installing Python dependencies...
pip install psutil requests >nul 2>&1
if %errorLevel% neq 0 (
    echo WARNING: Failed to install some dependencies.
    echo Run manually: pip install psutil requests
)

echo [2/4] Installing Node.js dependencies...
cd /d "%~dp0.."
call npm install >nul 2>&1
if %errorLevel% neq 0 (
    echo WARNING: npm install failed. Make sure Node.js is installed.
    echo Download from https://nodejs.org/
)

echo [3/4] Setting up database...
call npx drizzle-kit push >nul 2>&1

echo [4/4] Setup complete!
echo.
echo ============================================
echo   How to use NetWatch:
echo ============================================
echo.
echo   1. Start the dashboard:
echo      cd %~dp0..
echo      npm run dev
echo.
echo   2. Open in browser:
echo      http://localhost:8080
echo.
echo   3. Start the monitor (new terminal, as Admin):
echo      cd %~dp0
echo      python netwatch_monitor.py
echo.
echo   4. (Optional) Install as Windows service:
echo      pip install pywin32
echo      python netwatch_service.py install
echo      python netwatch_service.py start
echo.
echo ============================================
pause
