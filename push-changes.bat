@echo off
echo Pushing changes to GitHub...
cd /d C:\Users\ooxmi\Downloads\gas-generator

echo.
echo Current branch status:
git status --short

echo.
echo Pushing to origin/main...
git push origin main

if %errorlevel% == 0 (
    echo.
    echo ✅ Successfully pushed to GitHub!
    echo.
    echo View your repository at:
    echo https://github.com/IKEMENLTD/gasgenerator
) else (
    echo.
    echo ❌ Push failed. Please check your credentials or network connection.
    echo.
    echo You may need to:
    echo 1. Run: git config --global credential.helper manager
    echo 2. Try pushing manually from VS Code or GitHub Desktop
)

echo.
pause