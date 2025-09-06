@echo off
echo Auto Push to GitHub
echo.

REM 環境変数からトークンを読み込む
if "%GITHUB_TOKEN%"=="" (
    echo ERROR: GITHUB_TOKEN environment variable not set!
    echo.
    echo Please set it using:
    echo   setx GITHUB_TOKEN "your-personal-access-token"
    echo.
    pause
    exit /b 1
)

echo Pushing to GitHub...
git push https://IKEMENLTD:%GITHUB_TOKEN%@github.com/IKEMENLTD/gasgenerator.git main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Successfully pushed to GitHub!
    echo Render will automatically deploy the changes.
) else (
    echo.
    echo ❌ Push failed. Check your token and try again.
)

pause