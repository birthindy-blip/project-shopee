@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
set PY=python
where py >nul 2>nul
if not errorlevel 1 set PY=py
%PY% -c "import uiautomator2" >nul 2>nul
if errorlevel 1 (
  echo [setup] Installing phone connection tools...
  %PY% -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [error] Setup failed. Check Python and internet connection.
    pause
    exit /b 1
  )
)
if "%~1"=="" (
  %PY% -B poster_app.py
) else (
  %PY% -B shopee_poster.py %*
)
pause
