@echo off
echo ===============================================
echo   GitHub リポジトリ連携ツール
echo ===============================================
echo.
echo GitHubで作成したリポジトリのURLを入力してください
echo 例: https://github.com/YOUR_USERNAME/gas-generator.git
echo.
set /p REPO_URL="GitHub リポジトリURL: "

if "%REPO_URL%"=="" (
    echo.
    echo エラー: URLが入力されていません
    pause
    exit /b 1
)

echo.
echo リモートリポジトリを設定中...
git remote add origin %REPO_URL%

echo.
echo コードをGitHubにプッシュ中...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===============================================
    echo   ✅ GitHub連携完了！
    echo ===============================================
    echo.
    echo 次のステップ:
    echo 1. Vercelダッシュボード https://vercel.com にアクセス
    echo 2. 既存の gas-generator プロジェクトの Settings へ
    echo 3. Git Integration から GitHub リポジトリを接続
    echo 4. これで自動デプロイが有効になります！
    echo.
) else (
    echo.
    echo エラーが発生しました。
    echo 既にoriginが設定されている場合は、以下のコマンドを試してください:
    echo git remote set-url origin %REPO_URL%
    echo git push -u origin main
    echo.
)

pause