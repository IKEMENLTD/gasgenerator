-- ================================================
-- エラー自動修復システム - データベーススキーマ
-- 作成日: 2025-10-17
-- 修正版: 外部キー制約を削除（LINE User ID直接使用）
-- ================================================

-- ================================================
-- 1. エラーパターン学習テーブル
-- ================================================
CREATE TABLE IF NOT EXISTS error_patterns (
  id BIGSERIAL PRIMARY KEY,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  error_context TEXT,
  solution_pattern TEXT NOT NULL,
  success_rate DECIMAL(5,2) DEFAULT 0.0,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_error_patterns_type ON error_patterns(error_type);
CREATE INDEX IF NOT EXISTS idx_error_patterns_success_rate ON error_patterns(success_rate DESC);

-- ================================================
-- 2. エラー修復ログテーブル
-- ================================================
CREATE TABLE IF NOT EXISTS error_recovery_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100),
  original_code TEXT,
  fixed_code TEXT,
  error_screenshot_url TEXT,
  error_analysis JSONB,
  detected_error_type VARCHAR(100),
  detected_error_message TEXT,
  fix_method VARCHAR(50),
  pattern_id BIGINT REFERENCES error_patterns(id),
  fix_attempt_count INT DEFAULT 0,
  is_successful BOOLEAN,
  user_feedback VARCHAR(50),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_recovery_logs_user_id ON error_recovery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_logs_session_id ON error_recovery_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_recovery_logs_created_at ON error_recovery_logs(created_at DESC);

