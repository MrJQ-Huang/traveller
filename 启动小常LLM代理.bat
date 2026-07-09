@echo off
setlocal

cd /d "%~dp0"

echo.
echo ================================
echo  Xiaochang LLM Agent Proxy
echo ================================
echo.

if not exist ".env" (
  echo [WARN] .env was not found.
  echo Copy .env.example to .env and fill CCSWITCH_API_BASE_URL / CCSWITCH_MODEL first.
  echo The adapter cannot read CCswitch UI settings automatically; it needs CCswitch's HTTP API address.
  echo.
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  pause
  exit /b 1
)

echo [START] Starting Xiaochang LLM proxy...
echo [URL]   http://127.0.0.1:8787/health
echo.
echo Frontend .env should use:
echo VITE_AGENT_PROVIDER=ccswitch
echo VITE_CCSWITCH_BASE_URL=http://127.0.0.1:8787
echo VITE_CCSWITCH_AGENT_PATH=/agent/chat
echo.
echo Adapter .env should point to your CCswitch OpenAI-compatible endpoint:
echo CCSWITCH_API_BASE_URL=http://127.0.0.1:your_ccswitch_port/v1
echo CCSWITCH_MODEL=your_model_name
echo.
echo Close this window or press Ctrl+C to stop the proxy.
echo.

call npm run agent:llm

echo.
echo Xiaochang LLM proxy stopped.
pause
