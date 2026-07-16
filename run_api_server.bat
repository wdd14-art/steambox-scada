@echo off
:: Navigate to the nodejs folder located in the same directory as this batch file
cd /d "%~dp0nodejs"
echo =============================================================
echo  Starting local WebAPI Encryption server...
echo =============================================================
node engine.js
pause
