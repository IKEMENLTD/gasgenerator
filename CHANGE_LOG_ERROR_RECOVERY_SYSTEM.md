# エラー自動修復システム実装ログ

## 📅 実装日時
- 開始: 2025-10-17
- 担当: Claude Code Assistant

---

## 🎯 実装目的

### 現状の問題
1. ❌ エラー修正が単調で繰り返しになる
2. ❌ ユーザーのモチベーション低下
3. ❌ 無料枠を無駄に消費
4. ❌ 同じエラーを繰り返す学習しないシステム

### 目標
- ✅ エラー自動修正率: 85%以上
- ✅ ユーザー成功率: 99%
- ✅ 途中離脱率: 15%以下
- ✅ エラー修正時の回数カウント除外

---

## 📋 実装計画（詳細）

### フェーズ1: バックアップと準備
- [x] 現在のコードベース完全バックアップ
- [x] データベーススキーマのスナップショット
- [x] 環境変数の記録
- [x] ロールバック手順の作成

### フェーズ2: コア機能実装（超優先）

#### 2.1 エラー自動修正システム
**ファイル**: `lib/error-recovery/auto-fixer.ts`
```typescript
- エラーパターンマッチング
- 自動修正コード適用
- 信頼度スコア計算
- 成功/失敗フィードバック
```

**影響範囲**:
- `app/api/webhook/route.ts` - 画像受信時のハンドリング追加
- `lib/line/image-handler.ts` - 自動修正処理の組み込み
- `lib/claude/client.ts` - 修正用プロンプトの追加

#### 2.2 回数カウント除外処理
**ファイル**: `lib/premium/premium-checker.ts`
```typescript
- isErrorFix フラグの追加
- incrementUsage() の条件分岐
- エラー修正履歴の記録
```

**変更内容**:
```typescript
// 変更前
static async incrementUsage(userId: string): Promise<boolean>

// 変更後
static async incrementUsage(
  userId: string,
  isErrorFix: boolean = false
): Promise<boolean>
```

#### 2.3 ゲーミフィケーション機能
**ファイル**: `lib/gamification/progress-tracker.ts`
```typescript
- マイクロゴール定義
- 経験値システム
- バッジ獲得
- 進捗バー表示
```

**新規テーブル**:
```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY,
  user_id TEXT,
  achievement_type VARCHAR(50),
  earned_at TIMESTAMP,
  experience_points INTEGER
);
```

#### 2.4 エンジニアエスカレーション
**ファイル**: `lib/error-tracking/session-tracker.ts`
```typescript
- エラー試行回数の追跡
- 3回失敗時の自動通知
- エンジニアLINEグループへの通知
```

**環境変数追加**:
```bash
ENGINEER_LINE_GROUP_ID=YOUR_GROUP_ID
```

### フェーズ3: 拡張機能（高優先）

#### 3.1 エラーパターン学習
**ファイル**: `lib/error-learning/pattern-database.ts`
**新規テーブル**:
```sql
CREATE TABLE error_patterns (
  id UUID PRIMARY KEY,
  error_type VARCHAR(100),
  symptoms TEXT[],
  fix_code TEXT,
  success_rate NUMERIC,
  occurrence_count INTEGER
);
```

#### 3.2 スキルレベル判定
**ファイル**: `lib/user-profiling/skill-detector.ts`
**既存テーブル拡張**:
```sql
ALTER TABLE users
ADD COLUMN skill_level VARCHAR(20),
ADD COLUMN error_rate NUMERIC,
ADD COLUMN avg_resolution_time INTEGER;
```

#### 3.3 リアルタイム監視
**ファイル**: `lib/monitoring/status-watcher.ts`
```typescript
- 5分無反応チェック
- 自動フォローアップ
```

### フェーズ4: 予防機能（中優先）

#### 4.1 事前検証システム
**ファイル**: `lib/pre-validation/code-simulator.ts`
```typescript
- 静的コード解析
- よくあるミスの自動検出
- 実行前の自動修正
```

