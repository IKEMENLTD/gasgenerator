# 🎯 最終チェックリスト

## 必須タスク（これがないと動かない）

### 1. Supabase 設定
- [ ] Supabase Dashboard にログイン
- [ ] SQL Editor で `/supabase/migrations/20250114_add_missing_tables_FIXED.sql` を実行
- [ ] テーブルが作成されたか確認
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('conversations', 'session_checkpoints', 'code_revisions');
  ```

### 2. 環境変数設定
- [ ] Supabase Dashboard → Settings → API からキーを取得
- [ ] `.env.local` を更新
  ```
  NEXT_PUBLIC_SUPABASE_URL=実際のURL
  NEXT_PUBLIC_SUPABASE_ANON_KEY=実際のキー
  SUPABASE_SERVICE_ROLE_KEY=実際のキー
  ```
- [ ] Render.com の環境変数も同じように更新

### 3. デプロイ
- [ ] `git push origin main` でデプロイ
- [ ] Render.com でデプロイ完了を確認
- [ ] https://your-app.onrender.com/api/health でヘルスチェック

## 動作確認

### 基本機能テスト
- [ ] LINE BOT で「スプレッドシート操作」を送信
- [ ] 会話が Supabase に保存されるか確認
- [ ] 「最初から」でリセットできるか確認

### 新機能テスト
- [ ] 長いコード生成（複雑な要求）
- [ ] コードが1800文字で分割されるか確認
- [ ] コードブロック記法（```）で表示されるか

### 検証システムテスト
- [ ] わざと曖昧な要求を送る
- [ ] 検証ログを確認（validationScore）
- [ ] 自動修正が働くか確認

## 確認SQL

```sql
-- 会話履歴の確認
SELECT * FROM conversations 
ORDER BY created_at DESC 
LIMIT 10;

-- セッション状態の確認
SELECT user_id, session_id_text, ready_for_code, last_generated_code 
FROM conversation_sessions 
ORDER BY updated_at DESC;

-- 検証スコアの確認（ログから）
-- Render.com のログで "Code validation completed" を検索
```

## トラブルシューティング

### Supabase接続エラー
- 環境変数が正しく設定されているか確認
- Supabase のプロジェクトが一時停止していないか確認

### コードが送信されない
- Render.com のログを確認
- "Code validation failed" エラーを探す
- API制限に達していないか確認

### 分割がおかしい
- MessageFormatter.CHUNK_SIZE が 1800 になっているか確認
- コードブロックの ``` が正しく処理されているか

## パフォーマンス監視

### 処理時間
- 通常: 30-60秒
- 検証あり: 45-90秒
- 自動修正: 60-120秒

### API使用量
- 生成: 1回
- 検証: 1回
- 修正: 1回（必要時のみ）
- 合計: 最大3回/リクエスト

## 残課題

1. **コスト最適化**
   - 検証を簡易版にする？
   - キャッシュを活用？

2. **タイムアウト対策**
   - 非同期処理の改善
   - プログレス表示

3. **エラー回復**
   - 検証失敗時の代替フロー
   - 部分的な成功の処理

## 完了基準

✅ すべての必須タスクが完了
✅ 基本機能テストがパス
✅ 新機能テストがパス
✅ エラーログがない
✅ 処理時間が許容範囲内

---

これらすべてが確認できたら、本当に「完璧」と言えます。