-- ================================================
-- 3. ユーザー経験値テーブル（ゲーミフィケーション）
-- ================================================
CREATE TABLE IF NOT EXISTS user_experience (
  user_id VARCHAR(100) PRIMARY KEY,
  total_xp INT DEFAULT 0,
  level INT DEFAULT 1,
  codes_generated INT DEFAULT 0,
  errors_fixed INT DEFAULT 0,
  auto_fixes_count INT DEFAULT 0,
  badges JSONB DEFAULT '[]'::jsonb,
  achievements JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_experience_total_xp ON user_experience(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_experience_level ON user_experience(level DESC);

-- ================================================
-- 4. バッジ定義テーブル
-- ================================================
CREATE TABLE IF NOT EXISTS badge_definitions (
  badge_key VARCHAR(50) PRIMARY KEY,
  badge_name VARCHAR(100) NOT NULL,
  badge_icon VARCHAR(10) NOT NULL,
  badge_description TEXT NOT NULL,
  unlock_condition JSONB NOT NULL,
  rarity VARCHAR(20) DEFAULT 'common',
  xp_reward INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 初期バッジデータ投入
-- ================================================
INSERT INTO badge_definitions (badge_key, badge_name, badge_icon, badge_description, unlock_condition, rarity, xp_reward)
VALUES
  ('first_code', 'はじめの一歩', '🎉', '初めてのコード生成を達成', '{"codes_generated": 1}'::jsonb, 'common', 50),
  ('code_master', 'コードマスター', '💻', '10個のコードを生成', '{"codes_generated": 10}'::jsonb, 'rare', 200),
  ('error_survivor', 'エラーサバイバー', '🛡️', '初めてのエラー修正に成功', '{"errors_fixed": 1}'::jsonb, 'common', 100),
  ('error_master', 'エラーマスター', '⚡', '10個のエラーを修正', '{"errors_fixed": 10}'::jsonb, 'rare', 300),
  ('auto_fix_pro', '自動修正プロ', '🤖', '5回の自動修正に成功', '{"auto_fixes_count": 5}'::jsonb, 'epic', 500),
  ('speed_runner', 'スピードランナー', '🚀', '1日で3個のコードを生成', '{"codes_generated_today": 3}'::jsonb, 'rare', 150),
  ('perfectionist', '完璧主義者', '✨', '5連続でエラーなしコード生成', '{"consecutive_success": 5}'::jsonb, 'epic', 400),
  ('legendary_coder', '伝説のコーダー', '👑', '50個のコードを生成', '{"codes_generated": 50}'::jsonb, 'legendary', 1000)
ON CONFLICT (badge_key) DO NOTHING;

-- ================================================
-- 5. ビュー作成
-- ================================================

-- エラー修復統計ビュー
CREATE OR REPLACE VIEW error_recovery_stats AS
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
FROM error_recovery_logs
GROUP BY user_id;

-- ユーザーランキングビュー
CREATE OR REPLACE VIEW user_leaderboard AS
SELECT
  user_id as line_user_id,
  total_xp,
  level,
  codes_generated,
  errors_fixed,
  auto_fixes_count,
  ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
FROM user_experience
ORDER BY total_xp DESC;

-- ================================================
-- 6. 関数作成
-- ================================================

-- レベルアップチェック関数
CREATE OR REPLACE FUNCTION check_level_up(p_user_id VARCHAR)
RETURNS TABLE(level_up BOOLEAN, new_level INT) AS $$
DECLARE
  current_xp INT;
  current_level INT;
  calculated_level INT;
BEGIN
  SELECT total_xp, level INTO current_xp, current_level
  FROM user_experience
  WHERE user_id = p_user_id;

  -- レベル計算: √(XP/100) + 1
  calculated_level := FLOOR(SQRT(current_xp::DECIMAL / 100)) + 1;

  IF calculated_level > current_level THEN
    UPDATE user_experience
    SET level = calculated_level, updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT true, calculated_level;
  ELSE
    RETURN QUERY SELECT false, current_level;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- バッジ解除チェック関数
CREATE OR REPLACE FUNCTION check_badge_unlock(p_user_id VARCHAR)
RETURNS TABLE(badge_key VARCHAR, badge_name VARCHAR, badge_icon VARCHAR) AS $$
DECLARE
  user_stats RECORD;
  badge_rec RECORD;
  user_badges JSONB;
  condition_met BOOLEAN;
BEGIN
  -- ユーザー統計取得
  SELECT * INTO user_stats FROM user_experience WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  user_badges := COALESCE(user_stats.badges, '[]'::jsonb);

  -- 各バッジをチェック
  FOR badge_rec IN SELECT * FROM badge_definitions LOOP
    -- 既に獲得済みかチェック
    IF user_badges ? badge_rec.badge_key THEN
      CONTINUE;
    END IF;

    -- 条件チェック
    condition_met := false;

    IF badge_rec.unlock_condition ? 'codes_generated' THEN
      IF user_stats.codes_generated >= (badge_rec.unlock_condition->>'codes_generated')::INT THEN
        condition_met := true;
      END IF;
    END IF;

    IF badge_rec.unlock_condition ? 'errors_fixed' THEN
      IF user_stats.errors_fixed >= (badge_rec.unlock_condition->>'errors_fixed')::INT THEN
        condition_met := true;
      END IF;
    END IF;

    IF badge_rec.unlock_condition ? 'auto_fixes_count' THEN
      IF user_stats.auto_fixes_count >= (badge_rec.unlock_condition->>'auto_fixes_count')::INT THEN
        condition_met := true;
      END IF;
    END IF;

    -- 条件を満たしていればバッジ付与
    IF condition_met THEN
      user_badges := user_badges || jsonb_build_array(badge_rec.badge_key);

      UPDATE user_experience
      SET badges = user_badges, updated_at = NOW()
      WHERE user_id = p_user_id;

      RETURN QUERY SELECT badge_rec.badge_key, badge_rec.badge_name, badge_rec.badge_icon;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 7. トリガー作成（更新日時自動更新）
-- ================================================

-- 更新日時を自動更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
DROP TRIGGER IF EXISTS update_error_patterns_updated_at ON error_patterns;
CREATE TRIGGER update_error_patterns_updated_at
  BEFORE UPDATE ON error_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_error_recovery_logs_updated_at ON error_recovery_logs;
CREATE TRIGGER update_error_recovery_logs_updated_at
  BEFORE UPDATE ON error_recovery_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_experience_updated_at ON user_experience;
CREATE TRIGGER update_user_experience_updated_at
  BEFORE UPDATE ON user_experience
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- マイグレーション完了
-- ================================================
SELECT 'Error Recovery System migration completed successfully!' as status;
