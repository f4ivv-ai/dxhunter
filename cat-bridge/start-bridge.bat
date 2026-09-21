@echo off
echo ===================================================
echo   DX Daruma CAT Bridge - Demarrage
echo ===================================================
echo.

REM --- MODIFIEZ ICI SELON VOTRE POSTE ---

REM Pour FlexRadio (auto-decouverte) :
node bridge.mjs --mode flex --discover

REM Pour FlexRadio (IP directe) :
REM node bridge.mjs --mode flex --radio 192.168.1.100

REM Pour Yaesu :
REM node bridge.mjs --mode yaesu --serial COM3 --baud 38400

REM Pour Icom :
REM node bridge.mjs --mode icom --serial COM4 --baud 19200 --civ-addr 94

REM Pour Kenwood :
REM node bridge.mjs --mode kenwood --serial COM3 --baud 115200

REM Pour Elecraft :
REM node bridge.mjs --mode elecraft --serial COM5 --baud 38400

REM Pour Hamlib :
REM node bridge.mjs --mode hamlib --host 127.0.0.1 --port 4532

pause