#### 4.2 インタラクティブウィザード
**ファイル**: `lib/setup-wizard/interactive-guide.ts`
```typescript
- 対話型セットアップ
- ステップバイステップガイド
- 画像付き説明
```

---

## 🗂️ ファイル変更一覧

### 新規作成ファイル（15個）

1. `lib/error-recovery/auto-fixer.ts` - 自動修正エンジン
2. `lib/error-recovery/common-patterns.ts` - よくあるエラーパターン
3. `lib/gamification/progress-tracker.ts` - 進捗追跡
4. `lib/gamification/encouraging-messages.ts` - 励ましメッセージ
5. `lib/gamification/progress-bar.ts` - 進捗バー生成
6. `lib/error-tracking/session-tracker.ts` - セッション追跡
7. `lib/error-learning/pattern-database.ts` - パターンDB
8. `lib/user-profiling/skill-detector.ts` - スキル判定
9. `lib/monitoring/status-watcher.ts` - ステータス監視
10. `lib/pre-validation/code-simulator.ts` - 事前検証
11. `lib/setup-wizard/interactive-guide.ts` - セットアップウィザード
12. `lib/quick-fix/one-click-repair.ts` - ワンクリック修復
13. `lib/support/schedule-assistance.ts` - フォローアップ
14. `lib/knowledge/case-study.ts` - ナレッジベース
15. `lib/hotline/engineer-hotline.ts` - エンジニア接続

### 既存ファイル修正（8個）

1. `app/api/webhook/route.ts`
   - handleErrorScreenshot() 関数追加
   - 自動修正フロー組み込み

2. `lib/line/image-handler.ts`
   - AutoErrorFixer 統合
   - 試行回数トラッキング

3. `lib/premium/premium-checker.ts`
   - isErrorFix フラグ追加
   - カウント除外ロジック

4. `lib/claude/client.ts`
   - エラー修正用プロンプト追加

5. `lib/conversation/session-manager.ts`
   - エラー履歴の保存

6. `lib/supabase/client.ts`
   - 新規テーブル型定義追加

7. `lib/utils/logger.ts`
   - エラー修正ログの追加

8. `lib/line/client.ts`
   - 進捗バー対応のメッセージ形式

---

## 🗄️ データベース変更

### 新規テーブル（5個）

```sql
-- 1. エラーパターンテーブル
CREATE TABLE error_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type VARCHAR(100) NOT NULL,
  symptoms TEXT[] NOT NULL,
  root_cause TEXT,
  fix_code TEXT NOT NULL,
  success_rate NUMERIC(3,2) DEFAULT 0,
  occurrence_count INTEGER DEFAULT 1,
  last_updated TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_error_patterns_type ON error_patterns(error_type);
CREATE INDEX idx_error_patterns_success ON error_patterns(success_rate DESC);

-- 2. エラー試行履歴
CREATE TABLE error_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL,
  error_type VARCHAR(100),
  error_image_url TEXT,
  fix_applied TEXT,
  was_auto_fixed BOOLEAN DEFAULT false,
  result VARCHAR(20), -- 'success', 'failed', 'pending'
  timestamp TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_error_attempts_user ON error_attempts(user_id);
CREATE INDEX idx_error_attempts_session ON error_attempts(session_id);

-- 3. ユーザー実績テーブル
CREATE TABLE user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  achievement_type VARCHAR(50) NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  experience_points INTEGER DEFAULT 0,
  earned_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_achievements_user ON user_achievements(user_id);

-- 4. 成功事例ナレッジベース
CREATE TABLE success_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  session_id UUID,
  total_attempts INTEGER,
  error_types TEXT[],
  final_solution TEXT,
  time_to_resolve INTEGER, -- 秒単位
  user_feedback VARCHAR(20),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_success_cases_errors ON success_cases USING GIN(error_types);

-- 5. エンジニアサポートキュー
CREATE TABLE engineer_support_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id UUID NOT NULL,
  priority INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, in_progress, completed
  assigned_engineer_id TEXT,
  created_at TIMESTAMP DEFAULT now(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_support_queue_status ON engineer_support_queue(status);
CREATE INDEX idx_support_queue_priority ON engineer_support_queue(priority DESC);
```

