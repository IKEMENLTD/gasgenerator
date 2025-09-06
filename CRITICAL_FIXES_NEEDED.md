# 🚨 緊急修正が必要な問題リスト

## 1. データベース関連 (最優先)

### ❌ QueueManagerが存在しない
- `/app/api/webhook/route.ts:360` で `QueueManager.addJob()` を呼んでいるが実装なし
- `/lib/queue/manager.ts` の実装が不完全

### ❌ MetricsQueriesが存在しない  
- `/app/api/webhook/route.ts:28-33` で使用されているが実装なし

## 2. セッション管理の問題

### ❌ セッション更新の競合状態
- 複数のメッセージが同時に来た場合、セッション状態が壊れる
- ロック機構なし

### ❌ セッションリセットロジックのバグ
- 無限ループの可能性あり
- Step 1で止まる原因

## 3. LINE API関連

### ❌ Flexメッセージのエラー
- `/lib/line/flex-templates.ts` で型定義が不完全
- 画像URLがプレースホルダー（実際の画像必要）

### ❌ エラーメッセージの送信失敗
- エラー時のreplyMessageが適切に処理されていない

## 4. Stripe連携

### ❌ Webhook署名検証なし
- `/app/api/stripe/webhook/route.ts` でセキュリティ脆弱性
- なりすましリクエストを防げない

### ❌ エラーハンドリング不足
- Stripe APIエラー時の処理なし

## 5. 使用制限チェック

### ❌ incrementUsageCount のタイミング問題
- カテゴリ選択前に実行される
- 実際の利用と関係なくカウントアップ

### ❌ monthly_usage_countカラムが存在しない可能性
- DBマイグレーションが実行されていない

## 6. 環境変数

### ❌ 必須環境変数のチェックなし
```
- ANTHROPIC_API_KEY
- LINE_CHANNEL_ACCESS_TOKEN  
- LINE_CHANNEL_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
```

## 7. メモリリーク

### ❌ recentEventCacheが無限に増える
- `/lib/line/webhook-validator.ts` でキャッシュクリアなし
- Edge Runtimeでメモリ枯渇の危険

## 8. 非同期処理のバグ

### ❌ awaitの欠落
- 複数箇所でPromiseがawaitされていない
- データ不整合の原因

## 9. エラーレスポンス

### ❌ LINE再送攻撃
- エラー時に200以外を返すとLINEが再送
- 無限ループの危険性

## 10. ログ出力

### ❌ 機密情報のログ出力
- API keyやtokenがログに出力される可能性
- セキュリティリスク

---

## 今すぐ修正すべきTOP 5：

1. **QueueManager実装** - コード生成が動かない
2. **セッション管理修正** - 会話が進まない  
3. **使用制限チェック位置** - 無料制限が機能しない
4. **Stripe署名検証** - セキュリティホール
5. **キャッシュクリア** - メモリリーク

これらを修正しないと、システムは正常に動作しません。