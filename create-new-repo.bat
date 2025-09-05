@echo off
echo ============================================
echo   Create New GitHub Repository
echo ============================================
echo.
echo Steps:
echo.
echo 1. Go to: https://github.com/new
echo 2. Repository name: gas-generator-v2
echo 3. Set to PUBLIC (important!)
echo 4. DO NOT initialize with README
echo 5. Click "Create repository"
echo.
echo 6. Then run these commands:
echo.
echo git remote remove origin
echo git remote add origin https://github.com/IKEMENLTD/gas-generator-v2.git
echo git push -u origin main
echo.
echo 7. Update Render:
echo    - Go to Render Dashboard
echo    - Disconnect old repo
echo    - Connect new repo: IKEMENLTD/gas-generator-v2
echo.
pause