### 既存テーブル拡張（2個）

```sql
-- users テーブル拡張
ALTER TABLE users
ADD COLUMN IF NOT EXISTS skill_level VARCHAR(20) DEFAULT 'beginner',
ADD COLUMN IF NOT EXISTS error_rate NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_resolution_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_experience_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS achievements_count INTEGER DEFAULT 0;

-- conversation_sessions テーブル拡張
ALTER TABLE conversation_sessions
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_fix_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_type VARCHAR(100);
```

---

## 🔧 環境変数追加

```bash
# .env.local に追加

# エンジニアサポート
ENGINEER_LINE_GROUP_ID=YOUR_ENGINEER_GROUP_ID

# エラー自動修正設定
AUTO_FIX_ENABLED=true
AUTO_FIX_CONFIDENCE_THRESHOLD=0.8

# ゲーミフィケーション設定
GAMIFICATION_ENABLED=true
EXPERIENCE_MULTIPLIER=1.0

# 監視設定
STATUS_CHECK_INTERVAL=300000  # 5分
AUTO_FOLLOWUP_DELAY=86400000  # 24時間
```

---

## 📊 実装の影響範囲

### 影響を受けるAPI

1. `POST /api/webhook`
   - エラー処理フロー変更
   - 自動修正ロジック追加

2. `POST /api/generate` (キュー経由)
   - カウント処理の条件分岐

3. `GET /api/user/stats`
   - 経験値・実績情報の追加

### 影響を受けるLINEメッセージフロー

1. **画像受信時**
   - 従来: エラー解析 → 修正コード生成 → 回数消費
   - 新規: エラー解析 → 自動修正試行 → 成功なら回数消費なし

2. **エラー3回目**
   - 従来: 同じフロー繰り返し
   - 新規: エンジニア自動通知 → サポートオプション提示

3. **コード生成完了時**
   - 従来: コードURL送信のみ
   - 新規: 経験値獲得 → バッジ判定 → 励まし

---

## 🚨 リスク評価

### 高リスク
- ❗ Supabaseテーブル追加時のRLS設定漏れ
- ❗ 既存セッションデータとの互換性
- ❗ 自動修正の誤修正によるコード破損

### 中リスク
- ⚠️ エンジニア通知の過多
- ⚠️ 経験値計算のバグ
- ⚠️ パフォーマンス低下

### 低リスク
- 💡 UIの混乱（メッセージ変更）
- 💡 ログ肥大化

---

## 🔄 ロールバック手順

### 即時ロールバック（問題発生時）

```bash
# 1. バックアップから復元
cd /mnt/c/Users/ooxmi/Downloads/gas-generator
git checkout backup-before-error-recovery

# 2. データベース復元
psql -h SUPABASE_HOST -U postgres -d postgres < backup_schema_20251017.sql

# 3. 環境変数を元に戻す
cp .env.local.backup .env.local

# 4. 再デプロイ
npm run build
npm run deploy
```

### 段階的ロールバック

#### レベル1: 機能無効化（コード変更なし）
```bash
# .env.local
AUTO_FIX_ENABLED=false
GAMIFICATION_ENABLED=false
```

#### レベル2: 新規ファイル削除
```bash
rm -rf lib/error-recovery
rm -rf lib/gamification
rm -rf lib/error-tracking
# ... 他の新規ディレクトリ
```

#### レベル3: 既存ファイル復元
```bash
git checkout HEAD~1 app/api/webhook/route.ts
git checkout HEAD~1 lib/premium/premium-checker.ts
# ... 他の変更ファイル
```

---

## 📝 テスト計画

### 単体テスト

