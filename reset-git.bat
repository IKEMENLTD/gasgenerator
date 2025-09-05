@echo off
chcp 65001 > nul
echo Starting Git cleanup...
echo.

echo Removing sensitive files...
if exist .env.local.backup del .env.local.backup
if exist VERCEL_ENV_VARIABLES.txt del VERCEL_ENV_VARIABLES.txt
if exist set-vercel-env.bat del set-vercel-env.bat

echo.
echo Resetting Git repository...
rmdir /s /q .git
git init
git branch -M main

echo.
echo Adding files...
git add .
git commit -m "Initial commit: GAS Generator System"

echo.
echo Adding GitHub remote...
git remote add origin https://github.com/IKEMENLTD/gasgenerator.git

echo.
echo Force pushing to GitHub...
git push -u origin main --force

echo.
echo Done!
pause