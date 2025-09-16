# 🚨 重要: 本番環境での必須修正事項

## 1. **Claude APIモデル名の確認と修正**

現在の設定: `claude-sonnet-4-20250514`

### ⚠️ 注意事項
- このモデル名は**推測**です
- Anthropicの公式ドキュメントで正確なモデル名を確認してください
- 間違ったモデル名だとAPI呼び出しが全て失敗します

### 確認方法:
```javascript
// テストコード
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514', // このモデル名をテスト
    max_tokens: 100,
    messages: [{role: 'user', content: 'test'}]
  })
})

if (!response.ok) {
  const error = await response.json()
  console.error('モデル名エラー:', error)
  // エラーメッセージから正しいモデル名を確認
}
```

### 修正箇所:
- `/lib/constants/config.ts` の21行目
- `/lib/database/transaction.ts` の129行目
- `/lib/line/image-handler.ts` の357行目

---

## 2. **データベースマイグレーション実行**

### 必須実行SQL:
```sql
-- Supabase SQL Editorで実行
-- ファイル: /apply-migrations.sql
```

### 実行前チェック:
1. **バックアップを取る**
2. **既存データの確認**
   ```sql
   SELECT COUNT(*) FROM users WHERE display_name IS NOT NULL;
   ```
3. **重複チェック**
   ```sql
   SELECT display_name, COUNT(*)
   FROM users
   GROUP BY display_name
   HAVING COUNT(*) > 1;
   ```

---

## 3. **環境変数の確認**

必須環境変数:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
LINE_CHANNEL_SECRET=xxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
STRIPE_PAYMENT_LINK=https://buy.stripe.com/xxxxx
ENGINEER_SUPPORT_GROUP_ID=xxxxx
ENGINEER_USER_IDS=userid1,userid2
```

---

## 4. **トークン使用量の監視**

### 現在の設定:
- AI要件抽出: 2000トークン
- スマート質問: 300トークン
- コード生成: 32000トークン

### コスト計算:
```
1リクエストあたり:
- 入力: ~1000トークン × $0.003/1000 = $0.003
- 出力: ~2000トークン × $0.015/1000 = $0.030
- 合計: 約$0.033/リクエスト (約5円)
```

### 月間上限設定推奨:
```javascript
// lib/constants/config.ts に追加
export const COST_LIMITS = {
  DAILY_MAX_USD: 30,      // 1日$30まで
  MONTHLY_MAX_USD: 500,   // 月$500まで
  ALERT_THRESHOLD: 0.8    // 80%で警告
}
```

---

## 5. **エラー監視設定**

### 必須ログ監視:
1. **AI要件抽出失敗**
   ```
   logger.error('AI extraction failed, falling back to old method')
   ```
   → 頻発する場合はトークン数を調整

2. **Claude API失敗**
   ```
   logger.error('Claude API request failed')
   ```
   → モデル名またはAPIキーの問題

3. **メモリ不足**
   ```
   memoryStatus: 'critical'
   ```
   → Renderの再起動が必要

---

## 6. **本番テストチェックリスト**

### 基本動作確認:
- [ ] LINEで「グラフを作成したい」→ 要件抽出成功
- [ ] 要件確認メッセージが表示される（空白でない）
- [ ] コード生成が完了する
- [ ] プレミアム会員の決済日更新が動作

### エッジケース確認:
- [ ] 長い会話（20往復以上）でもエラーなし
- [ ] 日本語以外の入力でもクラッシュしない
- [ ] 同時アクセス10人でも安定動作

### パフォーマンス確認:
- [ ] 応答時間: 3秒以内
- [ ] メモリ使用量: 400MB以下
- [ ] CPU使用率: 80%以下

---

## 7. **ロールバック手順**

問題が発生した場合:

### Step 1: 機能を無効化
```javascript
// lib/conversation/conversational-flow.ts の277行目
// AIRequirementsExtractor を無効化
const USE_AI_EXTRACTION = false // 緊急停止フラグ

if (USE_AI_EXTRACTION) {
  // AI抽出
} else {
  // 旧方式
}
```

### Step 2: データベースロールバック
```sql
-- line_user_idカラムを削除しない（データ保持）
-- ビューのみ古いバージョンに戻す
DROP VIEW IF EXISTS user_generation_stats;
-- 古いビュー定義を再作成
```

### Step 3: 通知
- エンジニアチームに通知
- 影響ユーザー数を確認
- 原因調査開始

---

## 📞 緊急連絡先

- **Supabaseサポート**: support@supabase.io
- **Anthropicサポート**: support@anthropic.com
- **Renderサポート**: https://render.com/support

---

**最終更新**: 2024年1月（このドキュメントを常に最新に保つこと）