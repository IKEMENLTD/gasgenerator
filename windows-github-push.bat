@echo off
echo GitHub API Update Script for Windows
echo =====================================
echo.

REM set GITHUB_TOKEN=YOUR_TOKEN_HERE
set OWNER=IKEMENLTD
set REPO=gasgenerator
set BRANCH=main

echo Token detected!
echo.
echo Updating files via GitHub API...
echo.

:: Update environment.ts
echo Updating lib/config/environment.ts...
curl -X PUT ^
  -H "Authorization: token %GITHUB_TOKEN%" ^
  -H "Accept: application/vnd.github.v3+json" ^
  "https://api.github.com/repos/%OWNER%/%REPO%/contents/lib/config/environment.ts" ^
  -d @environment-update.json

:: Update jwt-manager.ts
echo.
echo Updating lib/auth/jwt-manager.ts...
curl -X PUT ^
  -H "Authorization: token %GITHUB_TOKEN%" ^
  -H "Accept: application/vnd.github.v3+json" ^
  "https://api.github.com/repos/%OWNER%/%REPO%/contents/lib/auth/jwt-manager.ts" ^
  -d @jwt-update.json

echo.
echo =====================================
echo Update complete!
echo Check: https://github.com/%OWNER%/%REPO%/commits/%BRANCH%
echo Render will auto-deploy soon!
echo =====================================
pause