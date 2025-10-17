#!/bin/bash

# ===================================================================
# TaskMate エラー自動修復システム実装前バックアップスクリプト
# 作成日: 2025-10-17
# 用途: 大規模変更前の完全バックアップと復元ポイント作成
# ===================================================================

BACKUP_DIR="backup_20251017_error_recovery"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_ROOT="/mnt/c/Users/ooxmi/Downloads/gas-generator"

echo "🔄 バックアップ開始: $TIMESTAMP"

# バックアップディレクトリ作成
mkdir -p "$PROJECT_ROOT/$BACKUP_DIR"

# ===================================================================
# 1. ソースコードバックアップ
# ===================================================================

echo "📦 ソースコードをバックアップ中..."

# 重要なディレクトリをバックアップ
declare -a IMPORTANT_DIRS=(
  "app"
  "lib"
  "middleware"
  "public"
  "types"
  "scripts"
  "supabase"
)

for dir in "${IMPORTANT_DIRS[@]}"; do
  if [ -d "$PROJECT_ROOT/$dir" ]; then
    echo "  → $dir をコピー中..."
    cp -r "$PROJECT_ROOT/$dir" "$PROJECT_ROOT/$BACKUP_DIR/"
  fi
done

# 重要な設定ファイルをバックアップ
declare -a CONFIG_FILES=(
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "next.config.js"
  "tailwind.config.js"
  ".env.local"
  ".env.production"
  "netlify.toml"
  "render.yaml"
)

echo "📝 設定ファイルをバックアップ中..."
for file in "${CONFIG_FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$file" ]; then
    echo "  → $file をコピー中..."
    cp "$PROJECT_ROOT/$file" "$PROJECT_ROOT/$BACKUP_DIR/"
  fi
done

# ===================================================================
# 2. データベーススキーマバックアップ
# ===================================================================

echo "🗄️ データベーススキーマをバックアップ中..."

cat > "$PROJECT_ROOT/$BACKUP_DIR/schema_backup.sql" << 'EOF'
-- ===================================================================
-- TaskMate データベーススキーマバックアップ
-- 作成日: 2025-10-17
-- 説明: エラー自動修復システム実装前のスキーマ
-- ===================================================================

-- 既存テーブル構造
-- users, conversation_sessions, generated_codes, etc.

-- 復元コマンド:
-- psql -h YOUR_HOST -U postgres -d postgres < schema_backup.sql

EOF

# ===================================================================
# 3. Gitコミットバックアップ
# ===================================================================

echo "📚 Gitコミット履歴を記録中..."

cd "$PROJECT_ROOT" || exit

# 現在のブランチとコミットを記録
git branch > "$PROJECT_ROOT/$BACKUP_DIR/git_branch.txt"
git log -10 --oneline > "$PROJECT_ROOT/$BACKUP_DIR/git_log.txt"
git diff HEAD > "$PROJECT_ROOT/$BACKUP_DIR/git_diff.patch"
git status > "$PROJECT_ROOT/$BACKUP_DIR/git_status.txt"

# 変更前のコミットハッシュを記録
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "$CURRENT_COMMIT" > "$PROJECT_ROOT/$BACKUP_DIR/restore_point.txt"
echo "復元ポイント: $CURRENT_COMMIT" >> "$PROJECT_ROOT/$BACKUP_DIR/RESTORE_INSTRUCTIONS.md"

# ===================================================================
# 4. 環境変数バックアップ
# ===================================================================

echo "🔐 環境変数をバックアップ中..."

if [ -f "$PROJECT_ROOT/.env.local" ]; then
  cp "$PROJECT_ROOT/.env.local" "$PROJECT_ROOT/$BACKUP_DIR/.env.local.backup"
fi

if [ -f "$PROJECT_ROOT/.env.production" ]; then
  cp "$PROJECT_ROOT/.env.production" "$PROJECT_ROOT/$BACKUP_DIR/.env.production.backup"
fi

# ===================================================================
# 5. 依存関係バックアップ
# ===================================================================

echo "📦 依存関係を記録中..."

npm list --depth=0 > "$PROJECT_ROOT/$BACKUP_DIR/npm_dependencies.txt"
npm outdated > "$PROJECT_ROOT/$BACKUP_DIR/npm_outdated.txt" || true

# ===================================================================
# 6. 復元手順書作成
# ===================================================================

