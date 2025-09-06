@echo off
chcp 65001 >nul 2>&1
echo =========================================
echo GitHub Push Helper for Windows
echo =========================================
echo.

set GITHUB_USER=IKEMENLTD
set /p GITHUB_TOKEN=Enter GitHub Personal Access Token: 

if "%GITHUB_TOKEN%"=="" (
    echo Error: No token provided
    pause
    exit /b 1
)

echo.
echo Pushing to GitHub...
git push https://%GITHUB_USER%:%GITHUB_TOKEN%@github.com/IKEMENLTD/gasgenerator.git main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: Push completed!
    echo.
    echo Render should start auto-deploy.
    echo Check: https://dashboard.render.com
) else (
    echo.
    echo ERROR: Push failed
    echo.
    echo Please check:
    echo 1. Personal Access Token is correct
    echo 2. Token has repo permission
    echo 3. Repository exists
)

pause