@echo off
title NEXUS AI - Backup to GitHub
color 0B
cd /d "%~dp0"

echo.
echo  ============================================================
echo   NEXUS//OS  -  Safe backup to GitHub  (secrets excluded)
echo  ============================================================
echo.

REM ---------- checks ----------
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo  [X] Git not found. Install from https://git-scm.com/download/win
    pause
    exit /b 1
)

git remote get-url origin >nul 2>nul
if %errorlevel% neq 0 (
    echo  [X] This project is not connected to GitHub yet.
    echo      Double-click  publish-to-github.bat  first.
    pause
    exit /b 1
)

REM ---------- safety: never upload secrets ----------
if not exist ".env" goto :envSafe2
git check-ignore -q .env >nul 2>nul
if %errorlevel% neq 0 (
    echo  [X] DANGER: .env exists but is NOT ignored by git. Aborting.
    pause
    exit /b 1
)
:envSafe2

REM ---------- anything changed? ----------
git add . >nul 2>nul
git status --porcelain > "%TEMP%\nexus-git-status.txt"
for %%A in ("%TEMP%\nexus-git-status.txt") do if %%~zA==0 (
    del "%TEMP%\nexus-git-status.txt"
    echo  [i] No changes since last backup. Everything is up to date.
    echo.
    pause
    exit /b 0
)
del "%TEMP%\nexus-git-status.txt"

REM ---------- commit + push ----------
set STAMP=%date% %time:~0,5%
git commit -m "NEXUS//OS update - %STAMP%" >nul 2>nul
echo  [OK] Changes committed locally

echo  [..] Uploading to GitHub...
git push
if %errorlevel% neq 0 (
    echo.
    echo  [X] Upload failed. Check your internet connection and GitHub login.
    echo      If a browser window opened, sign in there and run this again.
    pause
    exit /b 1
)

echo.
echo  [OK] Backup complete. Your project is safe on GitHub:
git remote get-url origin
echo.
pause
