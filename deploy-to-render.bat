@echo off
echo ============================================
echo   Render Direct Deployment
echo ============================================
echo.

echo Installing Render CLI...
npm install -g @render-cli/cli

echo.
echo Creating deployment package...
tar -czf deploy.tar.gz --exclude=node_modules --exclude=.next --exclude=.git .

echo.
echo ============================================
echo   Manual Steps Required:
echo ============================================
echo.
echo 1. Go to Render Dashboard
echo 2. Click on your service "gasgenerator"
echo 3. Go to Settings tab
echo 4. Scroll to "Git" section
echo 5. Click "Disconnect from GitHub"
echo 6. Then click "Connect a Git repository"
echo 7. Choose "Public Git repository"
echo 8. Enter: https://github.com/IKEMENLTD/gasgenerator.git
echo 9. Click "Connect"
echo.
echo Or try Manual Deploy:
echo - Click "Manual Deploy" button
echo - Choose "Deploy latest commit"
echo.
pause