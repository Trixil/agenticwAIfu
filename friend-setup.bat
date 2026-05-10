@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================
rem Configure these two values
rem ============================
set "REPO_URL=https://github.com/your-user/your-repo.git"
set "TARGET_DIR=%USERPROFILE%\agenticwAIfu"

title agenticwAIfu Friend Setup

echo.
echo ==========================================
echo      agenticwAIfu One-Time Setup
echo ==========================================
echo.

where winget >nul 2>nul
if errorlevel 1 (
  echo winget was not found on this PC.
  echo This script currently depends on winget to install Git and Node.js.
  echo Install App Installer / winget, then run this script again.
  pause
  exit /b 1
)

call :ensure_git
if errorlevel 1 exit /b 1

call :ensure_node
if errorlevel 1 exit /b 1

if "%REPO_URL%"=="https://github.com/your-user/your-repo.git" (
  echo The script still has the placeholder REPO_URL.
  echo Edit friend-setup.bat and set REPO_URL to your actual Git repo first.
  pause
  exit /b 1
)

echo.
echo Repo URL: %REPO_URL%
echo Install folder: %TARGET_DIR%
echo.

if exist "%TARGET_DIR%\.git" (
  echo Repo already exists at:
  echo   %TARGET_DIR%
  echo Skipping clone.
) else (
  if exist "%TARGET_DIR%" (
    echo Target folder already exists but is not a git repo:
    echo   %TARGET_DIR%
    echo Remove or rename that folder, then run this script again.
    pause
    exit /b 1
  )

  echo Cloning repo...
  git clone "%REPO_URL%" "%TARGET_DIR%"
  if errorlevel 1 (
    echo Git clone failed.
    pause
    exit /b 1
  )
)

echo.
set /p "OPENROUTER_API_KEY=Paste your OpenRouter API key: "
if "%OPENROUTER_API_KEY%"=="" (
  echo No OpenRouter API key was entered.
  pause
  exit /b 1
)

set /p "OPENAI_API_KEY=Paste your OpenAI API key: "
if "%OPENAI_API_KEY%"=="" (
  echo No OpenAI API key was entered.
  pause
  exit /b 1
)

> "%TARGET_DIR%\.env" (
  echo OPENROUTER_API_KEY=%OPENROUTER_API_KEY%
  echo OPENAI_API_KEY=%OPENAI_API_KEY%
)

echo.
echo Wrote:
echo   %TARGET_DIR%\.env
echo.

if exist "%TARGET_DIR%\start-app.bat" (
  choice /M "Setup is complete. Start the app now"
  if errorlevel 2 goto :done
  call "%TARGET_DIR%\start-app.bat"
  goto :done
)

echo start-app.bat was not found in the cloned repo.

:done
echo.
echo Setup finished.
pause
exit /b 0

:ensure_git
where git >nul 2>nul
if not errorlevel 1 (
  echo Git is already installed.
  exit /b 0
)

echo Git was not found. Installing Git...
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo Git installation failed.
  exit /b 1
)

call :refresh_path
where git >nul 2>nul
if not errorlevel 1 exit /b 0

if exist "%ProgramFiles%\Git\cmd\git.exe" (
  set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" (
  set "PATH=%ProgramFiles(x86)%\Git\cmd;%PATH%"
  exit /b 0
)

echo Git appears to have installed, but git is still not available in PATH.
echo Open a new Command Prompt and run this script again.
exit /b 1

:ensure_node
where node >nul 2>nul
if not errorlevel 1 (
  echo Node.js is already installed.
  exit /b 0
)

echo Node.js was not found. Installing Node.js LTS...
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo Node.js installation failed.
  exit /b 1
)

call :refresh_path
where node >nul 2>nul
if not errorlevel 1 exit /b 0

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)

echo Node.js appears to have installed, but node is still not available in PATH.
echo Open a new Command Prompt and run this script again.
exit /b 1

:refresh_path
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul ^| find /i "Path"`) do set "SYS_PATH=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul ^| find /i "Path"`) do set "USR_PATH=%%B"

if defined SYS_PATH (
  if defined USR_PATH (
    set "PATH=%SYS_PATH%;%USR_PATH%"
  ) else (
    set "PATH=%SYS_PATH%"
  )
) else if defined USR_PATH (
  set "PATH=%USR_PATH%"
)

exit /b 0
