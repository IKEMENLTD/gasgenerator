# データベースクエリ集

## 📁 ファイル一覧

### 1. `get_users_with_messages_jst.sql`
**用途**: ユーザー一覧とメッセージ内容の取得（日本時間表示）

**主な機能**:
- 直近30人のユーザー情報
- 最後のメッセージ内容
- プレミアムステータス
- 日本時間（JST）での表示
- プレミアム設定手順

**使い方**:
```bash
# Supabase SQL Editorで実行
```

---

### 2. `check_real_data.sql`
**用途**: システムの稼働状況確認とデバッグ

**主な機能**:
- 現在時刻とタイムゾーン確認
- 最新のセッション状況
- 日付別アクティビティ
- システムの健全性チェック
- 9月全データの確認

**使い方**:
```bash
# データが入っているか確認したいときに実行
```

---

## 🎯 クイックスタート

### ユーザー一覧を見る
```sql
-- get_users_with_messages_jst.sql の一番上のクエリをコピペ
```

### プレミアムに設定する
1. `get_users_with_messages_jst.sql` でユーザーの `line_user_id` を確認
2. 同ファイル内の「プレミアム設定手順」のクエリを実行
3. `line_user_id` を実際のIDに置き換えて実行

### データが入っているか確認
```sql
-- check_real_data.sql を実行
-- 「システムの健全性」セクションで状態を確認
```

---

## 💡 よくある質問

### Q: 日本時間で表示するには？
A: `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo'` を使用

### Q: 最新のメッセージが表示されない
A: `messages IS NOT NULL` の条件を確認。セッションはあってもメッセージがNULLの場合がある

### Q: 9/30のデータが無い
A: 実際にユーザーがBotを使っていない可能性が高い。`check_real_data.sql` で確認

---

## 🔧 トラブルシューティング

### エラー: `column does not exist`
- `user_id` と `line_user_id` の違いを確認
- `user_id::text` で型キャストが必要

### タイムゾーンがおかしい
- データベースはUTC保存
- 日本時間表示には必ず `AT TIME ZONE` 変換が必要

---

## 📚 参考情報

### テーブル構造
```
users
├─ id (UUID) - 主キー
├─ line_user_id (TEXT) - LINE User ID
├─ display_name (TEXT)
├─ is_premium (BOOLEAN)
└─ last_active_at (TIMESTAMP)

conversation_sessions
├─ id (UUID)
├─ user_id (UUID) - users.id への外部キー
├─ messages (JSONB)
└─ updated_at (TIMESTAMP)
```

### 結合方法
```sql
-- user_idを text にキャストして line_user_id と結合
cs.user_id::text = u.line_user_id
```

---

## 📝 更新履歴

- 2025-09-30: 初版作成
  - ユーザー一覧クエリ
  - システム状態確認クエリ
  - 日本時間対応