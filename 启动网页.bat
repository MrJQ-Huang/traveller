@echo off
setlocal

cd /d "%~dp0"

set "APP_URL=http://127.0.0.1:5173/"
set "AGENT_URL=http://127.0.0.1:8787/health"

echo.
echo ================================
echo  Changshu Map Demo Launcher
echo ================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js first: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Please check your Node.js installation.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [SETUP] node_modules was not found. Installing dependencies...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Please check your network or npm setup.
    echo.
    pause
    exit /b 1
  )
)

if not exist "logs" mkdir logs

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%AGENT_URL%' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [AGENT] Xiaochang adapter is not running. Starting it in background...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run agent:llm ^> logs\xiaochang-agent.log 2^>^&1' -WorkingDirectory '%CD%' -WindowStyle Hidden" >nul 2>nul
  timeout /t 2 /nobreak >nul
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%AGENT_URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
  if errorlevel 1 (
    echo [AGENT] Adapter did not respond. The page will still open and Xiaochang will fall back to the local rule brain.
    echo [AGENT] Check logs\xiaochang-agent.log if needed.
  ) else (
    echo [AGENT] Xiaochang adapter is ready.
  )
) else (
  echo [AGENT] Existing Xiaochang adapter found.
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%APP_URL%' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo [OPEN] Existing local web server found.
  echo [URL]  %APP_URL%
  start "" "%APP_URL%"
  echo.
  echo The page has been opened in your browser.
  echo If code changes do not update, stop the old server and run this script again.
  echo.
  pause
  exit /b 0
)

echo [START] Starting local web server...
echo [URL]   %APP_URL%
echo.
echo The browser will open automatically after the server is ready.
echo If it does not open, copy the URL above into your browser.
echo Close this window or press Ctrl+C to stop the web server.
echo.

call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open /

echo.
echo Web server stopped.
pause
