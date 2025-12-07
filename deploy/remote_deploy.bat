@echo off

echo Step 1: Create project directory if it does not exist
if not exist "%~1" mkdir "%~1"
if %errorlevel% neq 0 ( echo Error creating directory & exit /b %errorlevel% )

echo Step 2: Extract project archive
tar -xzf C:/Windows/Temp/project.tar.gz -C "%~1"
if %errorlevel% neq 0 ( echo Error extracting archive & exit /b %errorlevel% )

echo Step 3: Delete temporary archive
del C:\Windows\Temp\project.tar.gz
if %errorlevel% neq 0 ( echo Error deleting archive & exit /b %errorlevel% )

echo Step 4: Change to project directory
cd /d "%~1"
if %errorlevel% neq 0 ( echo Error changing directory & exit /b %errorlevel% )

echo Step 5: Generate environment file
node deploy/generateEnv.js _CUSTOM_CRON_EXPR="%~2" _CUSTOM_COFFEE_USERNAME="%~3" _CUSTOM_COFFEE_PASSWORD="%~4"
if %errorlevel% neq 0 ( echo Error generating env file & exit /b %errorlevel% )

echo Step 6: Run deployment script
node deploy/deploy.js
if %errorlevel% neq 0 ( echo Error running deploy script & exit /b %errorlevel% )

echo Deployment successful!
exit /b 0
