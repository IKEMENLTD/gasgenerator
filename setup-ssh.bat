@echo off
echo SSH設定スクリプト
echo ===================

REM リポジトリURLをSSHに変更
git remote set-url origin git@github.com:IKEMENLTD/gasgenerator.git

echo.
echo ✅ リポジトリURLをSSHに変更しました
echo.
echo 現在のリモートURL:
git remote -v
echo.
echo プッシュを実行します...
git push origin main
echo.
echo 完了！
pause
