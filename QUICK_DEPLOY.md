# 🚀 TaskMate クイックデプロイガイド

## 現在の状況 ✅

1. **コード**: 完成済み・ビルド成功
2. **セキュリティ**: マスターコードを環境変数に移動済み
3. **環境変数**: テンプレート準備完了

## 🔴 今すぐ必要な作業

### 1️⃣ Supabaseプロジェクト作成（5分）

```bash
# Supabase.comでプロジェクト作成後、以下を取得:
# - Project URL: https://xxxxx.supabase.co
# - Anon Key (Settings → API → anon public)
# - Service Role Key (Settings → API → service_role)
```

### 2️⃣ 環境変数を実際の値に更新

`.env.local`を編集:

```bash
# ⚠️ 必須: これらを実際の値に置き換え
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[実際のAnon Key]
SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
SUPABASE_ANON_KEY=[実際のAnon Key]
SUPABASE_SERVICE_KEY=[実際のService Role Key]
SUPABASE_SERVICE_ROLE_KEY=[実際のService Role Key]

# ✅ LINE設定済み
LINE_CHANNEL_SECRET=0917a4d9a8422c86990ca5123e273e7c
LINE_CHANNEL_ACCESS_TOKEN=[既存のトークン]

# ⚠️ オプション（後で設定可能）
STRIPE_SECRET_KEY=sk_test_temp  # 決済機能を使う場合のみ
ANTHROPIC_API_KEY=sk-ant-temp  # AI機能を使う場合のみ
```

### 3️⃣ データベース初期化

Supabaseダッシュボード → SQL Editorで実行:

```sql
-- ファイル: /supabase/migrations/001_tracking_tables.sql を実行
-- ファイル: /supabase/migrations/002_premium_tables.sql を実行
```

### 4️⃣ デプロイ

#### オプションA: Netlify（推奨）

```bash
# GitHubにプッシュ
git add .
git commit -m "Ready for deployment"
git push origin main

# Netlifyで:
# 1. "Add new site" → "Import an existing project"
# 2. GitHub連携 → gas-generator選択
# 3. Build設定:
#    - Build command: npm run build
#    - Publish directory: .next
#    - Functions directory: netlify/functions
# 4. 環境変数を設定（.env.localの内容をコピー）
```

#### オプションB: Render

```bash
# render.yamlが設定済み
# GitHubプッシュ後、Renderで新規Webサービス作成
```

## ✅ 動作確認チェックリスト

- [ ] `/` - ホームページ表示
- [ ] `/t/TEST123` - トラッキングリダイレクト
- [ ] `/auth?token=ABC123` - 認証ページ表示
- [ ] `/admin/dashboard` - 管理ダッシュボード（認証付き）

## 🎁 プレミアム機能

LINEでこのコードを送信（64文字以上）:
```
TASKMATE_PREMIUM_2024_MASTER_ACTIVATION_6B4E2A9F3D8C1B7E5A2F9D4C8B3E7A1D
```
※ 有効期間：1か月間

## ⚠️ トラブルシューティング

### Supabase接続エラー
→ URL とキーが正しいか確認

### ビルドエラー
```bash
npm run build  # ローカルで確認
```

### 環境変数未設定エラー
→ Netlifyダッシュボードで環境変数を設定

## 📞 サポート

問題が発生した場合:
1. ビルドログを確認
2. 環境変数をダブルチェック
3. データベースマイグレーションを再実行

---

**準備完了！** 上記の手順で15分以内にデプロイ可能です。