# 🚀 デプロイメントガイド

## 1. CRON_SECRET の設定

### 生成された値（コピーして使用）：
```
CRON_SECRET=gsg_cron_2024_xKm9Lp3QrN7vB2Hs
```

### Renderでの設定方法：
1. Render Dashboard → Environment
2. Add Environment Variable
3. Key: `CRON_SECRET`
4. Value: `gsg_cron_2024_xKm9Lp3QrN7vB2Hs`

---

## 2. Supabaseで実行するSQL（順番に実行）

### Step 1: 残りのテーブルを作成
```sql
-- conversation_sessionsテーブル
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active',
  current_step INTEGER DEFAULT 1,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  collected_requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- generation_queueテーブル
CREATE TABLE IF NOT EXISTS generation_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES conversation_sessions(id),
  line_user_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  retry_count INTEGER DEFAULT 0,
  requirements JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- generated_codesテーブル
CREATE TABLE IF NOT EXISTS generated_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES conversation_sessions(id),
  queue_job_id UUID REFERENCES generation_queue(id),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  code TEXT NOT NULL,
  summary TEXT,
  explanation TEXT,
  usage_instructions TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- claude_usageテーブル
CREATE TABLE IF NOT EXISTS claude_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES conversation_sessions(id),
  model VARCHAR(100),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  total_cost NUMERIC(10, 4),
  created_at TIMESTAMP DEFAULT NOW()
);

-- metricsテーブル
CREATE TABLE IF NOT EXISTS metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type VARCHAR(100) NOT NULL,
  metric_value NUMERIC,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- payment_historyテーブル
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  stripe_payment_intent_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  amount INTEGER,
  currency VARCHAR(10) DEFAULT 'jpy',
  status VARCHAR(50),
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Step 2: インデックスを追加
```sql
-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_status ON conversation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_codes_user_id ON generated_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_usage_user_id ON claude_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_usage_created_at ON claude_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
```

---

## 3. Render環境変数チェックリスト

### 必須環境変数：
```bash
# LINE関連
LINE_CHANNEL_ACCESS_TOKEN=channel_xxxxx
LINE_CHANNEL_SECRET=32文字のシークレット

# Supabase関連
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx

# Claude AI関連
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Stripe関連
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Cron認証
CRON_SECRET=gsg_cron_2024_xKm9Lp3QrN7vB2Hs
```

---

## 4. Render Cronジョブ設定

### 設定内容：
- **Name**: Process Queue
- **Command**: `curl -H "Authorization: Bearer gsg_cron_2024_xKm9Lp3QrN7vB2Hs" https://gasgenerator.onrender.com/api/cron/process-queue`
- **Schedule**: `*/1 * * * *` (毎分実行)

---

## 5. 動作確認チェックリスト

### Step 1: 基本動作
- [ ] https://gasgenerator.onrender.com にアクセス可能
- [ ] /api/webhook にGETリクエストで `{"status":"OK"}` が返る

### Step 2: LINE連携
- [ ] LINE Developers ConsoleでWebhook URL設定
- [ ] Webhook URLの検証が成功
- [ ] LINEで「こんにちは」→ ウェルカムメッセージ表示

### Step 3: 会話フロー
- [ ] カテゴリ選択が動作
- [ ] サブカテゴリ選択が動作
- [ ] 詳細入力後「処理中です」表示

### Step 4: コード生成
- [ ] Cronジョブが1分ごとに実行
- [ ] generation_queueにジョブが作成される
- [ ] 生成されたコードがLINEに送信される

### Step 5: 決済
- [ ] 無料利用10回制限が動作
- [ ] Stripe決済リンクが表示
- [ ] 決済後subscription_statusが更新

---

## 6. トラブルシューティング

### エラー: Webhook検証失敗
```bash
# LINE_CHANNEL_SECRETが正しいか確認
echo $LINE_CHANNEL_SECRET | wc -c  # 32文字であること
```

### エラー: コード生成されない
```sql
-- キューの状態確認
SELECT * FROM generation_queue ORDER BY created_at DESC LIMIT 10;
```

### エラー: Cronジョブ未実行
```bash
# 手動でテスト
curl -H "Authorization: Bearer gsg_cron_2024_xKm9Lp3QrN7vB2Hs" \
  https://gasgenerator.onrender.com/api/cron/process-queue
```

---

## 7. 本番稼働前の最終確認

- [ ] 全テーブルが作成済み
- [ ] 全環境変数が設定済み
- [ ] Cronジョブが設定済み
- [ ] Stripe Webhookが設定済み
- [ ] LINE Webhookが検証済み
- [ ] エンドツーエンドテスト完了

**準備完了したら本番稼働可能です！**