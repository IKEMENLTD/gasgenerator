# デプロイチェックリスト

## 🔴 デプロイ前確認
- [ ] Render環境変数追加完了
  - [ ] STRIPE_PAYMENT_LINK
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Supabaseマイグレーション実行完了
- [ ] Stripe Webhookエンドポイント設定完了

## 🟡 デプロイ直後確認（5分以内）
- [ ] https://gasgenerator.onrender.com にアクセス可能
- [ ] /api/health エンドポイント確認
- [ ] メモリ使用量が50%以下
- [ ] エラーログ確認（502エラーなし）

## 🔵 機能テスト（30分以内）
### LINE Bot基本機能
- [ ] 友達追加 → 決済ボタン表示
- [ ] カテゴリ選択 → サブカテゴリ表示
- [ ] 要件入力 → コード生成

### 決済機能
- [ ] Stripeリンクにclient_reference_id付与確認
- [ ] テストカード決済（4242 4242 4242 4242）
- [ ] 決済完了 → LINEメッセージ受信
- [ ] usersテーブルのsubscription_status='premium'確認

### エラーチェック
- [ ] UUIDエラーなし
- [ ] メモリリークなし
- [ ] 502エラーなし

## 📊 監視項目（最初の24時間）
### メモリ使用量
```
目標: 50%以下
警告: 70%超過
危険: 90%超過
```

### レスポンスタイム
```
良好: 1秒以内
許容: 3秒以内
問題: 5秒以上
```

### エラー率
```
正常: 1%未満
注意: 5%未満
異常: 5%以上
```

## 🚨 緊急時対応
### 502エラー頻発時
1. Renderダッシュボードでメモリ確認
2. 必要に応じてインスタンス再起動
3. SessionStore MAX_SESSIONS を25に削減

### 決済が動作しない時
1. Stripe Webhookログ確認
2. STRIPE_WEBHOOK_SECRET確認
3. Supabase usersテーブル確認

### UUIDエラー発生時
1. URGENT_MIGRATION.sql再実行
2. generation_queueテーブル確認
3. 外部キー制約確認

## 📝 必要なURL
- Render: https://dashboard.render.com
- Supabase: https://app.supabase.com/project/ebtcowcgkdurqdqcjrxy
- Stripe: https://dashboard.stripe.com
- LINE Developers: https://developers.line.biz/console/