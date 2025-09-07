# 🧪 画像認識機能テストチェックリスト

## テスト前の確認
- [ ] vision_usageテーブルが作成済み
- [ ] Render環境変数がすべて設定済み
- [ ] デプロイが成功している

## テスト手順

### 1. 基本的な画像送信テスト
1. LINEボットに簡単な画像（スクリーンショットなど）を送信
2. 期待される応答:
   ```
   📸 画像を確認しました！
   
   [画像の内容説明]
   
   📊 本日の残り: X回
   
   この内容でコードを生成しますか？
   ```

### 2. エラーが出た場合の確認ポイント

#### Renderログで確認する内容:

**正常な場合のログ:**
```
=== IMAGE HANDLER START ===
envCheck: {
  hasLineToken: true,
  hasAnthropicKey: true,
  hasSupabaseUrl: true
}
Step 1: Downloading image from LINE
Step 1 completed: Image downloaded
```

**エラーの場合のログ:**
```
=== IMAGE HANDLER ERROR ===
error: {
  message: "具体的なエラーメッセージ",
  stack: "スタックトレース"
}
```

### 3. よくあるエラーと対処法

| エラーメッセージ | 原因 | 対処法 |
|----------------|------|--------|
| `Failed to download image: 401` | LINE_CHANNEL_ACCESS_TOKENが無効 | トークンを再発行 |
| `relation "vision_usage" does not exist` | テーブル未作成 | SQLを実行 |
| `ANTHROPIC_API_KEY is missing` | 環境変数未設定 | Renderで設定 |
| `Image too large` | 5MB超の画像 | 小さい画像でテスト |

### 4. 成功確認

- [ ] 画像の内容が正しく認識されている
- [ ] 残り回数が表示されている
- [ ] クイックリプライボタンが表示されている
- [ ] 「はい」を押すとコード生成が開始される

## デバッグ用SQL

Supabase SQL Editorで実行:

```sql
-- vision_usageテーブルの確認
SELECT * FROM vision_usage ORDER BY created_at DESC LIMIT 10;

-- ユーザーの確認
SELECT * FROM users WHERE line_user_id LIKE '%あなたのLINE_ID%';

-- エラーログの確認
SELECT * FROM claude_usage_logs WHERE success = false ORDER BY created_at DESC LIMIT 10;
```