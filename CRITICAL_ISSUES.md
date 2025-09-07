# 🚨 辛口最終チェック - 致命的な問題

## 1. APIキー漏洩（最優先）
**現状**: .env.localに本番APIキーが直書き
**リスク**: GitHub公開で即悪用される
**対策**:
```bash
# 1. 現在のキーを即座に無効化
- LINE Developers Console → チャネルアクセストークン再発行
- Anthropic Console → APIキー削除・再発行
- Supabase → Service Roleキー再生成

# 2. 環境変数を.env.localから削除
cp .env.local .env.backup
echo "# Use environment variables from hosting service" > .env.local

# 3. Renderの環境変数に設定
```

## 2. Stripe決済未実装
**現状**: ダミーキーで動作しない
**影響**: 課金できない = 収益ゼロ
**対策**:
1. Stripe本番キー取得
2. Webhook実装テスト
3. client_reference_id連携確認

## 3. DBマイグレーション未実行
**必要なテーブル**:
- vision_usage（画像解析履歴）
- users（LINE_USER_IDをTEXT型に）

**実行コマンド**:
```bash
npx supabase migration up
```

## 4. メモリリーク残存
**問題箇所**:
- `/lib/conversation/session-store.ts` - destroy()未使用
- グローバルタイマーの未クリーンアップ

**修正案**:
```typescript
// app/api/webhook/route.ts
process.on('SIGTERM', () => {
  sessionStore.destroy()
})
```

## 5. エラーハンドリング不足

### Claude API障害時
```typescript
// フォールバック応答を用意
if (claudeError) {
  return "申し訳ございません。現在AIサービスに接続できません。"
}
```

### レート制限対策
```typescript
// 429エラー時のリトライ
if (response.status === 429) {
  await sleep(60000) // 1分待機
  return retry()
}
```

## 6. 本番デプロイ前チェックリスト

- [ ] APIキー全て再発行済み
- [ ] .gitignoreに.env.local追加済み
- [ ] Stripe本番環境設定済み
- [ ] DBマイグレーション実行済み
- [ ] メモリ監視設定済み
- [ ] エラー通知設定済み
- [ ] バックアップ設定済み
- [ ] SSL証明書確認済み
- [ ] CORS設定確認済み
- [ ] レート制限設定済み

## 7. 監視すべきメトリクス

| 項目 | 閾値 | アラート |
|-----|------|---------|
| メモリ使用率 | 80% | Slack通知 |
| Vision API使用数 | 400回/月 | メール通知 |
| エラー率 | 1% | 即時対応 |
| 応答時間 | 3秒 | 調査開始 |

## 8. 緊急時の対応

### サービス停止手順
1. Renderのサービス停止
2. LINE Webhook URL削除
3. ユーザーへの告知

### データ復旧
1. Supabaseバックアップから復元
2. 最新のコミットからコード復旧
3. 環境変数の再設定

**これらを解決しないと本番運用は危険！**