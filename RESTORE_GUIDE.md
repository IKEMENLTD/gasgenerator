# 🔄 TaskMate システム復元ガイド

## バックアップからの復元手順

### 1. 完全バックアップからの復元

```bash
# バックアップファイルを解凍
tar -xzf /mnt/c/Users/ooxmi/Downloads/taskmate-backup-20250926-190314.tar.gz

# 現在のディレクトリに上書き
cp -r taskmate-backup/* ./
```

### 2. ローカルバックアップからの復元

```bash
# backup_20250926/ディレクトリから復元
cp -r backup_20250926/* ./
```

### 3. 環境変数の復元

`.env.local`ファイルに以下を設定:

```env
# Claude AI API
ANTHROPIC_API_KEY=[本番環境のAPIキーを設定]

# Supabase
SUPABASE_URL=https://ebtcowcgkdurqdqcjrxy.supabase.co
SUPABASE_ANON_KEY=[取得済みのキー]
SUPABASE_SERVICE_ROLE_KEY=[取得済みのキー]

# LINE
LINE_CHANNEL_ACCESS_TOKEN=[取得済みのトークン]
LINE_CHANNEL_SECRET=[取得済みのシークレット]

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[取得済みのキー]
STRIPE_SECRET_KEY=[取得済みのキー]
STRIPE_WEBHOOK_SECRET=[取得済みのシークレット]

# プレミアムコード（環境変数で管理）
PREMIUM_MASTER_ACTIVATION_AMEBAS=[64文字以上のコード]
```

### 4. 依存関係のインストール

```bash
npm install
```

### 5. ビルドテスト

```bash
npm run build
```

### 6. デプロイ

```bash
git add .
git commit -m "Restore from backup"
git push origin main
```

## 重要な注意事項

### ✅ 動作確認済みの機能
- GASコード生成
- プレミアムアクティベーション（64文字以上）
- LINE Webhook処理
- Stripe決済連携
- Supabase DB連携

### ❌ 削除された機能
- トラッキングシステム（/admin/tracking）
- 招待リンク管理
- Netlify Functions（track.ts, cleanup-sessions.ts）

### LINE Webhook設定
```
正しいURL: https://gasgenerator.onrender.com/api/webhook
```

### 問題が発生した場合

1. **ビルドエラー**:
   ```bash
   npm run type-check
   ```

2. **Webhook応答しない**:
   - LINE Developer ConsoleでWebhook URLを確認
   - `/api/webhook`が設定されているか確認

3. **プレミアムアクティベーション動作しない**:
   - 64文字以上のコードか確認
   - 環境変数にPREMIUM_MASTER_ACTIVATION_AMEBASが設定されているか確認

## 連絡先

問題が解決しない場合は、バックアップ作成日時（2025年9月26日 19:03）の状態に戻してください。