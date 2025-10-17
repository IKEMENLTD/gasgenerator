-- エラー自動修復システム用テーブル
-- 作成日: 2025-10-17
-- 目的: エラーパターンの学習と自動修復

-- 1. エラーパターンテーブル
CREATE TABLE IF NOT EXISTS error_patterns (
  id BIGSERIAL PRIMARY KEY,
  error_type VARCHAR(100) NOT NULL,  -- エラータイプ (例: ReferenceError, TypeError等)
  error_message TEXT NOT NULL,        -- エラーメッセージ
  error_context TEXT,                 -- エラーが発生したコンテキスト
  solution_pattern TEXT NOT NULL,     -- 修正パターン（どう修正すべきか）
  success_rate DECIMAL(5,2) DEFAULT 0.0,  -- 成功率（0-100%）
  usage_count INT DEFAULT 0,          -- このパターンが使用された回数
  last_used_at TIMESTAMPTZ,           -- 最後に使用された日時
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成（検索高速化）
CREATE INDEX idx_error_patterns_type ON error_patterns(error_type);
CREATE INDEX idx_error_patterns_success_rate ON error_patterns(success_rate DESC);

-- 2. エラー修復履歴テーブル
CREATE TABLE IF NOT EXISTS error_recovery_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,              -- LINE User ID
  session_id TEXT,                    -- セッションID
  original_code TEXT NOT NULL,        -- 元のコード
  error_screenshot_url TEXT,          -- エラースクリーンショットURL
  error_analysis JSONB,               -- エラー分析結果（Claude Visionから）
  detected_error_type VARCHAR(100),   -- 検出されたエラータイプ
  detected_error_message TEXT,        -- 検出されたエラーメッセージ
  fix_attempt_count INT DEFAULT 0,    -- 修正試行回数
  fixed_code TEXT,                    -- 修正後のコード
  fix_method VARCHAR(50),             -- 修正方法 (auto/manual/escalated)
  pattern_id BIGINT REFERENCES error_patterns(id),  -- 使用したパターンID
  is_successful BOOLEAN,              -- 修正が成功したか
  user_feedback TEXT,                 -- ユーザーフィードバック
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,            -- 解決した日時

  -- 外部キー
  CONSTRAINT fk_error_recovery_user FOREIGN KEY (user_id)
    REFERENCES users(line_user_id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX idx_error_recovery_user ON error_recovery_logs(user_id);
CREATE INDEX idx_error_recovery_session ON error_recovery_logs(session_id);
CREATE INDEX idx_error_recovery_created ON error_recovery_logs(created_at DESC);
CREATE INDEX idx_error_recovery_success ON error_recovery_logs(is_successful);

-- 3. ユーザー経験値テーブル（ゲーミフィケーション）
CREATE TABLE IF NOT EXISTS user_experience (
  user_id TEXT PRIMARY KEY,
  total_xp INT DEFAULT 0,              -- 総経験値
  level INT DEFAULT 1,                 -- レベル
  codes_generated INT DEFAULT 0,       -- 生成したコード数
  errors_fixed INT DEFAULT 0,          -- 修正したエラー数
  auto_fixes_count INT DEFAULT 0,      -- 自動修正成功回数
  badges JSONB DEFAULT '[]',           -- 獲得したバッジ
  achievements JSONB DEFAULT '[]',     -- 達成した実績
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 外部キー
  CONSTRAINT fk_user_experience_user FOREIGN KEY (user_id)
    REFERENCES users(line_user_id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX idx_user_experience_level ON user_experience(level DESC);
CREATE INDEX idx_user_experience_xp ON user_experience(total_xp DESC);

-- 4. バッジ定義テーブル
CREATE TABLE IF NOT EXISTS badge_definitions (
  id SERIAL PRIMARY KEY,
  badge_key VARCHAR(50) UNIQUE NOT NULL,  -- バッジキー (例: first_code, error_master)
  badge_name VARCHAR(100) NOT NULL,       -- バッジ名
  badge_description TEXT,                 -- 説明
  badge_icon VARCHAR(10),                 -- 絵文字アイコン
  unlock_condition JSONB NOT NULL,        -- 解除条件 (例: {"codes_generated": 1})
  rarity VARCHAR(20) DEFAULT 'common',    -- レア度 (common/rare/epic/legendary)
  xp_reward INT DEFAULT 0,                -- 獲得時のXP報酬
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期バッジデータ挿入
INSERT INTO badge_definitions (badge_key, badge_name, badge_description, badge_icon, unlock_condition, rarity, xp_reward) VALUES
('first_code', '🎉 はじめの一歩', '初めてコードを生成しました', '🎉', '{"codes_generated": 1}', 'common', 100),
('code_master_10', '💻 コードマスター', '10個のコードを生成', '💻', '{"codes_generated": 10}', 'rare', 500),
('error_survivor', '🛡️ エラーサバイバー', '初めてエラーを修正', '🛡️', '{"errors_fixed": 1}', 'common', 200),
('error_master', '⚡ エラーマスター', '10個のエラーを修正', '⚡', '{"errors_fixed": 10}', 'epic', 1000),
('auto_fix_pro', '🤖 自動修正プロ', '5回自動修正が成功', '🤖', '{"auto_fixes_count": 5}', 'rare', 800),
('speed_runner', '🚀 スピードランナー', '1日で3つのコード生成', '🚀', '{"daily_codes": 3}', 'rare', 600),
('perfectionist', '✨ 完璧主義者', 'エラーなしで5個連続生成', '✨', '{"perfect_streak": 5}', 'epic', 1500),
('legendary_coder', '👑 伝説のコーダー', '50個のコードを生成', '👑', '{"codes_generated": 50}', 'legendary', 5000)
ON CONFLICT (badge_key) DO NOTHING;

-- 5. エラー修復統計ビュー
CREATE OR REPLACE VIEW error_recovery_stats AS
SELECT
  detected_error_type,
  COUNT(*) as total_occurrences,
  COUNT(*) FILTER (WHERE is_successful = true) as successful_fixes,
  ROUND(AVG(fix_attempt_count), 2) as avg_attempts,
  COUNT(*) FILTER (WHERE fix_method = 'auto') as auto_fixes,
  COUNT(*) FILTER (WHERE fix_method = 'manual') as manual_fixes,
  COUNT(*) FILTER (WHERE fix_method = 'escalated') as escalated_cases
FROM error_recovery_logs
WHERE detected_error_type IS NOT NULL
GROUP BY detected_error_type
ORDER BY total_occurrences DESC;

-- 6. ユーザーランキングビュー
CREATE OR REPLACE VIEW user_leaderboard AS
SELECT
  u.line_user_id,
  ux.level,
  ux.total_xp,
  ux.codes_generated,
  ux.errors_fixed,
  ux.auto_fixes_count,
  jsonb_array_length(COALESCE(ux.badges, '[]'::jsonb)) as badge_count,
  ux.last_activity_at,
  RANK() OVER (ORDER BY ux.total_xp DESC) as rank
FROM users u
LEFT JOIN user_experience ux ON u.line_user_id = ux.user_id
WHERE ux.total_xp > 0
ORDER BY ux.total_xp DESC
LIMIT 100;

-- 7. トリガー: error_patterns の updated_at 自動更新
CREATE OR REPLACE FUNCTION update_error_pattern_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_error_pattern_timestamp
BEFORE UPDATE ON error_patterns
FOR EACH ROW
EXECUTE FUNCTION update_error_pattern_timestamp();

-- 8. トリガー: user_experience の updated_at 自動更新
CREATE OR REPLACE FUNCTION update_user_experience_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_experience_timestamp
BEFORE UPDATE ON user_experience
FOR EACH ROW
EXECUTE FUNCTION update_user_experience_timestamp();

-- 9. 関数: ユーザーレベルアップ判定
CREATE OR REPLACE FUNCTION check_level_up(p_user_id TEXT)
RETURNS TABLE (
  new_level INT,
  level_up BOOLEAN,
  xp_to_next_level INT
) AS $$
DECLARE
  v_current_xp INT;
  v_current_level INT;
  v_new_level INT;
  v_xp_for_next INT;
BEGIN
  -- 現在のXPとレベルを取得
  SELECT total_xp, level INTO v_current_xp, v_current_level
  FROM user_experience
  WHERE user_id = p_user_id;

  -- レベル計算（100XPごとに1レベル、指数関数的に必要XPが増加）
  v_new_level := FLOOR(POWER(v_current_xp / 100.0, 0.5)) + 1;

  -- 次のレベルまでに必要なXP
  v_xp_for_next := POWER(v_new_level, 2) * 100 - v_current_xp;

  RETURN QUERY SELECT
    v_new_level,
    v_new_level > v_current_level,
    v_xp_for_next;
END;
$$ LANGUAGE plpgsql;

-- 10. 関数: バッジ解除チェック
CREATE OR REPLACE FUNCTION check_badge_unlock(p_user_id TEXT)
RETURNS TABLE (
  badge_key VARCHAR(50),
  badge_name VARCHAR(100),
  badge_icon VARCHAR(10),
  xp_reward INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bd.badge_key,
    bd.badge_name,
    bd.badge_icon,
    bd.xp_reward
  FROM badge_definitions bd
  LEFT JOIN user_experience ux ON ux.user_id = p_user_id
  WHERE
    -- まだ獲得していないバッジ
    NOT (ux.badges ? bd.badge_key)
    AND (
      -- 条件チェック
      (bd.unlock_condition->>'codes_generated')::INT <= ux.codes_generated OR
      (bd.unlock_condition->>'errors_fixed')::INT <= ux.errors_fixed OR
      (bd.unlock_condition->>'auto_fixes_count')::INT <= ux.auto_fixes_count
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Row Level Security (RLS) 有効化
ALTER TABLE error_recovery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_experience ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分のデータのみ読み書き可能
CREATE POLICY error_recovery_user_policy ON error_recovery_logs
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY user_experience_user_policy ON user_experience
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- サービスロール用ポリシー（全てのデータにアクセス可能）
CREATE POLICY error_recovery_service_role_policy ON error_recovery_logs
  FOR ALL TO service_role USING (true);

CREATE POLICY user_experience_service_role_policy ON user_experience
  FOR ALL TO service_role USING (true);

-- 完了メッセージ
COMMENT ON TABLE error_patterns IS 'エラーパターン学習用テーブル - 自動修復システムのコア';
COMMENT ON TABLE error_recovery_logs IS 'エラー修復履歴 - 全てのエラー対応を記録';
COMMENT ON TABLE user_experience IS 'ユーザー経験値・レベル - ゲーミフィケーション';
COMMENT ON TABLE badge_definitions IS 'バッジ定義 - 達成報酬システム';