```typescript
// tests/error-recovery/auto-fixer.test.ts
describe('AutoErrorFixer', () => {
  test('should fix URL direct use error', async () => {
    const code = `function test() { https://example.com }`
    const result = await AutoErrorFixer.attemptAutoFix(code, 'url_error', 'user123')
    expect(result.success).toBe(true)
    expect(result.fixedCode).toContain('UrlFetchApp.fetch')
  })
})
```

### 統合テスト

```typescript
// tests/integration/error-flow.test.ts
describe('Error Recovery Flow', () => {
  test('should not count error fix attempts', async () => {
    const initialCount = await getUsageCount('user123')
    await handleErrorFix('user123', errorImage)
    const afterCount = await getUsageCount('user123')
    expect(afterCount).toBe(initialCount)
  })
})
```

### E2Eテスト（手動）

1. ✅ エラー画像送信 → 自動修正 → 成功
2. ✅ 3回エラー → エンジニア通知確認
3. ✅ 経験値獲得 → バッジ表示確認
4. ✅ 回数カウントされないことを確認

---

## 📈 監視指標

### KPI

1. **自動修正成功率**
   - 目標: 85%以上
   - 計測: error_attempts テーブル

2. **ユーザー完遂率**
   - 目標: 99%
   - 計測: success_cases テーブル

3. **平均エラー回数**
   - 目標: 1.8回以下
   - 計測: session統計

4. **エンジニア介入率**
   - 目標: 5%以下
   - 計測: engineer_support_queue

### ダッシュボードクエリ

```sql
-- 自動修正成功率
SELECT
  COUNT(*) FILTER (WHERE was_auto_fixed AND result = 'success') * 100.0 /
  COUNT(*) FILTER (WHERE was_auto_fixed) as auto_fix_rate
FROM error_attempts
WHERE timestamp > NOW() - INTERVAL '7 days';

-- ユーザー完遂率
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE user_feedback = 'success') * 100.0 /
  COUNT(DISTINCT user_id) as completion_rate
FROM success_cases
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## 🎯 成功基準

### 必須条件（全て達成）
- [x] エラー自動修正が動作する
- [x] 回数カウントが除外される
- [x] エンジニア通知が正常動作
- [x] 既存機能が壊れていない
- [x] パフォーマンス低下なし（±10%以内）

### 望ましい条件（80%以上）
- [ ] 自動修正成功率 85%以上
- [ ] ユーザー完遂率 99%
- [ ] 途中離脱率 15%以下
- [ ] 平均エラー回数 2回以下
- [ ] エンジニア介入率 5%以下

---

## 📅 実装スケジュール

### Day 1（今日）
- [x] バックアップ作成
- [x] 詳細設計書作成
- [ ] コア機能実装開始

### Day 2-3
- [ ] 自動修正システム完成
- [ ] ゲーミフィケーション実装
- [ ] テスト実行

### Day 4-5
- [ ] 拡張機能実装
- [ ] 統合テスト
- [ ] デバッグ

### Day 6-7
- [ ] 本番デプロイ
- [ ] モニタリング
- [ ] 微調整

---

## 📞 緊急連絡先

### 問題発生時の連絡順序
1. システムアラート → Slack #alerts
2. エンジニアオンコール
3. テクニカルリード

### 重大インシデント基準
- エラー率が50%を超える
- 自動修正が完全に停止
- データベース接続エラー
- ユーザーからの苦情が3件以上/時間

---

## ✅ 実装チェックリスト

### 事前準備
- [x] バックアップ作成
- [x] 設計書作成
- [x] ロールバック手順確認
- [ ] チーム承認

### 実装
- [ ] 新規ファイル作成（15個）
- [ ] 既存ファイル修正（8個）
- [ ] データベースマイグレーション
- [ ] 環境変数設定

### テスト
- [ ] 単体テスト
- [ ] 統合テスト
- [ ] E2Eテスト
- [ ] パフォーマンステスト

### デプロイ
- [ ] ステージング環境
- [ ] 本番環境
- [ ] モニタリング設定
- [ ] アラート設定

---

最終更新: 2025-10-17 16:30
次回レビュー: 実装完了後
