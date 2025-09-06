@echo off
echo Setting up GitHub authentication...
echo.

REM Windows Credential Managerを使用
git config --global credential.helper manager

echo.
echo Step 1: Generate a Personal Access Token on GitHub
echo   1. Go to: https://github.com/settings/tokens
echo   2. Click "Generate new token (classic)"
echo   3. Select scopes: repo (all)
echo   4. Copy the token
echo.
echo Step 2: Run this command and enter your token when prompted:
echo   git push origin main
echo   Username: IKEMENLTD
echo   Password: [paste your token here]
echo.
echo After this, Windows will remember your credentials!
echo.
pause