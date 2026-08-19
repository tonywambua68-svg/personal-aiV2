@echo off
title NEXUS AI - Publish to GitHub
color 0A
cd /d "%~dp0"

echo.
echo  ============================================================
echo   NEXUS//OS  -  Publish to GitHub  (safe: secrets excluded)
echo  ============================================================
echo.

REM ---------- 1. Is Git installed? ----------
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo  [X] Git is NOT installed on this PC.
    echo.
    echo  FIX:  1. Download Git from https://git-scm.com/download/win
    echo        2. Install it (Next - Next - Next - Install)
    echo        3. CLOSE this window, then double-click publish-to-github.bat again
    echo.
    echo  Opening the download page for you...
    timeout /t 3 >nul
    start https://git-scm.com/download/win
    pause
    exit /b 1
)
echo  [OK] Git found

REM ---------- 2. Already published? ----------
git remote get-url origin >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo  [i] This project is ALREADY connected to a repository:
    echo.
    git remote get-url origin
    echo.
    echo      To push new changes, double-click update-github.bat instead.
    echo      To connect a DIFFERENT repository, run:
    echo        git remote set-url origin YOUR_NEW_URL
    echo.
    pause
    exit /b 0
)

REM ---------- 3. Safety check: secrets must be excluded ----------
if not exist ".env" goto :envSafe
git check-ignore -q .env >nul 2>nul
if %errorlevel% neq 0 (
    echo  [X] DANGER: .env exists but is NOT ignored by git. Aborting.
    echo      Your API keys would be published. Fix .gitignore first.
    pause
    exit /b 1
)
echo  [OK] .env exists and is safely EXCLUDED from the upload
:envSafe
if not exist ".gitignore" (
    echo  [X] .gitignore is missing. Restore it from the project files first.
    pause
    exit /b 1
)
echo  [OK] Safety check passed (.env, keys/, exports excluded)

REM ---------- 4. Initialize repository ----------
if not exist ".git" (
    git init >nul 2>nul
    git branch -M main >nul 2>nul
    echo  [OK] Git repository initialized (branch: main)
) else (
    echo  [OK] Git repository already initialized
)

REM ---------- 5. Commit everything (safely) ----------
git add . >nul 2>nul
git commit -m "NEXUS//OS - Personal AI business assistant - Phase 1 complete" >nul 2>nul
if %errorlevel% neq 0 (
    echo  [i] Nothing new to commit - all changes already saved.
) else (
    echo  [OK] Code committed locally (no secrets included)
)

echo.
echo  ============================================================
echo   NOW - create your repository on GitHub (takes 2 minutes)
echo  ============================================================
echo.
echo   1. Open  https://github.com/new   (sign in if asked)
echo   2. Repository name ......... nexus-os   (or personal-ai)
echo   3. Public or Private ....... PRIVATE  (recommended - your business data)
echo   4. IMPORTANT: do NOT add README, .gitignore or license
echo      (this project already has them - adding them causes conflicts)
echo   5. Click the green "Create repository" button
echo.
echo   6. On the next page, find the line that ends with .git
echo      It looks like:  https://github.com/YOURNAME/nexus-os.git
echo.
set /p REPO=  7. Paste that URL here and press Enter: 

if "%REPO%"=="" (
    echo.
    echo  [X] No URL entered - nothing was published. Run this script again.
    pause
    exit /b 1
)

REM strip surrounding quotes if pasted with them
set REPO=%REPO:"=%

git remote add origin %REPO% >nul 2>nul
echo.
echo  [..] Uploading to GitHub... (a browser window may open to sign in -
echo       click "Authorize" / "Sign in with browser" if it does)
echo.
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo  [X] Upload failed. Common fixes:
    echo      - Wrong URL?  Run:  git remote set-url origin YOUR_URL   then re-run this script
    echo      - Login problem?  A browser window opens - sign into GitHub there.
    echo      - "Repository not empty"?  You added a README on GitHub.
    echo        Fix: run  git pull origin main --allow-unrelated-histories
    echo        then  git push -u origin main
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo  [OK] SUCCESS - your project is now on GitHub:
git remote get-url origin
echo  ============================================================
echo.
echo   From now on:
echo     - Back up changes ....... double-click  update-github.bat
echo     - Use on another PC ..... git clone YOUR_URL  (see GITHUB_GUIDE.md)
echo.
pause
