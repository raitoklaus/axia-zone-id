@echo off
setlocal
cd /d "%~dp0"
title Axia Zone ID - Local Live Studio

set "npm_config_manage_package_manager_versions=false"

where pnpm.cmd >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm.cmd was not found on PATH.
    echo Please install Node.js 22+ and pnpm ^(corepack enable^) before running Studio.
    echo.
    pause
    exit /b 1
)

echo ============================================================
echo   Axia Zone ID - Local Live Studio
echo   Launching dev server at http://localhost:4321/__studio/
echo   Press Ctrl+C in this window to stop the server.
echo ============================================================
echo.

call pnpm.cmd studio
if errorlevel 1 (
    echo.
    echo [ERROR] Studio exited with code %errorlevel%.
    pause
    exit /b %errorlevel%
)
