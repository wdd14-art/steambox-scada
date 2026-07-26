@echo off
title Server Web Steambox Port 8080
echo =============================================================
echo  Menyalakan Web Server Uji Coba untuk HP/Laptop (Port 8080)
echo =============================================================
echo.
echo Silakan buka di HP Anda (Wi-Fi Sama):
echo http://192.168.20.23:8080/steambox.html
echo.
echo (Jangan tutup jendela ini selama ingin membuka dari HP)
echo =============================================================
echo.
npx -y http-server nodejs/public -p 8080
pause
