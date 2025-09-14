# Supabase マイグレーション実行手順

## 📋 Phase 1 完了内容

### ✅ 実装済み
1. **データベーススキーマ作成**
   - `supabase/migrations/20250113_conversation_history.sql`
   - 会話履歴、コンテキスト、チェックポイント、リビジョン管理テーブル

2. **SupabaseSessionStore クラス**
   - `lib/conversation/supabase-session-store.ts`
   - 完全な会話履歴の永続化
   - セッション復旧機能

3. **webhook/route.ts の更新**
   - Supabase からの会話履歴取得
   - メッセージの自動保存
   - コンテキストの同期

---

## 🚀 実行手順

### 1. Supabase データベースにマイグレーションを適用

#### オプション A: Supabase Dashboard から実行
1. https://app.supabase.com でプロジェクトを開く
2. SQL Editor に移動
3. `supabase/migrations/20250113_conversation_history.sql` の内容をコピー＆ペースト
4. "Run" をクリック

#### オプション B: Supabase CLI から実行
```bash
# Supabase CLI をインストール（未インストールの場合）
npm install -g supabase

# プロジェクトディレクトリで実行
cd /mnt/c/Users/ooxmi/Downloads/gas-generator

# Supabase にログイン
npx supabase login

# マイグレーションを適用
npx supabase db push
```

### 2. 環境変数の確認

`.env.local` に以下が設定されているか確認：
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. 依存関係のインストール

```bash
npm install @supabase/supabase-js
```

### 4. ローカルテスト

```bash
# ビルド確認
npm run build

# ローカル実行
npm run dev

# 別ターミナルでテスト
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "type": "message",
      "message": {"type": "text", "text": "テストメッセージ"},
      "source": {"userId": "test_user_123"},
      "replyToken": "test_token",
      "timestamp": 1234567890
    }]
  }'
```

### 5. デプロイ

```bash
# GitHub にプッシュ
git add -A
git commit -m "feat: Implement Supabase conversation persistence - Phase 1

- Add database schema for conversation history
- Create SupabaseSessionStore for persistent sessions
- Update webhook to use Supabase for all conversations
- Add session recovery and checkpoint features"

git push origin main
```

---

## 🔍 動作確認

### Supabase Dashboard で確認
1. Table Editor を開く
2. 以下のテーブルを確認：
   - `conversations` - メッセージ履歴
   - `conversation_contexts` - セッション情報
   - `session_checkpoints` - チェックポイント
   - `code_revisions` - コード履歴

### SQL クエリで確認
```sql
-- 最新の会話を確認
SELECT * FROM conversations 
ORDER BY created_at DESC 
LIMIT 10;

-- アクティブなセッション確認
SELECT * FROM conversation_contexts 
WHERE expires_at > NOW();

-- ユーザーごとのメッセージ数
SELECT user_id, COUNT(*) as message_count 
FROM conversations 
GROUP BY user_id;
```

---

## ⚠️ トラブルシューティング

### エラー: "Supabase環境変数が設定されていません"
```bash
# .env.local を確認
cat .env.local | grep SUPABASE

# 環境変数を再読み込み
source .env.local
```

### エラー: "relation does not exist"
```sql
-- テーブルが作成されているか確認
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- マイグレーションを再実行
-- SQL Editor で 20250113_conversation_history.sql を実行
```

### エラー: RLS ポリシー関連
```sql
-- RLS を一時的に無効化（テスト用）
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_contexts DISABLE ROW LEVEL SECURITY;
```

---

## 📊 効果測定

### Before (メモリのみ)
- ❌ サーバー再起動で会話消失
- ❌ 単一メッセージのみ処理
- ❌ プロセス間でセッション共有不可

### After (Supabase)
- ✅ 会話履歴の永続化
- ✅ 過去30通のメッセージを考慮
- ✅ クラッシュ後も会話継続
- ✅ 複数プロセス間で共有

---

## 🎯 次のステップ

Phase 2 以降の実装：
1. LINE会話履歴API の実装
2. AI要件抽出の強化
3. 修正履歴管理の完全実装

準備ができたら "Phase 2 を開始" とお知らせください。