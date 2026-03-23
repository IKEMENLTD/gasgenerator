-- ============================================================
-- Supabase Security Advisor 全件修正マイグレーション
-- 問題A: RLS未設定 (24テーブル)
-- 問題B: SECURITY DEFINER ビュー (7ビュー)
-- 問題C: 機密カラム露出 (問題Aで連動解消)
-- Warning W1: Function Search Path Mutable (30関数)
-- Warning W2: RLS Policy Always True (10テーブル)
-- Warning W3: Extension in Public (vector)
-- ============================================================
-- 注意: 全テーブルは supabaseAdmin (service_role) 経由でアクセスされるため
-- RLS有効化後も service_role はバイパスしてアクセス可能。
-- anon/authenticated からの直接アクセスはポリシーで制御される。
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1-A: 全テーブルに RLS を有効化
-- ============================================================

ALTER TABLE IF EXISTS public.conversation_states          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.requirement_extractions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.generation_queue             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.metrics                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vision_usage                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.code_quality_checks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.claude_usage                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_conversions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.professional_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.error_patterns               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.error_recovery_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.line_profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agencies                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_tracking_visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_tracking_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.badge_definitions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_experience              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_commissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drip_logs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.migration_history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agency_service_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_sequence             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.consultation_leads           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 1-B: RLS ポリシー設定
-- ============================================================
-- 全テーブルは supabaseAdmin (service_role) でアクセスされるため
-- service_role は RLS をバイパスする。
-- ポリシーは anon/authenticated からの不正アクセスを防止する目的。
-- ============================================================

-- -------------------------------------------------------
-- サーバーサイド専用テーブル（anon/authenticated 完全ブロック）
-- service_role のみアクセス可能
-- -------------------------------------------------------

-- password_reset_tokens（最優先: token漏洩 = アカウント乗っ取り）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.password_reset_tokens;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.password_reset_tokens
  FOR ALL USING (false);

-- migration_history（システムメタデータ）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.migration_history;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.migration_history
  FOR ALL USING (false);

-- metrics（内部メトリクス）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.metrics;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.metrics
  FOR ALL USING (false);

-- error_recovery_logs（エラー復旧ログ）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.error_recovery_logs;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.error_recovery_logs
  FOR ALL USING (false);

-- invoice_sequence（請求書番号シーケンス）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.invoice_sequence;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.invoice_sequence
  FOR ALL USING (false);

-- support_requests（サポートリクエスト）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.support_requests;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.support_requests
  FOR ALL USING (false);

-- conversation_states（会話状態 - サーバーサイド管理）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.conversation_states;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.conversation_states
  FOR ALL USING (false);

-- generation_queue（コード生成キュー）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.generation_queue;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.generation_queue
  FOR ALL USING (false);

-- claude_usage（API使用量追跡）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.claude_usage;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.claude_usage
  FOR ALL USING (false);

-- vision_usage（画像分析使用量）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.vision_usage;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.vision_usage
  FOR ALL USING (false);

-- requirement_extractions（要件抽出ログ）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.requirement_extractions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.requirement_extractions
  FOR ALL USING (false);

-- code_quality_checks（コード品質チェック）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.code_quality_checks;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.code_quality_checks
  FOR ALL USING (false);

-- line_profiles（LINEプロフィール）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.line_profiles;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.line_profiles
  FOR ALL USING (false);

-- drip_logs（ドリップ配信ログ）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.drip_logs;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.drip_logs
  FOR ALL USING (false);

-- user_experience（ゲーミフィケーション）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.user_experience;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.user_experience
  FOR ALL USING (false);

-- professional_support_tickets（プロサポートチケット）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.professional_support_tickets;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.professional_support_tickets
  FOR ALL USING (false);

-- consultation_leads（相談リード）
DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.consultation_leads;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.consultation_leads
  FOR ALL USING (false);

-- -------------------------------------------------------
-- エージェンシー系テーブル（サーバーサイド専用）
-- Netlify Functions は全て service_role でアクセス
-- -------------------------------------------------------

DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.agencies;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.agencies
  FOR ALL USING (false);

DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.agency_users;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.agency_users
  FOR ALL USING (false);

DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.agency_tracking_links;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.agency_tracking_links
  FOR ALL USING (false);

DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.agency_tracking_visits;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.agency_tracking_visits
  FOR ALL USING (false);

DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.agency_conversions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.agency_conversions
  FOR ALL USING (false);

DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.agency_commissions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.agency_commissions
  FOR ALL USING (false);

DO $$ BEGIN
  DROP POLICY IF EXISTS "no_direct_access" ON public.agency_service_settings;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "no_direct_access" ON public.agency_service_settings
  FOR ALL USING (false);

