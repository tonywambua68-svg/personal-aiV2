@echo off
title NEXUS AI - Launcher
color 0A

echo.
echo  ============================================
echo   NEXUS//OS  -  Personal Business AI
echo  ============================================
echo.

REM --- 1. Check Node.js is installed ---
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [X] Node.js is NOT installed.
    echo.
    echo  FIX: 1. Download the LTS version from https://nodejs.org
    echo       2. Install it (Next - Next - Finish)
    echo       3. CLOSE this window and double-click start-ai.bat again
    echo.
    echo  Opening the Node.js download page for you...
    timeout /t 3 >nul
    start https://nodejs.org
    pause
    exit /b 1
)

echo  [OK] Node.js found
echo  [..] Starting the AI server...
echo.

REM --- 2. Start the server in its own window (so we can stop it cleanly) ---
cd /d "%~dp0standalone"
start "NEXUS AI Server" node server.js

REM --- 3. Wait for it to come up, then open the dashboard ---
timeout /t 2 /nobreak >nul
start http://localhost:8080

echo  [OK] Server started   ->  http://localhost:8080
echo  [OK] Dashboard opened in your browser
echo.
echo  TIP: Click once inside the page to enable sounds.
echo  TIP: Press the "Simulate new order" button in Automations
echo       to hear the cash register.
echo.
echo  To STOP the AI: run stop-ai.bat (or close the "NEXUS AI Server" window)
echo.
timeout /t 8 >nul
exit
