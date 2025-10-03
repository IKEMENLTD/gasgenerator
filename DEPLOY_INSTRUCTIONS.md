# 🚀 デプロイ手順

## 修正内容
1. ✅ RLSポリシー修正（Supabase）
2. ✅ `messages`テーブル削除エラー修正（コード）
3. ⏳ `user_id` UNIQUE制約追加（Supabase - 確認中）

## デプロイ手順

### 1. Gitにコミット
```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator
git add lib/conversation/supabase-session-store.ts
git commit -m "Fix messages table error and RLS policy"
git push origin main
```

### 2. Render.comで自動デプロイ
- Render.com Dashboardを開く
- `gas-generator`サービスを選択
- 自動デプロイが開始される（GitHubと連携済みの場合）
- または、**Manual Deploy** → **Deploy latest commit** をクリック

### 3. デプロイ完了を待つ（約5分）

### 4. 動作確認
LINE Botにメッセージを送信して確認:
```
スプレッドシート操作
```

### 5. データベース確認
Supabase SQL Editorで実行:
```sql
SELECT
  (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  user_id,
  status
FROM conversation_sessions
ORDER BY updated_at DESC
LIMIT 5;
```

**最新の日時が現在時刻に近ければ成功！**

---

## 残りの修正（優先順位順）

### 1. user_id UNIQUE制約追加
`database_queries/add_unique_constraint.sql`のステップ1を実行して重複確認。

### 2. Claude API 503エラー
ログに頻発している`HTTP 503`エラーを調査。
- Anthropic APIキーが正しいか確認
- タイムアウト設定を調整

### 3. メモリリーク
ヒープ使用率92-94%が継続。
- セッションオブジェクトの解放漏れ
- グローバル変数の蓄積

---

## トラブルシューティング

### デプロイが失敗する場合
```bash
# ビルドエラーを確認
npm run build
```

### 環境変数が反映されない場合
Render.com → Environment → 各変数を確認

### まだエラーが出る場合
Render.com → Logs で最新のエラーログを確認