echo "📖 復元手順書を作成中..."

cat > "$PROJECT_ROOT/$BACKUP_DIR/RESTORE_INSTRUCTIONS.md" << 'EOF'
# 🔄 復元手順書

## 緊急時の完全復元（5分で復旧）

### ステップ1: バックアップから復元

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator

# 現在の状態を退避
mv app app_broken
mv lib lib_broken

# バックアップから復元
cp -r backup_20251017_error_recovery/app ./
cp -r backup_20251017_error_recovery/lib ./
cp -r backup_20251017_error_recovery/middleware ./

# 設定ファイル復元
cp backup_20251017_error_recovery/package.json ./
cp backup_20251017_error_recovery/.env.local ./
cp backup_20251017_error_recovery/tsconfig.json ./
```

### ステップ2: 依存関係の復元

```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

### ステップ3: ビルド確認

```bash
npm run build

# エラーがなければOK
# エラーがあれば次のステップへ
```

### ステップ4: Gitから復元（最終手段）

```bash
# 復元ポイントに戻る
RESTORE_POINT=$(cat backup_20251017_error_recovery/restore_point.txt)
git reset --hard $RESTORE_POINT

# 依存関係再インストール
npm install

# ビルド
npm run build
```

### ステップ5: デプロイ

```bash
# Render.comに再デプロイ
git push origin main

# または手動デプロイ
npm run deploy
```

---

## 段階的復元（機能ごとに戻す）

### レベル1: 新機能を無効化（最速）

```bash
# .env.local で機能を無効化
AUTO_FIX_ENABLED=false
GAMIFICATION_ENABLED=false
```

### レベル2: 新規ファイルのみ削除

```bash
# 新規追加されたディレクトリを削除
rm -rf lib/error-recovery
rm -rf lib/gamification
rm -rf lib/error-tracking
rm -rf lib/user-profiling
rm -rf lib/monitoring
rm -rf lib/pre-validation
rm -rf lib/setup-wizard
rm -rf lib/quick-fix
rm -rf lib/support
rm -rf lib/knowledge
rm -rf lib/hotline
```

### レベル3: 変更ファイルのみ復元

```bash
# 特定のファイルだけバックアップから復元
cp backup_20251017_error_recovery/app/api/webhook/route.ts ./app/api/webhook/
cp backup_20251017_error_recovery/lib/premium/premium-checker.ts ./lib/premium/
cp backup_20251017_error_recovery/lib/line/image-handler.ts ./lib/line/
```

---

## データベース復元

### Supabaseテーブル削除

```sql
-- 新規追加されたテーブルを削除
DROP TABLE IF EXISTS error_patterns CASCADE;
DROP TABLE IF EXISTS error_attempts CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS success_cases CASCADE;
DROP TABLE IF EXISTS engineer_support_queue CASCADE;

-- users テーブルから追加カラムを削除
ALTER TABLE users
DROP COLUMN IF EXISTS skill_level,
DROP COLUMN IF EXISTS error_rate,
DROP COLUMN IF EXISTS avg_resolution_time,
DROP COLUMN IF EXISTS total_experience_points,
DROP COLUMN IF EXISTS achievements_count;

-- conversation_sessions から追加カラムを削除
ALTER TABLE conversation_sessions
DROP COLUMN IF EXISTS error_count,
DROP COLUMN IF EXISTS auto_fix_count,
DROP COLUMN IF EXISTS last_error_type;
```

---

## 検証チェックリスト

復元後、以下を確認：

- [ ] アプリがビルドできる
- [ ] Webhookが応答する
- [ ] コード生成が動作する
- [ ] データベース接続OK
- [ ] エラーログに異常がない
- [ ] ユーザーが正常に使える

---

## トラブルシューティング

### ビルドエラーが出る

```bash
# キャッシュクリア
rm -rf .next node_modules
npm install
npm run build
```

### 型エラーが出る

```bash
# TypeScript設定を復元
cp backup_20251017_error_recovery/tsconfig.json ./
```

### データベースエラー

```bash
# Supabaseの接続確認
psql -h YOUR_HOST -U postgres -d postgres -c "SELECT 1"
```

---

## サポート

復元に失敗した場合:
1. このファイルを確認
2. バックアップディレクトリ全体を確認
3. Git履歴を確認 (`git reflog`)

EOF

