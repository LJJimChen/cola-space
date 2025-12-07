@echo off
setlocal


set "PROJECT_DIR= %1"
echo Init repository on server, project dir: "%PROJECT_DIR%", repo url: "%2"


if not exist "%PROJECT_DIR%" (
  mkdir "%PROJECT_DIR%"
)
cd /d "%PROJECT_DIR%"

if not exist ".git" (
  git clone --depth=1 "%2" .
  if errorlevel 1 exit /b 1
) else (
  git fetch --depth=1 origin main
  if errorlevel 1 exit /b 1
  git reset --hard origin/main
  if errorlevel 1 exit /b 1
)

echo Done
exit /b 0