-- -------------------------------------------------------
-- 読み取り専用マスタ系（authenticated のみ読み取り可）
-- -------------------------------------------------------

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read" ON public.badge_definitions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "authenticated_read" ON public.badge_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read" ON public.services;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "authenticated_read" ON public.services
  FOR SELECT USING (auth.role() = 'authenticated');

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read" ON public.error_patterns;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "authenticated_read" ON public.error_patterns
  FOR SELECT USING (auth.role() = 'authenticated');


-- ============================================================
-- STEP 1-C: W2 — RLS Policy Always True 修正（10テーブル）
-- 既存の USING(true) ポリシーを適切なポリシーに置換
-- ============================================================

-- users テーブル（最重要）
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON public.users;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.users;
  DROP POLICY IF EXISTS "Service role can access all" ON public.users;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "users_service_only" ON public.users
  FOR ALL USING (false);
-- ※ 全アクセスが supabaseAdmin 経由のため false で十分

-- conversations テーブル
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON public.conversations;
  DROP POLICY IF EXISTS "Service role can access all" ON public.conversations;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "conversations_service_only" ON public.conversations
  FOR ALL USING (false);

-- conversation_contexts テーブル
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON public.conversation_contexts;
  DROP POLICY IF EXISTS "Service role can access all" ON public.conversation_contexts;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "conversation_contexts_service_only" ON public.conversation_contexts
  FOR ALL USING (false);

-- conversation_code_relations テーブル
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON public.conversation_code_relations;
  DROP POLICY IF EXISTS "Users view own history" ON public.conversation_code_relations;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "ccr_service_only" ON public.conversation_code_relations
  FOR ALL USING (false);

-- user_code_history テーブル
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON public.user_code_history;
  DROP POLICY IF EXISTS "Users view own history" ON public.user_code_history;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "user_code_history_service_only" ON public.user_code_history
  FOR ALL USING (false);

-- user_sessions テーブル
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for service role" ON public.user_sessions;
  DROP POLICY IF EXISTS "Service role can access all" ON public.user_sessions;
  DROP POLICY IF EXISTS "allow_all" ON public.user_sessions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "user_sessions_service_only" ON public.user_sessions
  FOR ALL USING (false);

-- code_shares テーブル（公開共有機能あり → 読み取りは公開、書き込みはservice_role）
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON public.code_shares;
  DROP POLICY IF EXISTS "Public shares are viewable" ON public.code_shares;
  DROP POLICY IF EXISTS "Service role can access all" ON public.code_shares;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "code_shares_public_read" ON public.code_shares
  FOR SELECT USING (is_public = true AND is_deleted = false);
CREATE POLICY "code_shares_service_write" ON public.code_shares
  FOR INSERT WITH CHECK (false);
CREATE POLICY "code_shares_service_update" ON public.code_shares
  FOR UPDATE USING (false);
CREATE POLICY "code_shares_service_delete" ON public.code_shares
  FOR DELETE USING (false);

-- code_share_access_logs テーブル（アクセスログ記録 → insertのみ許可）
DO $$ BEGIN
  DROP POLICY IF EXISTS "allow_all" ON public.code_share_access_logs;
  DROP POLICY IF EXISTS "Anyone can log access" ON public.code_share_access_logs;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "access_logs_insert_only" ON public.code_share_access_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "access_logs_read_service" ON public.code_share_access_logs
  FOR SELECT USING (false);

-- code_revisions テーブル
DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role can access all revisions" ON public.code_revisions;
  DROP POLICY IF EXISTS "Service role can manage all revisions" ON public.code_revisions;
  DROP POLICY IF EXISTS "allow_all" ON public.code_revisions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "code_revisions_service_only" ON public.code_revisions
  FOR ALL USING (false);

-- session_checkpoints テーブル
DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role can access all checkpoints" ON public.session_checkpoints;
  DROP POLICY IF EXISTS "allow_all" ON public.session_checkpoints;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE POLICY "session_checkpoints_service_only" ON public.session_checkpoints
  FOR ALL USING (false);


-- ============================================================
-- STEP 2: SECURITY DEFINER ビューの再作成（security_invoker = true）
-- ============================================================

DROP VIEW IF EXISTS public.user_generation_stats;
CREATE VIEW public.user_generation_stats
  WITH (security_invoker = true)
AS
SELECT
    u.display_name,
    u.subscription_status,
    u.monthly_usage_count,
    u.total_requests,
    COUNT(DISTINCT gc.id) as codes_generated,
    COUNT(DISTINCT cs.id) as share_links_created
FROM public.users u
LEFT JOIN public.generated_codes gc ON gc.user_id = u.display_name
LEFT JOIN public.code_shares cs ON cs.user_id = u.display_name
GROUP BY u.display_name, u.subscription_status, u.monthly_usage_count, u.total_requests;

DROP VIEW IF EXISTS public.active_sessions;
CREATE VIEW public.active_sessions
  WITH (security_invoker = true)
AS
SELECT
    cs.id,
    cs.user_id,
    cs.status,
    cs.category,
    cs.created_at,
    u.subscription_status,
    u.display_name
