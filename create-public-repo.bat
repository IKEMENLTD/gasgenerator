@echo off
echo ============================================
echo   Create New PUBLIC Repository
echo ============================================
echo.
echo STEP 1: Create new PUBLIC repo on GitHub
echo -----------------------------------------
echo 1. Go to: https://github.com/new
echo 2. Repository name: gas-generator-public
echo 3. Select PUBLIC (IMPORTANT!)
echo 4. DO NOT initialize with README
echo 5. Click "Create repository"
echo.
echo STEP 2: Push code to new repo
echo -----------------------------------------
echo Run these commands:
echo.
echo git remote remove origin
echo git remote add origin https://github.com/IKEMENLTD/gas-generator-public.git
echo git push -u origin main
echo.
echo STEP 3: Update Render
echo -----------------------------------------
echo 1. Go to Render Dashboard
echo 2. Click your service
echo 3. Settings - Git
echo 4. Disconnect current repo
echo 5. Connect new repo: IKEMENLTD/gas-generator-public
echo.
pause