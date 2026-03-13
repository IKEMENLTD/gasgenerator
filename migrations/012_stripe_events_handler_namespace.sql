-- ===================================================================
-- Migration 012: stripe_events ハンドラー名前空間対応
-- 作成日: 2026-03-13
-- 説明:
--   Stripe Webhookは Render（サブスク処理）と Netlify（コミッション処理）の
--   2つのハンドラーで受信される。従来の event_id 単一 UNIQUE 制約では、
--   どちらか一方が先にレコードを挿入すると、もう一方が UNIQUE 違反で
--   スキップされ、二重処理ではなく未処理が発生するバグがあった。
--
--   修正方針:
--     event_id カラムに ":render" / ":netlify" サフィックスを付加した
--     複合キー形式（例: "evt_xxx:render"）でそれぞれ独立して記録する。
--     これにより各ハンドラーが独立した冪等性を持ちつつ、同一ハンドラー
--     内での重複処理（Stripe リトライ等）を確実に防止できる。
--
--   既存データ互換性:
--     event_id カラムの UNIQUE 制約はそのまま維持する。
--     既存レコード（サフィックスなし）はそのまま有効。
-- ===================================================================

-- handler カラムを追加（記録・デバッグ用、NULL 許容で後方互換）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_events' AND column_name = 'handler'
  ) THEN
    ALTER TABLE stripe_events ADD COLUMN handler TEXT;
    COMMENT ON COLUMN stripe_events.handler IS
      'ハンドラー識別子: "render" = サブスク処理, "netlify" = コミッション処理';
  END IF;
END $$;

-- handler カラムのインデックス
CREATE INDEX IF NOT EXISTS idx_stripe_events_handler ON stripe_events(handler);

-- 既存の event_id UNIQUE 制約の確認（002_stripe_tables.sql で作成済み）
-- event_id TEXT UNIQUE NOT NULL は維持する。
-- ":render" / ":netlify" サフィックス付き event_id が衝突しないことを確認。

-- ===================================================================
-- 完了
-- ===================================================================
