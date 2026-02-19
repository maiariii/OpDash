@echo off
title OpsTracker Launcher (Debug Mode)

echo ==========================================
echo   Operational Tracking System - Launcher
echo ==========================================

REM Check if Node is available in User's Terminal
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected in your command line.
    echo Please restart your computer or ensure Node.js is added to your PATH.
    pause
    exit /b
)

echo.
echo [1/4] Installing Backend Dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b
)

echo.
echo [2/4] Installing Frontend Dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install client dependencies.
    pause
    exit /b
)
cd ..

echo.
echo [3/4] Starting Backend Server (Separate Window)...
REM using cmd /k to keep window open if it crashes
start "OpsTracker Backend" cmd /k "npm start"

echo.
echo [4/4] Starting Frontend Server (Separate Window)...
cd client
REM using cmd /k to keep window open if it crashes
start "OpsTracker Frontend" cmd /k "npm run dev"

echo.
echo ==========================================
echo   System is launching!
echo   Backend: http://localhost:3001
echo   Frontend: http://localhost:5173
echo ==========================================
echo.
echo If the windows appeared and closed immediately, there was a crash.
echo Since we used debug mode, they should stay open now.
echo.
echo Please check the other two windows for Red Error messages.
pause
