@echo off
echo ===============================================
echo   Git履歴をクリーンアップしてプッシュ
echo ===============================================
echo.

echo 秘密情報を含むファイルを削除中...
if exist .env.local.backup del .env.local.backup
if exist VERCEL_ENV_VARIABLES.txt del VERCEL_ENV_VARIABLES.txt
if exist set-vercel-env.bat del set-vercel-env.bat

echo.
echo 新しいGit履歴を作成中...
rmdir /s /q .git
git init
git branch -M main

echo.
echo ファイルを追加中...
git add .
git commit -m "Initial commit: GAS Generator System"

echo.
echo GitHubリポジトリに接続中...
git remote add origin https://github.com/IKEMENLTD/gasgenerator.git

echo.
echo プッシュ中...
git push -u origin main --force

echo.
echo ===============================================
echo   完了！
echo ===============================================
pause