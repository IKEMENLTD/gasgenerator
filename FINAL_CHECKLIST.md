# 🔍 最終動作確認チェックリスト

## 1. 環境変数の確認（Renderで設定済みか？）

### 必須環境変数：
```bash
# ❓ LINE関連
LINE_CHANNEL_ACCESS_TOKEN  # 設定済み？
LINE_CHANNEL_SECRET         # 32文字？

# ❓ Supabase関連  
NEXT_PUBLIC_SUPABASE_URL   # https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY  # eyJxxxxx...

# ❓ Claude AI関連
ANTHROPIC_API_KEY          # sk-ant-api03-xxxxx

# ❓ Stripe関連
STRIPE_SECRET_KEY          # sk_live_xxxxx
STRIPE_WEBHOOK_SECRET      # whsec_xxxxx

# ❓ Cron認証
CRON_SECRET               # gsg_cron_2024_xKm9Lp3QrN7vB2Hs
```

## 2. 動作確認テスト

### A. 基本疎通確認
```bash
# APIヘルスチェック
curl https://gasgenerator.onrender.com/api/webhook
# 期待値: {"status":"OK","service":"GAS Generator Webhook"}
```

### B. LINE Webhook確認
1. LINE Developers Console → Messaging API
2. Webhook URL: `https://gasgenerator.onrender.com/api/webhook`
3. 「Verify」ボタンをクリック
4. ✅ Success になるか？

### C. 会話フローテスト
1. LINEで「こんにちは」送信
2. 以下が表示されるか確認：
   - ウェルカムメッセージ
   - 決済ボタン（¥10,000/月）
   - カテゴリ選択

### D. コード生成テスト
1. カテゴリ選択：「スプレッドシート」
2. サブカテゴリ選択：任意
3. 詳細入力：「売上データを月別に集計したい」
4. 「処理中です」表示後、1-2分待つ
5. コードが返ってくるか？

### E. Cronジョブ動作確認
```bash
# 手動実行テスト
curl -H "Authorization: Bearer gsg_cron_2024_xKm9Lp3QrN7vB2Hs" \
  https://gasgenerator.onrender.com/api/cron/process-queue

# 期待値: {"success":true,"message":"Queue processing completed"}
```

### F. データベース動作確認
```sql
-- ユーザーが作成されているか
SELECT * FROM users ORDER BY created_at DESC LIMIT 5;

-- セッションが作成されているか  
SELECT * FROM conversation_sessions ORDER BY created_at DESC LIMIT 5;

-- キューにジョブが入っているか
SELECT * FROM generation_queue ORDER BY created_at DESC LIMIT 5;
```

## 3. よくある問題と解決策

### ❌ 問題: LINEメッセージに反応しない
**原因**: Webhook URLが正しく設定されていない
**解決**: 
1. LINE Developers ConsoleでWebhook URL確認
2. Use webhookがONになっているか確認

### ❌ 問題: 「処理中です」のまま何も返ってこない
**原因**: Cronジョブが動いていない
**解決**:
1. Renderでcronジョブ設定確認
2. ANTHROPIC_API_KEYが正しいか確認

### ❌ 問題: エラーメッセージが返る
**原因**: 環境変数が不足
**解決**: Renderのログを確認
```bash
# Renderのログで以下を探す
Missing required environment variable: XXX
```

### ❌ 問題: 決済後もpremiumにならない
**原因**: Stripe Webhook設定ミス
**解決**:
1. Stripe DashboardでWebhook設定確認
2. STRIPE_WEBHOOK_SECRET確認

## 4. 完全動作の確認項目

### ユーザージャーニー全体：
- [ ] LINE友達追加 → ウェルカムメッセージ表示
- [ ] カテゴリ選択 → サブカテゴリ表示
- [ ] 詳細入力 → 処理中メッセージ
- [ ] 1-2分待機 → GASコード受信
- [ ] 10回利用 → 制限メッセージ表示
- [ ] 決済リンク → Stripe決済画面
- [ ] 決済完了 → premium状態で無制限利用

### システム側：
- [ ] generation_queueにジョブ作成
- [ ] cronジョブでstatus: pending → processing → completed
- [ ] claude_usageに使用量記録
- [ ] generated_codesにコード保存
- [ ] LINEにコード送信

## 5. 本番稼働判定

### 🟢 GO判定基準：
1. 全環境変数設定済み
2. LINE Webhook検証成功
3. エンドツーエンドテスト成功
4. Cronジョブ動作確認
5. エラーログなし

### 🔴 NO-GO判定基準：
1. 環境変数不足
2. APIキーエラー
3. データベース接続エラー
4. コード生成失敗
5. 決済連携失敗

---

## まとめ

**データベース**: ✅ 完璧
**コード**: ✅ 実装完了
**残り作業**: 
1. 環境変数確認
2. Cronジョブ設定
3. 動作テスト

**推定稼働可能時間**: 環境変数設定後、即座に稼働可能