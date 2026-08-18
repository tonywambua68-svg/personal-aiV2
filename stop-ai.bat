@echo off
title NEXUS AI - Stop
color 0C

echo.
echo  Stopping NEXUS//OS...
echo.

REM Stop the server window started by start-ai.bat
taskkill /FI "WINDOWTITLE eq NEXUS AI Server*" /T /F >nul 2>nul

REM Safety net: stop any node process serving port 8080
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>nul
)

echo  [OK] NEXUS//OS stopped. No background processes left on port 8080.
echo.
timeout /t 3 >nul
exit
