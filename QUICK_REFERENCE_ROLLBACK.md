# 🚨 緊急時クイックリファレンス

## ⚡ 5分で完全復元（コピペ用）

### パターン1: コードのみ復元

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator

# 重要ファイル復元
cp backup_20251017_error_recovery/app/api/webhook/route.ts ./app/api/webhook/
cp backup_20251017_error_recovery/lib/premium/premium-checker.ts ./lib/premium/
cp backup_20251017_error_recovery/lib/line/image-handler.ts ./lib/line/

# ビルド
npm run build
```

### パターン2: 完全復元

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator

# バックアップから復元
cp -r backup_20251017_error_recovery/app ./
cp -r backup_20251017_error_recovery/lib ./
cp backup_20251017_error_recovery/package.json ./
cp backup_20251017_error_recovery/.env.local ./

# 再インストール
npm install
npm run build
```

### パターン3: Git復元

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator

# 復元ポイントに戻る
git reset --hard $(cat backup_20251017_error_recovery/restore_point.txt)

# 再ビルド
npm install
npm run build
```

---

## 🗄️ データベース復元（コピペ用）

### 新規テーブル削除

```sql
-- Supabase SQL Editorで実行
DROP TABLE IF EXISTS error_patterns CASCADE;
DROP TABLE IF EXISTS error_attempts CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS success_cases CASCADE;
DROP TABLE IF EXISTS engineer_support_queue CASCADE;
```

### 追加カラム削除

```sql
-- users テーブル
ALTER TABLE users
DROP COLUMN IF EXISTS skill_level,
DROP COLUMN IF EXISTS error_rate,
DROP COLUMN IF EXISTS avg_resolution_time,
DROP COLUMN IF EXISTS total_experience_points,
DROP COLUMN IF EXISTS achievements_count;

-- conversation_sessions テーブル
ALTER TABLE conversation_sessions
DROP COLUMN IF EXISTS error_count,
DROP COLUMN IF EXISTS auto_fix_count,
DROP COLUMN IF EXISTS last_error_type;
```

---

## 🔧 機能無効化（最速復旧）

### .env.local 編集

```bash
# 新機能を無効化
AUTO_FIX_ENABLED=false
GAMIFICATION_ENABLED=false
ERROR_TRACKING_ENABLED=false
```

---

## 🗂️ 新規ファイル削除

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator

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

---

## ✅ 復元後の確認チェックリスト

```bash
# 1. ビルド確認
npm run build

# 2. 型チェック
npm run type-check

# 3. リント
npm run lint

# 4. ローカルテスト
npm run dev
```

---

## 📞 サポート連絡先

### 問題が解決しない場合

1. **このファイルの手順を全て試す**
2. **バックアップディレクトリを確認**
   - `backup_20251017_error_recovery/`
3. **Git履歴を確認**
   - `git reflog`
4. **詳細ログを確認**
   - `CHANGE_LOG_ERROR_RECOVERY_SYSTEM.md`
   - `DATABASE_SCHEMA_BACKUP.sql`

---

## 🎯 トラブルシューティング

### ビルドエラー

```bash
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### 型エラー

```bash
cp backup_20251017_error_recovery/tsconfig.json ./
npm run type-check
```

### 環境変数エラー

```bash
cp backup_20251017_error_recovery/.env.local ./
```

### データベースエラー

```bash
# 接続確認
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -c "SELECT NOW()"
```

---

## 📋 バックアップ内容

### 場所
- `/mnt/c/Users/ooxmi/Downloads/gas-generator/backup_20251017_error_recovery/`

### 含まれるもの
- ✅ app/ ディレクトリ全体
- ✅ lib/ ディレクトリ全体
- ✅ package.json
- ✅ tsconfig.json
- ✅ .env.local
- ✅ Git履歴
- ✅ データベーススキーマ

---

## 🚀 復元成功後のステップ

1. ✅ アプリが起動する
2. ✅ Webhookが応答する
3. ✅ コード生成が動く
4. ✅ エラーログ正常
5. ✅ ユーザーテスト実施
6. ✅ デプロイ

---

作成日: 2025-10-17
最終更新: 2025-10-17
