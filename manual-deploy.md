# 🚀 手動デプロイ手順

## 1. GitHubへのプッシュ

現在、GitHubへの認証エラーが発生しているため、以下の手順で手動でプッシュしてください：

### オプション A: GitHub Desktop を使用
1. GitHub Desktop を開く
2. このリポジトリを追加
3. 変更をコミット（既にコミット済み）
4. "Push origin" をクリック

### オプション B: Personal Access Token を使用
1. GitHub.com にログイン
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token" をクリック
4. 必要な権限を選択（repo にチェック）
5. トークンを生成してコピー
6. 以下のコマンドを実行：

```bash
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/IKEMENLTD/gasgenerator.git
git push origin main --force
```

### オプション C: SSH を使用
```bash
git remote set-url origin git@github.com:IKEMENLTD/gasgenerator.git
git push origin main --force
```

## 2. Renderでの自動デプロイ

GitHubにプッシュすると、Renderが自動的にデプロイを開始します。

### デプロイ状況の確認
1. [Render Dashboard](https://dashboard.render.com) にアクセス
2. "gasgenerator" サービスを選択
3. "Events" タブでデプロイ状況を確認

## 3. 環境変数の確認

Renderダッシュボードで以下の環境変数が設定されていることを確認：

### 必須環境変数
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET`
- `ADMIN_API_TOKEN`
- `COOKIE_SECRET`
- `ENCRYPTION_KEY`

## 4. セキュリティ更新の確認

今回の更新で以下のセキュリティ機能が追加されました：

✅ **修正済みの脆弱性:**
- セッション競合状態
- メモリリーク
- オープンリダイレクト
- 管理者認証の脆弱性
- SSRF攻撃
- WebSocket認証

✅ **新機能:**
- SessionLock (アトミック操作)
- GlobalTimerManager (メモリ管理)
- URLValidator (URL検証)
- SecureFetch (安全なHTTP通信)
- 強化されたJWT認証

## 5. デプロイ後の確認

1. **ヘルスチェック**: https://gasgenerator.onrender.com/api/health
2. **LINE Bot動作確認**: LINE公式アカウントでメッセージ送信
3. **管理画面**: 管理者トークンでアクセス確認

## トラブルシューティング

### デプロイが失敗する場合
1. Renderのログを確認
2. 環境変数が正しく設定されているか確認
3. ビルドエラーがないか確認

### 型エラーが出る場合
型エラーは警告として扱われ、デプロイは継続されます。

## サポート

問題が発生した場合は、以下を確認してください：
- [Render Status](https://status.render.com)
- [GitHub Status](https://www.githubstatus.com)

---

**セキュリティ評価: A-** 🛡️
本番環境対応済み！