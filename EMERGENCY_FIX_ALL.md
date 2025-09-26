# 🚨 緊急: TaskMate完全復旧手順

## 致命的問題一覧と修正方法

### 1. ❌ **Anthropic API キーが偽物**
**現状**: `ANTHROPIC_API_KEY=sk-ant-temp`
**修正**:
```bash
# Claude APIキーを取得
https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-api_xxxxxxxxxxxxxxxx
```

### 2. ❌ **Supabaseが全て偽物**
**現状**:
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_SERVICE_KEY=your-service-key`

**修正**:
```bash
# Supabaseプロジェクト作成後
SUPABASE_URL=https://[実際のプロジェクトID].supabase.co
SUPABASE_SERVICE_KEY=[実際のService Role Key]
NEXT_PUBLIC_SUPABASE_URL=[同上]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[実際のAnon Key]
```

### 3. ❌ **LINE Webhook設定ミス**
**現状**: `/api/webhook/line`（トラッキング専用）
**修正**:
```
LINE Developers Console → Messaging API設定
Webhook URL: https://taskmateai.net/api/webhook
```

### 4. ❌ **Stripe設定も偽物**
**現状**:
- `STRIPE_SECRET_KEY=sk_test_temp`
- `STRIPE_WEBHOOK_SECRET=whsec_temp`

**修正**: 本番用Stripeキーを設定（課金機能を使う場合）

## 即座に実行すべきアクション

### ステップ1: 環境変数を本物に更新（5分）

`.env.local`を更新:
```env
# 必須 - これらがないと動作しない
ANTHROPIC_API_KEY=[Claude APIキー取得]
SUPABASE_URL=[Supabaseプロジェクト作成]
SUPABASE_SERVICE_KEY=[Supabase管理画面から]
NEXT_PUBLIC_SUPABASE_URL=[同上]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[同上]

# 既に設定済み
LINE_CHANNEL_SECRET=0917a4d9a8422c86990ca5123e273e7c
LINE_CHANNEL_ACCESS_TOKEN=[既存の長いトークン]
```

### ステップ2: Supabaseデータベース初期化（5分）

Supabase SQL Editorで実行:
```sql
-- /supabase/migrations/001_tracking_tables.sql
-- /supabase/migrations/002_premium_tables.sql
```

### ステップ3: デプロイ（5分）

```bash
git add .
git commit -m "CRITICAL: Fix all environment variables"
git push origin main
```

### ステップ4: LINE Webhook修正（1分）

LINE Developers Consoleで:
- Webhook URL: `https://taskmateai.net/api/webhook`
- Webhook利用: ON
- 応答メッセージ: OFF

## 動作確認チェックリスト

- [ ] Claude APIキー設定済み
- [ ] Supabaseプロジェクト作成・キー設定済み
- [ ] データベーステーブル作成済み
- [ ] LINE Webhook URLを`/api/webhook`に変更済み
- [ ] デプロイ完了

## 期待される結果

✅ 「コード生成を開始」でカテゴリ選択画面表示
✅ カテゴリ選択後、要件質問が表示
✅ 要件入力後、GASコードが生成される
✅ プレミアムコードで正しくアクティベーション

## 重要

**これらの環境変数が偽物のままでは、TaskMateは永遠に動作しません。**
特にANTHROPIC_API_KEYとSupabase設定は必須です。

---
完了予定時間: 15分