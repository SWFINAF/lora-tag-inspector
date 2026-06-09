@echo off
setlocal

REM Lora Tag Inspector launcher
REM ASCII-only text avoids mojibake on Chinese/non-Chinese Windows CMD.

cd /d "%~dp0"
title Lora Tag Inspector v1.5

echo ============================================
echo   Lora Tag Inspector v1.5
echo ============================================
echo.
echo Current folder: %CD%

if not exist "LoraTagInspector.exe" (
    echo [ERROR] LoraTagInspector.exe was not found.
    echo Please extract the whole ZIP file first, then run this BAT inside the extracted folder.
    echo Do not move only the EXE file to another folder.
    echo.
    pause
    exit /b 1
)

echo Found EXE: %CD%\LoraTagInspector.exe
echo.
set "PROFILE_DIR=%CD%\user-data"
if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%" >nul 2>nul

echo Starting application...
echo Profile folder: %PROFILE_DIR%
echo If Windows Defender SmartScreen appears, click "More info" then "Run anyway".
echo If nothing opens, try running LoraTagInspector.exe directly.
echo.

REM Use an app-local profile to avoid Chromium ProcessSingleton conflicts
REM with another NW.js/Chrome profile on the target computer.
"%CD%\LoraTagInspector.exe" --user-data-dir="%PROFILE_DIR%"
set "ERR=%ERRORLEVEL%"

echo.
echo Application exited with code: %ERR%
if not "%ERR%"=="0" (
    echo.
    echo Possible causes:
    echo 1. Antivirus or Windows Security blocked the EXE.
    echo 2. ZIP was not fully extracted, or DLL files are missing.
    echo 3. Visual C++ Runtime is missing: https://aka.ms/vs/17/release/vc_redist.x64.exe
)
echo.
pause
exit /b %ERR%
