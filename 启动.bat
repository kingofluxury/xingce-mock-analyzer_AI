@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 22 or newer.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

node app\server.mjs
if errorlevel 1 pause
