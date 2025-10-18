@echo off
REM ========================================
REM 自動Git追加・コミット・プッシュスクリプト
REM 使用方法: auto-push.bat "コミットメッセージ"
REM 例: auto-push.bat "Fix bug"
REM メッセージなしで実行すると、デフォルトメッセージを使用
REM ========================================

cd /d "%~dp0"

REM コミットメッセージを取得（引数がない場合はデフォルト）
set COMMIT_MSG=%~1
if "%COMMIT_MSG%"=="" (
    set COMMIT_MSG=Auto commit and push
)

echo ========================================
echo Git 自動プッシュ開始
echo ========================================
echo.

echo [1/3] 変更をステージング中...
git add .
if errorlevel 1 (
    echo ❌ エラー: ファイルの追加に失敗しました
    pause
    exit /b 1
)
echo ✅ ステージング完了

echo.
echo [2/3] コミット中...
echo メッセージ: "%COMMIT_MSG%"
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo ⚠️  変更がないか、コミットに失敗しました
    echo プッシュを続行します...
)
echo ✅ コミット完了

echo.
echo [3/3] GitHubへプッシュ中...
git push origin main 2>&1
if errorlevel 1 (
    echo ❌ エラー: プッシュに失敗しました
    echo.
    echo トラブルシューティング:
    echo 1. インターネット接続を確認してください
    echo 2. GitHub認証情報を確認してください
    pause
    exit /b 1
)
echo ✅ プッシュ完了

echo.
echo ========================================
echo 🎉 全ての変更がGitHubにプッシュされました！
echo.
echo 📡 Netlifyが自動的にデプロイを開始します
echo 通常2-5分でデプロイが完了します
echo ========================================
echo.

pause