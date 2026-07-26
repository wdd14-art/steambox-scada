@echo off
:: Self-elevate to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

title STEAMBOX SCADA - DEPLOY TO HAIWELL WEBSERVER
color 0A
echo ========================================================
echo   STEAMBOX SCADA - DEPLOY TO HAIWELL WEBSERVER NATIVE
echo ========================================================
echo.
echo [1/2] Memulihkan berkas master dashboard.html / css / js asli...
copy /y "%~dp0backup_skrip_lama\haiwell_webserver_backup\dashboard.html" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\dashboard.html"
copy /y "%~dp0backup_skrip_lama\haiwell_webserver_backup\dashboard.css" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\dashboard.css"
copy /y "%~dp0backup_skrip_lama\haiwell_webserver_backup\dashboard.js" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\dashboard.js"

echo.
echo [2/2] Menyalin steambox.html ke folder WebServer Haiwell...
copy /y "%~dp0nodejs\public\steambox.html" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\steambox.html"

echo.
echo ========================================================
echo   DEPLOYMENT SUKSES 100%!
echo   File steambox.html & dashboard.html telah terpasang
echo   di WebServer Haiwell Scada.
echo ========================================================
echo.
pause
