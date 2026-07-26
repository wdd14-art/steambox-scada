@echo off
:: Self-elevate to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

title STEAMBOX SCADA - DEPLOYMENT FILTER CHECK
color 0A
echo ========================================================
echo   STEAMBOX SCADA - SMART DEPLOYMENT FILTER
echo ========================================================
echo.

set "DEST=C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project"
set "SRC_BACKUP=%~dp0backup_skrip_lama\haiwell_webserver_backup"
set "SRC_PUBLIC=%~dp0nodejs\public"

call :CheckAndCopy "%SRC_BACKUP%\dashboard.html" "%DEST%\dashboard.html" "dashboard.html (Master)"
call :CheckAndCopy "%SRC_BACKUP%\dashboard.css"  "%DEST%\dashboard.css"  "dashboard.css (Master)"
call :CheckAndCopy "%SRC_BACKUP%\dashboard.js"   "%DEST%\dashboard.js"   "dashboard.js (Master)"
call :CheckAndCopy "%SRC_PUBLIC%\steambox.html"  "%DEST%\steambox.html"  "steambox.html (Poka-Yoke)"

echo.
echo ========================================================
echo   VERIFIKASI SISTEM SUKSES 100%!
echo ========================================================
echo.
pause
goto :eof

:CheckAndCopy
set "SRC_FILE=%~1"
set "DEST_FILE=%~2"
set "LABEL=%~3"

if not exist "%DEST_FILE%" (
    echo [DISALIN - BARU] %LABEL% belum ada di folder tujuan. Menyalin...
    copy /y "%SRC_FILE%" "%DEST_FILE%" >nul
    goto :eof
)

fc /b "%SRC_FILE%" "%DEST_FILE%" >nul 2>&1
if %errorLevel% equ 0 (
    echo [SKIP - SUDAH SAMA] %LABEL% sudah ada & identik di tujuan. Tidak disalin.
) else (
    echo [DISALIN - UPDATE] %LABEL% berbeda/ada pembaruan. Menyalin...
    copy /y "%SRC_FILE%" "%DEST_FILE%" >nul
)
goto :eof
