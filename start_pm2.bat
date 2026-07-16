@echo off
:: Determine the folder where this batch file is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%nodejs"

echo Resurrecting PM2 processes...
call pm2 resurrect

if %errorlevel% neq 0 (
    echo PM2 Resurrect failed. Trying to start engine.js directly...
    call pm2 start engine.js --name "haiwell-engine"
    call pm2 save
)

echo PM2 processes resurrected successfully.
pause
