@echo off
setlocal

set PROJECT_DIR=%~1
set REPO_URL=%~2

if "%PROJECT_DIR%"=="" (
  echo Usage: init-repo.bat ^<project_dir^> ^<repo_url^>
  exit /b 1
)
if "%REPO_URL%"=="" (
  echo Usage: init-repo.bat ^<project_dir^> ^<repo_url^>
  exit /b 1
)

if not exist "%PROJECT_DIR%" (
  mkdir "%PROJECT_DIR%"
)
cd /d "%PROJECT_DIR%"

if not exist ".git" (
  git clone --depth=1 "%REPO_URL%" .
  if errorlevel 1 exit /b 1
) else (
  git fetch --depth=1 origin main
  if errorlevel 1 exit /b 1
  git reset --hard origin/main
  if errorlevel 1 exit /b 1
)

echo Done
exit /b 0
