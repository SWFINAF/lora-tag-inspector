@echo off
title Lora Tag Inspector

echo ============================================
echo   Lora Tag Inspector - Start Server
echo ============================================
echo.

cd /d "%~dp0"

:: Try Python first
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [Method 1] Starting with Python
    echo URL: http://localhost:3000
    echo Press Ctrl+C to stop
    echo.
    start http://localhost:3000
    python -m http.server 3000
    goto :end
)

:: Try Python3
where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [Method 1] Starting with Python3
    echo URL: http://localhost:3000
    echo Press Ctrl+C to stop
    echo.
    start http://localhost:3000
    python3 -m http.server 3000
    goto :end
)

:: Try npx (Node.js)
where npx >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [Method 2] Starting with Node.js npx
    echo URL: http://localhost:3000
    echo Press Ctrl+C to stop
    echo.
    start http://localhost:3000
    npx http-server . -p 3000 -c-1 -s
    goto :end
)

echo [ERROR] Python or Node.js not found.
echo.
echo Please install one of the following:
echo   Python: https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.
pause

:end
