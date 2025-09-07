@echo off
echo GitHub Personal Access Token を入力してください:
set /p TOKEN=

git push https://%TOKEN%@github.com/IKEMENLTD/gasgenerator.git main

echo.
echo プッシュ完了！
echo Renderダッシュボードで "Manual Deploy" をクリックしてください
pause