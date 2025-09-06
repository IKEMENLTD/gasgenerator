@echo off
echo GitHub Push Script
echo.
set /p TOKEN=Enter GitHub Token: 
git push https://IKEMENLTD:%TOKEN%@github.com/IKEMENLTD/gasgenerator.git main
pause