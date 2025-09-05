@echo off
echo ============================================
echo   Quick Deploy to Render
echo ============================================
echo.
echo STEP 1: Update GitHub (Run in new CMD window)
echo -----------------------------------------------
echo git add .
echo git commit -m "Fix deployment"
echo git push origin main
echo.
echo If push fails, create Personal Access Token:
echo https://github.com/settings/tokens/new
echo Select 'repo' scope
echo.
echo STEP 2: Trigger Render Deploy
echo -----------------------------------------------
echo 1. Go to Render Dashboard
echo 2. Click your service
echo 3. Click "Manual Deploy"
echo 4. Select "Clear build cache & deploy"
echo.
echo STEP 3: Check Logs
echo -----------------------------------------------
echo In Render Dashboard, click "Logs" tab
echo.
pause