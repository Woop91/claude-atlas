@echo off
REM Launch Claude Atlas dev server and open in default browser.
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install || exit /b 1
)
start "" "http://localhost:4173/"
call npm run dev
endlocal
