@echo off
echo ===============================================
echo   GitHub SSH キー設定
echo ===============================================
echo.

echo SSHキーを生成します...
ssh-keygen -t ed25519 -C "your-email@example.com" -f "%USERPROFILE%\.ssh\id_ed25519_github" -N ""

echo.
echo 公開鍵をコピーしました。以下の手順に従ってください:
echo.
echo 1. https://github.com/settings/keys を開く
echo 2. "New SSH key" をクリック
echo 3. Title: gas-generator
echo 4. 以下の公開鍵を Key 欄に貼り付け:
echo.
type "%USERPROFILE%\.ssh\id_ed25519_github.pub"
echo.
echo.
echo 5. "Add SSH key" をクリック
echo.
pause

echo.
echo SSH設定を更新中...
echo Host github.com > "%USERPROFILE%\.ssh\config"
echo   HostName github.com >> "%USERPROFILE%\.ssh\config"
echo   User git >> "%USERPROFILE%\.ssh\config"
echo   IdentityFile ~/.ssh/id_ed25519_github >> "%USERPROFILE%\.ssh\config"

echo.
echo リモートURLをSSHに変更...
git remote set-url origin git@github.com:IKEMENLTD/gasgenerator.git

echo.
echo 完了！以下のコマンドでプッシュしてください:
echo git push -u origin main
echo.
pause