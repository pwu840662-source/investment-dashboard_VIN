# 於專案根目錄執行：先安裝 Node.js LTS（https://nodejs.org/），再按兩下或以 PowerShell 執行本腳本
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$npmCmd = $null
if (Get-Command npm -ErrorAction SilentlyContinue) {
  $npmCmd = "npm"
} elseif (Test-Path "C:\Program Files\nodejs\npm.cmd") {
  $npmCmd = "C:\Program Files\nodejs\npm.cmd"
}

if (-not $npmCmd) {
  Write-Host ""
  Write-Host "未偵測到 npm。請先安裝 Node.js（勾選 Add to PATH），安裝完成後重新開啟終端機再執行本腳本。" -ForegroundColor Yellow
  Write-Host "下載: https://nodejs.org/" -ForegroundColor Cyan
  Write-Host ""
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "正在安裝相依套件 npm install ..." -ForegroundColor Green
  & $npmCmd install
}

Write-Host "正在啟動開發伺服器（請勿關閉本視窗，瀏覽器開啟 http://localhost:5173）..." -ForegroundColor Green
& $npmCmd run dev
