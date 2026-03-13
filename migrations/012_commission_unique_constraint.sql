-- 012: agency_commission_distributions に重複防止 UNIQUE 制約を追加
-- 問題: 同一決済イベントが複数回処理された場合（checkout.session.completed +
--       payment_intent.succeeded の二重発火など）、同一 conversion_id + agency_id +
--       commission_type の行が重複して挿入されてしまう。
-- 解決: UNIQUE 制約 + コード側冪等チェックの二重防衛。

-- ── 1. 既存の重複行を削除（古い行を残して最新だけ保持） ──────────────────────
DO $$
BEGIN
    -- 重複が存在する場合のみ DELETE を実行して最小の id 以外を消す
    IF EXISTS (
        SELECT 1
        FROM agency_commission_distributions
        GROUP BY conversion_id, agency_id, commission_type
        HAVING COUNT(*) > 1
    ) THEN
        DELETE FROM agency_commission_distributions
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM agency_commission_distributions
            GROUP BY conversion_id, agency_id, commission_type
        );
        RAISE NOTICE 'Removed duplicate commission rows before adding unique constraint.';
    END IF;
END $$;

-- ── 2. UNIQUE 制約を追加 ──────────────────────────────────────────────────────
-- (conversion_id, agency_id, commission_type) の組み合わせは 1 件だけ許可。
-- 同一コンバージョンで同一代理店が "own" と "referral" を両方受け取ることは
-- 現行ロジックでは発生しないが、型まで含めることでより厳密に制御する。
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_commission_conversion_agency_type'
          AND conrelid = 'agency_commission_distributions'::regclass
    ) THEN
        ALTER TABLE agency_commission_distributions
            ADD CONSTRAINT uq_commission_conversion_agency_type
            UNIQUE (conversion_id, agency_id, commission_type);
        RAISE NOTICE 'Added unique constraint uq_commission_conversion_agency_type.';
    ELSE
        RAISE NOTICE 'Unique constraint uq_commission_conversion_agency_type already exists, skipping.';
    END IF;
END $$;

-- ── 3. stripe_event_id カラム（存在しない場合のみ追加） ──────────────────────
-- stripe-webhook.js が stripe_events テーブルでイベント単位の重複を防いでいるが、
-- commission_distributions 側にも発生源の Stripe Event ID を持たせると
-- デバッグが容易になる。
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'agency_commission_distributions'
          AND column_name = 'stripe_event_id'
    ) THEN
        ALTER TABLE agency_commission_distributions
            ADD COLUMN stripe_event_id TEXT;
        RAISE NOTICE 'Added stripe_event_id column.';
    ELSE
        RAISE NOTICE 'stripe_event_id column already exists, skipping.';
    END IF;
END $$;

-- stripe_event_id の検索用インデックス（UNIQUE にはしない。1 イベントで
-- 複数代理店へのコミッション行が生まれるため）
CREATE INDEX IF NOT EXISTS idx_commission_dist_stripe_event_id
    ON agency_commission_distributions(stripe_event_id)
    WHERE stripe_event_id IS NOT NULL;
