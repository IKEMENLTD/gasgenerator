@echo off
echo Direct GitHub Push
echo.
echo Please enter your GitHub Personal Access Token
echo (Get it from: https://github.com/settings/tokens)
echo.
set /p TOKEN=Token: 
echo.
echo Pushing to GitHub...
git push https://IKEMENLTD:%TOKEN%@github.com/IKEMENLTD/gasgenerator.git main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS! Pushed to GitHub.
    echo Render will auto-deploy in 3-5 minutes.
) else (
    echo.
    echo Failed. Check your token has 'repo' permission.
)
pause