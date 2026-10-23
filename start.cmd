@echo off
cd /d "%~dp0"
start "" http://localhost:8816/
node serve.mjs
pause
