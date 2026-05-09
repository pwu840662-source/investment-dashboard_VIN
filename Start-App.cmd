@echo off
setlocal

set PROJ=%~dp0
cd /d "%PROJ%"

REM 用 npm.cmd 避開 PowerShell ExecutionPolicy 問題
set NPM="C:\Program Files\nodejs\npm.cmd"
if not exist %NPM% (
  echo 找不到 npm.cmd，請先安裝 Node.js（建議 LTS）：https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 正在安裝相依套件...
  %NPM% install
)

echo 正在啟動投資看板（開發模式）...
echo 瀏覽器開啟：http://localhost:5173/
%NPM% run dev

