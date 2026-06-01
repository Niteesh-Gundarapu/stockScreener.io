@echo off
REM Stock Screener - NSE API Implementation Quick Start Script (Windows)
REM This script helps you set up and test the new NSE data API integration

setlocal enabledelayedexpansion

echo.
echo ===========================================
echo Stock Screener - NSE API Quick Start
echo ===========================================
echo.

REM Step 1: Check Node.js
echo [Step 1] Checking Node.js installation...
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js found: %NODE_VER%
echo.

REM Step 2: Navigate to backend
echo [Step 2] Navigating to backend directory...
cd /d backend
if errorlevel 1 (
    echo [ERROR] backend directory not found
    pause
    exit /b 1
)
echo [OK] In backend directory
echo.

REM Step 3: Install dependencies
echo [Step 3] Installing backend dependencies...
if exist node_modules (
    echo [OK] node_modules already exists, skipping npm install
) else (
    echo Installing npm packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)
echo [OK] Dependencies ready
echo.

REM Step 4: Setup .env
echo [Step 4] Checking environment configuration...
if not exist .env (
    echo [WARNING] .env file not found. Creating from template...
    copy .env.example .env
    echo [OK] Created .env file
    echo.
    echo [ACTION REQUIRED] Please edit backend\.env and add your API keys:
    echo   - UPSTOX_API_KEY (optional but recommended)
    echo   - RAPIDAPI_KEY (optional fallback)
    echo.
    echo Get Upstox key at: https://upstox.com/api/
    echo.
    echo Press any key to continue...
    pause
) else (
    echo [OK] .env file exists
)
echo.

REM Step 5: Syntax validation
echo [Step 5] Validating code syntax...
node -c index.js
if errorlevel 1 (
    echo [ERROR] Syntax error in index.js
    pause
    exit /b 1
)
node -c scraper.js
if errorlevel 1 (
    echo [ERROR] Syntax error in scraper.js
    pause
    exit /b 1
)
node -c services\nseDataService.js
if errorlevel 1 (
    echo [ERROR] Syntax error in nseDataService.js
    pause
    exit /b 1
)
echo [OK] All files have valid syntax
echo.

REM Step 6: Start development server
echo ===========================================
echo [READY] Starting Stock Screener Backend
echo ===========================================
echo.
echo Server will start at: http://localhost:5000
echo.
echo Available API endpoints:
echo   * GET /api/market/gainers
echo   * GET /api/market/losers
echo   * GET /api/market/leaders
echo.
echo To test the API (open another terminal):
echo   curl http://localhost:5000/api/market/gainers
echo.
echo Press Ctrl+C to stop the server
echo.
timeout /t 3 /nobreak

echo Starting development server...
echo.
call npm run dev
