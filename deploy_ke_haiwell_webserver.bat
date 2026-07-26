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
echo [1/3] Mem-backup berkas dashboard.html / css / js asli...
if not exist "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\_backup_dashboard_master" (
    mkdir "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\_backup_dashboard_master"
)
copy /y "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\dashboard.css" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\_backup_dashboard_master\"
copy /y "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\dashboard.html" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\_backup_dashboard_master\"
copy /y "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\dashboard.js" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\_backup_dashboard_master\"

echo.
echo [2/3] Menyalin steambox.html, steambox.css, dan steambox.js ke folder WebServer Haiwell...
copy /y "%~dp0nodejs\public\steambox.html" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\steambox.html"
copy /y "%~dp0nodejs\public\steambox.css" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\steambox.css"
copy /y "%~dp0nodejs\public\steambox.js" "C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\steambox.js"

echo.
echo ========================================================
echo   DEPLOYMENT SUKSES 100%!
echo   File steambox.html & dashboard.html telah terpasang
echo   di WebServer Haiwell Scada.
echo ========================================================
echo.
pause
