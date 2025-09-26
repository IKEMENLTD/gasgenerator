# 🚨 TaskMate デプロイ前セットアップチェックリスト

## ステップ1: Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセス
2. 新しいプロジェクトを作成
3. 以下の情報を取得:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: プロジェクト設定 → API → anon public
   - **Service Role Key**: プロジェクト設定 → API → service_role

## ステップ2: 環境変数の更新

`.env.local`を以下のように更新:

```bash
# Supabase Configuration (実際の値に置き換え)
NEXT_PUBLIC_SUPABASE_URL=https://[あなたのプロジェクトID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[実際のAnon Key]
SUPABASE_URL=https://[あなたのプロジェクトID].supabase.co
SUPABASE_SERVICE_KEY=[実際のService Role Key]
SUPABASE_ANON_KEY=[実際のAnon Key]
SUPABASE_SERVICE_ROLE_KEY=[実際のService Role Key]

# LINE Configuration (既存の値を確認)
LINE_CHANNEL_SECRET=0917a4d9a8422c86990ca5123e273e7c  # ✅ 設定済み
LINE_CHANNEL_ACCESS_TOKEN=[既存の長いトークン]  # ✅ 設定済み

# Stripe Configuration (本番用に更新)
STRIPE_SECRET_KEY=sk_live_[実際のStripe秘密鍵]  # ⚠️ 要更新
STRIPE_WEBHOOK_SECRET=whsec_[実際のWebhookシークレット]  # ⚠️ 要更新
STRIPE_PAYMENT_LINK=https://buy.stripe.com/[実際のリンク]  # ⚠️ 要更新

# Claude AI (本番用に更新)
ANTHROPIC_API_KEY=sk-ant-[実際のAPIキー]  # ⚠️ 要更新

# Security
CRON_SECRET=[ランダムな文字列を生成]  # ⚠️ 要更新
ADMIN_API_KEY=zfbWklu56dhHTKPSiVUAq2n7gysLGpm3  # ✅ 設定済み
ADMIN_API_SECRET=BwaieOJloTA3IgyHFYWj7XMpQ5V1nP0cDS4f8Lxd  # ✅ 設定済み

# Master Codes (新規追加)
PREMIUM_MASTER_CODE_1=TASKMATE_PREMIUM_2024_MASTER_ACTIVATION_6B4E2A9F3D8C1B7E5A2F9D4C8B3E7A1D
PREMIUM_MASTER_CODE_2=EMERGENCY_OVERRIDE_TASKMATE_PREMIUM_ACCESS_9F3E8B2C4A7D1E5B3F9C2A8E4D7B1A6C
```

## ステップ3: データベースのセットアップ

Supabaseダッシュボード → SQL Editorで以下を実行:

1. `/supabase/migrations/001_tracking_tables.sql`の内容を実行
2. `/supabase/migrations/002_premium_tables.sql`の内容を実行

## ステップ4: セキュリティ修正

以下のコマンドを実行してマスターコードを環境変数に移動:

```bash
# セキュリティパッチを適用
npm run security-patch
```

## ステップ5: 環境変数の検証

```bash
# 環境変数チェック
node -e "require('./lib/config/environment').EnvironmentValidator.validate()"
```

## ステップ6: ローカルテスト

```bash
# ビルドテスト
npm run build

# ローカル起動
npm run dev

# http://localhost:3000 でアクセステスト
```

## チェックリスト

- [ ] Supabaseプロジェクト作成済み
- [ ] Supabase URLとキーを.env.localに設定
- [ ] Stripeの本番キーを設定（または一時的にテストキーを使用）
- [ ] Claude APIキーを設定（または一時的にスキップ）
- [ ] CRON_SECRETを生成して設定
- [ ] データベースマイグレーション実行済み
- [ ] ローカルでビルド成功
- [ ] /t/TEST などのトラッキングURLが動作確認済み

## 次のステップ

すべてのチェックが完了したら:

1. `git add .env.local` (注意: 通常は.gitignoreに含まれるはず)
2. `git commit -m "Update production environment variables"`
3. GitHubにプッシュ
4. Netlifyでデプロイ

---

**重要**: 本番環境のAPIキーは絶対にGitHubにコミットしないでください。
Netlifyの環境変数設定画面で直接設定することを推奨します。