FROM public.conversation_sessions cs
JOIN public.users u ON u.display_name = cs.user_id
WHERE cs.status = 'active';

DROP VIEW IF EXISTS public.user_leaderboard;
CREATE VIEW public.user_leaderboard
  WITH (security_invoker = true)
AS
SELECT
  user_id as line_user_id,
  total_xp,
  level,
  codes_generated,
  errors_fixed,
  auto_fixes_count,
  ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
FROM public.user_experience
ORDER BY total_xp DESC;

DROP VIEW IF EXISTS public.conversation_stats;
CREATE VIEW public.conversation_stats
  WITH (security_invoker = true)
AS
SELECT
  user_id,
  COUNT(DISTINCT session_id) as total_sessions,
  COUNT(*) as total_messages,
  MAX(created_at) as last_activity,
  MIN(created_at) as first_activity,
  AVG(LENGTH(content)) as avg_message_length
FROM public.conversations
GROUP BY user_id;

DROP VIEW IF EXISTS public.user_profiles;
CREATE VIEW public.user_profiles
  WITH (security_invoker = true)
AS
SELECT
  u.display_name as line_id,
  COALESCE(u.line_display_name, lp.display_name, '未設定') as display_name,
  u.subscription_status,
  u.is_premium,
  u.last_active_at,
  u.monthly_usage_count,
  lp.picture_url,
  lp.status_message
FROM public.users u
LEFT JOIN public.line_profiles lp ON u.display_name = lp.user_id
ORDER BY u.last_active_at DESC;

DROP VIEW IF EXISTS public.subscription_statistics;
CREATE VIEW public.subscription_statistics
  WITH (security_invoker = true)
AS
SELECT
    subscription_status,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE last_active_at > now() - interval '7 days') as active_last_7days,
    COUNT(*) FILTER (WHERE last_active_at > now() - interval '30 days') as active_last_30days,
    COUNT(*) FILTER (WHERE subscription_status = 'professional') as professional_users
FROM public.users
GROUP BY subscription_status;

DROP VIEW IF EXISTS public.error_recovery_stats;
CREATE VIEW public.error_recovery_stats
  WITH (security_invoker = true)
AS
SELECT
  user_id,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN is_successful = true THEN 1 ELSE 0 END) as successful_fixes,
  SUM(CASE WHEN is_successful = false THEN 1 ELSE 0 END) as failed_fixes,
  ROUND(
    (SUM(CASE WHEN is_successful = true THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as success_rate,
  MAX(created_at) as last_fix_attempt
FROM public.error_recovery_logs
GROUP BY user_id;


-- ============================================================
-- STEP 3: W1 — Function Search Path Mutable 修正（30関数）
-- search_path を空文字列に固定
-- ============================================================

DO $$ BEGIN ALTER FUNCTION public.increment_user_requests() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.sync_conversation_messages() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.increment_copy_count() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.update_code_shares_updated_at() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.set_invoice_retention() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_standard_commission_rate() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.reset_monthly_download_count() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.cleanup_expired_conversations() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.delete_expired_tokens() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.update_updated_at_column() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.cleanup_old_conversations() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.check_level_up() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.sync_line_display_names() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.cleanup_old_metrics() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.update_consultation_leads_updated_at() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.save_line_profile() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_or_create_stripe_customer() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.cleanup_expired_registration_tokens() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_active_subscription() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.update_line_display_name() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.check_badge_unlock() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_next_invoice_number() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.upsert_stripe_subscription() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.check_short_id_exists() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_latest_session_id() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.increment_view_count() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.update_updated_at() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_agency_hierarchy() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.execute_system_download() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.can_download_system() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ============================================================
-- STEP 4: W3 — Extension in Public (vector → extensions スキーマ)
-- ============================================================

-- vector拡張をextensionsスキーマに移動
-- 注意: 既存のvector型カラム(system_embeddings.embedding)に影響する可能性
-- search_pathに extensions が含まれていれば自動解決される
DO $$
BEGIN
  -- extensionsスキーマが存在しない場合は作成
  CREATE SCHEMA IF NOT EXISTS extensions;

  -- 現在publicにある場合のみ移動
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector' AND extnamespace = 'public'::regnamespace
  ) THEN
    DROP EXTENSION vector;
    CREATE EXTENSION vector SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'vector extension migration skipped: %', SQLERRM;
END $$;

COMMIT;

-- ============================================================
-- 適用後の検証SQL（手動実行用）
-- ============================================================
-- 1. RLS有効化確認:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' ORDER BY tablename;
--
-- 2. ポリシー確認:
--    SELECT tablename, policyname, cmd, qual
--    FROM pg_policies WHERE schemaname = 'public'
--    ORDER BY tablename, policyname;
--
-- 3. ビュー確認:
--    SELECT viewname FROM pg_views WHERE schemaname = 'public';
--
-- 4. 関数search_path確認:
--    SELECT proname, proconfig FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--    AND proconfig IS NOT NULL;
