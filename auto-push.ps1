# ========================================
# 自動Git追加・コミット・プッシュスクリプト (PowerShell)
# 使用方法: .\auto-push.ps1 "コミットメッセージ"
# 例: .\auto-push.ps1 "Fix bug"
# メッセージなしで実行すると、デフォルトメッセージを使用
# ========================================

param(
    [string]$CommitMessage = "Auto commit and push"
)

# スクリプトのディレクトリに移動
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Git 自動プッシュ開始" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host

Write-Host "[1/3] 変更をステージング中..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ エラー: ファイルの追加に失敗しました" -ForegroundColor Red
    Read-Host "続行するにはEnterを押してください"
    exit 1
}
Write-Host "✅ ステージング完了" -ForegroundColor Green

Write-Host
Write-Host "[2/3] コミット中..." -ForegroundColor Yellow
Write-Host "メッセージ: `"$CommitMessage`""
git commit -m "$CommitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  変更がないか、コミットに失敗しました" -ForegroundColor Yellow
    Write-Host "プッシュを続行します..." -ForegroundColor Yellow
}
Write-Host "✅ コミット完了" -ForegroundColor Green

Write-Host
Write-Host "[3/3] GitHubへプッシュ中..." -ForegroundColor Yellow
git push origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ エラー: プッシュに失敗しました" -ForegroundColor Red
    Write-Host
    Write-Host "トラブルシューティング:" -ForegroundColor Yellow
    Write-Host "1. インターネット接続を確認してください"
    Write-Host "2. GitHub認証情報を確認してください"
    Read-Host "続行するにはEnterを押してください"
    exit 1
}
Write-Host "✅ プッシュ完了" -ForegroundColor Green

Write-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 全ての変更がGitHubにプッシュされました！" -ForegroundColor Green
Write-Host
Write-Host "📡 Netlifyが自動的にデプロイを開始します" -ForegroundColor Cyan
Write-Host "通常2-5分でデプロイが完了します" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host

Read-Host "続行するにはEnterを押してください"
