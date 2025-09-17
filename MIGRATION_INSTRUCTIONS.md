# Supabaseマイグレーション手順

## 方法1: Supabaseダッシュボードから実行（推奨）

1. https://app.supabase.com にログイン
2. プロジェクトを選択
3. 左メニューの「SQL Editor」をクリック
4. 「New Query」をクリック
5. 以下のSQLをコピー＆ペースト
6. 「Run」ボタンをクリック

```sql
-- プロフェッショナルプラン対応のためのスキーマ更新
-- 2025-01-17

-- 既存のビューを一時的に削除（依存関係のため）
DROP VIEW IF EXISTS user_generation_stats CASCADE;
DROP VIEW IF EXISTS subscription_statistics CASCADE;

-- 既存の制約を削除
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_subscription_status_check;

-- usersテーブルのsubscription_statusにprofessionalを追加
ALTER TABLE users
ALTER COLUMN subscription_status TYPE text;

-- 新しい制約を追加してprofessionalを許可
ALTER TABLE users
ADD CONSTRAINT users_subscription_status_check
CHECK (subscription_status IN ('free', 'premium', 'professional'));

-- プロフェッショナルプラン用のフィールド追加
ALTER TABLE users
ADD COLUMN IF NOT EXISTS payment_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_reset_month integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_support boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_engineer_id text,
ADD COLUMN IF NOT EXISTS professional_features jsonb DEFAULT '{}';

-- ビューを再作成
CREATE OR REPLACE VIEW user_generation_stats AS
SELECT
    u.display_name,
    u.subscription_status,
    u.monthly_usage_count,
    u.total_requests,
    COUNT(DISTINCT gc.id) as codes_generated,
    COUNT(DISTINCT cs.id) as share_links_created
FROM users u
LEFT JOIN generated_codes gc ON gc.user_id = u.display_name
LEFT JOIN code_shares cs ON cs.user_id = u.display_name
GROUP BY u.display_name, u.subscription_status, u.monthly_usage_count, u.total_requests;
```

## 方法2: ローカルのSupabase CLIを使用

もしローカルのSupabaseを起動したい場合：

```bash
# Dockerが必要
npx supabase start

# その後マイグレーション実行
npx supabase migration up
```

## 方法3: リモートデータベースに直接接続

Supabaseダッシュボードの Settings > Database から接続情報を取得：

```bash
# 接続文字列を使用
npx supabase db push --db-url "postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
```

## エラーが発生した場合

もし既存のビューに関するエラーが発生した場合は、まず以下を実行：

```sql
-- すべての依存ビューを確認
SELECT viewname FROM pg_views WHERE schemaname = 'public';

-- 問題のあるビューを個別に削除
DROP VIEW IF EXISTS [ビュー名] CASCADE;
```

その後、上記のマイグレーションSQLを再実行してください。