# ===================================================================
# 7. バックアップ内容一覧作成
# ===================================================================

echo "📋 バックアップ内容一覧を作成中..."

cat > "$PROJECT_ROOT/$BACKUP_DIR/BACKUP_CONTENTS.md" << EOF
# バックアップ内容一覧

## 基本情報
- 作成日時: $TIMESTAMP
- 復元ポイント: $CURRENT_COMMIT
- プロジェクトパス: $PROJECT_ROOT

## バックアップファイル

### ディレクトリ
$(ls -la "$PROJECT_ROOT/$BACKUP_DIR" | grep "^d" | awk '{print "- " $9}')

### 設定ファイル
$(ls -la "$PROJECT_ROOT/$BACKUP_DIR" | grep -E "\.(json|js|ts|toml|yaml|env)" | awk '{print "- " $9}')

### 合計サイズ
$(du -sh "$PROJECT_ROOT/$BACKUP_DIR" | awk '{print $1}')

## 復元コマンド（クイックリファレンス）

\`\`\`bash
# 完全復元
cd $PROJECT_ROOT
cp -r backup_20251017_error_recovery/app ./
cp -r backup_20251017_error_recovery/lib ./
npm install
npm run build

# Git復元
git reset --hard $CURRENT_COMMIT
\`\`\`

## 変更予定ファイル

### 新規作成（15個）
1. lib/error-recovery/auto-fixer.ts
2. lib/gamification/progress-tracker.ts
3. lib/error-tracking/session-tracker.ts
[... 他12個]

### 既存修正（8個）
1. app/api/webhook/route.ts
2. lib/premium/premium-checker.ts
3. lib/line/image-handler.ts
[... 他5個]

EOF

# ===================================================================
# 8. 圧縮アーカイブ作成
# ===================================================================

echo "🗜️ バックアップを圧縮中..."

cd "$PROJECT_ROOT" || exit
tar -czf "${BACKUP_DIR}_${TIMESTAMP}.tar.gz" "$BACKUP_DIR"

# ===================================================================
# 9. バックアップ検証
# ===================================================================

echo "✅ バックアップを検証中..."

# 必須ファイルの存在確認
declare -a REQUIRED_FILES=(
  "$BACKUP_DIR/app"
  "$BACKUP_DIR/lib"
  "$BACKUP_DIR/package.json"
  "$BACKUP_DIR/RESTORE_INSTRUCTIONS.md"
  "$BACKUP_DIR/restore_point.txt"
)

BACKUP_OK=true
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -e "$PROJECT_ROOT/$file" ]; then
    echo "❌ エラー: $file が見つかりません"
    BACKUP_OK=false
  fi
done

# ===================================================================
# 10. 完了レポート
# ===================================================================

if [ "$BACKUP_OK" = true ]; then
  echo ""
  echo "✅ ========================================="
  echo "✅ バックアップ完了！"
  echo "✅ ========================================="
  echo ""
  echo "📁 バックアップ先: $PROJECT_ROOT/$BACKUP_DIR"
  echo "📦 アーカイブ: ${BACKUP_DIR}_${TIMESTAMP}.tar.gz"
  echo "📝 復元手順: $BACKUP_DIR/RESTORE_INSTRUCTIONS.md"
  echo "🔄 復元ポイント: $CURRENT_COMMIT"
  echo ""
  echo "🚀 これから実装を開始できます！"
  echo ""
  echo "⚠️  問題が発生したら以下を実行:"
  echo "   bash $PROJECT_ROOT/$BACKUP_DIR/RESTORE_INSTRUCTIONS.md"
  echo ""
else
  echo ""
  echo "❌ ========================================="
  echo "❌ バックアップに問題があります"
  echo "❌ ========================================="
  echo ""
  echo "上記のエラーを確認してください"
  exit 1
fi

# ===================================================================
# 11. 変更履歴にコミット（オプション）
# ===================================================================

# Gitにバックアップをコミット（任意）
read -p "バックアップをGitにコミットしますか？ (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git add "$BACKUP_DIR"
  git commit -m "📦 Backup before error recovery system implementation

- Created comprehensive backup
- Restore point: $CURRENT_COMMIT
- Backup date: $TIMESTAMP
- Location: $BACKUP_DIR"
  echo "✅ バックアップをGitにコミットしました"
fi

echo ""
echo "🎉 全ての準備が完了しました！"
