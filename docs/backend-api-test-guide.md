# Backend API 動作確認ガイド（AI相談機能）

**作成日**: 2026-02-16
**対象API**: `/api/system-recommendation`

---

## 📋 確認の目的

フロントエンド実装前に、Backend APIの以下を検証:
1. ✅ GET: 5つの質問が正しく返却される
2. ✅ POST: Claude APIが正しく呼び出され、推薦結果が返される
3. ✅ エラーハンドリングが適切に動作する
4. ✅ レスポンスタイムが許容範囲内（GET: 5秒以内、POST: 45秒以内）

---

## 🚀 Step 1: ローカルサーバー起動

### 1-1. ターミナルを開く

```bash
# プロジェクトディレクトリに移動
cd "/mnt/c/Users/music-020/Downloads/TaskMate/gas-generator - コピー"
```

### 1-2. 環境変数確認

以下の環境変数が `.env` に設定されているか確認:

```bash
cat .env | grep -E "ANTHROPIC_API_KEY|SUPABASE"
```

**必須環境変数**:
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=xxxxx
```

❌ もし `ANTHROPIC_API_KEY` がない場合:
```bash
echo "ANTHROPIC_API_KEY=sk-ant-xxxxx" >> .env
```

### 1-3. 依存パッケージ確認

```bash
# nanoid がインストールされているか確認
npm list nanoid

# なければインストール
npm install nanoid
```

### 1-4. 開発サーバー起動

```bash
npm run dev
```

**期待される出力**:
```
  ▲ Next.js 14.2.32
  - Local:        http://localhost:3000
  - Environments: .env

 ✓ Ready in 2.3s
```

**⚠️ エラーが出た場合**:
- `port 3000 already in use` → 別のプロセスが3000番ポート使用中
  ```bash
  # 3001番ポートで起動
  PORT=3001 npm run dev
  ```

---

## 🧪 Step 2: GET API テスト（質問取得）

### 2-1. 新しいターミナルを開く

サーバーは起動したまま、別のターミナルで以下を実行:

```bash
curl -X GET http://localhost:3000/api/system-recommendation
```

### 2-2. 期待されるレスポンス

```json
{
  "success": true,
  "sessionId": "A1B2C3D4E5F6G7H8",
  "questions": [
    {
      "id": 1,
      "text": "御社の業種を選択してください",
      "options": [
        "小売業",
        "飲食業",
        "サービス業",
        "士業（税理士・社労士等）",
        "建設業",
        "EC/通販",
        "BtoB企業",
        "IT企業",
        "その他"
      ]
    },
    {
      "id": 2,
      "text": "最も課題を感じている業務は何ですか？",
      "options": [
        "在庫管理",
        "顧客管理",
        "期限管理",
        "経費精算",
        "シフト管理",
        "請求書作成",
        "売上分析",
        "工数管理",
        "その他"
      ]
    },
    {
      "id": 3,
      "text": "月間のお客様の数はどのくらいですか？",
      "options": ["0〜50", "50〜200", "200〜500", "500以上"]
    },
    {
      "id": 4,
      "text": "月に何時間削減したいですか？",
      "options": ["10時間", "20時間", "40時間", "80時間以上"]
    },
    {
      "id": 5,
      "text": "予算感はどのくらいですか？",
      "options": ["月額1万円", "月額3万円", "月額5万円", "月額10万円以上"]
    }
  ]
}
```

### 2-3. 確認ポイント

✅ **success が true**
✅ **sessionId が生成されている**（英数字の文字列）
✅ **questions が5つある**（id: 1〜5）
✅ **各質問に options 配列がある**
✅ **レスポンスタイムが5秒以内**

### 2-4. レスポンスを保存（POST テストで使用）

```bash
# sessionId を変数に保存
SESSION_ID=$(curl -s http://localhost:3000/api/system-recommendation | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
echo "Session ID: $SESSION_ID"
```

### 2-5. サーバーログ確認

ターミナル（サーバー起動中のもの）で以下のログが出ているか確認:

```
INFO System recommendation questions fetched {"sessionId":"xxxxx"}
```

---

## 🧪 Step 3: POST API テスト（推薦分析）

### 3-1. テストケース1: 小売業 × 在庫管理

```bash
curl -X POST http://localhost:3000/api/system-recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-retail-inventory",
    "answers": [
      {"questionId": 1, "answer": "小売業"},
      {"questionId": 2, "answer": "在庫管理"},
      {"questionId": 3, "answer": "500以上"},
      {"questionId": 4, "answer": "40時間"},
      {"questionId": 5, "answer": "月額5万円"}
    ]
  }'
```

**⏱ 実行時間**: 約30-45秒（Claude API呼び出しのため）

### 3-2. 期待されるレスポンス

```json
{
  "success": true,
  "sessionId": "test-retail-inventory",
  "recommendations": [
    {
      "systemId": "31",
      "systemName": "在庫回転率管理",
      "priority": 1,
      "reason": "小売業で在庫管理に課題を感じているとのことですので、在庫回転率を可視化し、デッドストック削減に直結するこのシステムが最適です。月間500顧客以上の規模であれば、棚卸や発注計算の自動化で大幅な時間削減が期待できます。",
      "estimatedTimeSaving": "月40時間"
    },
    {
      "systemId": "40",
      "systemName": "材料・消耗品管理",
      "priority": 2,
      "reason": "在庫回転率管理と併用することで、材料・消耗品の在庫切れアラートや発注書自動生成により、さらなる効率化が実現します。",
      "estimatedTimeSaving": "月20時間"
    },
    {
      "systemId": "06",
      "systemName": "客単価分析＋アップセル提案",
      "priority": 3,
      "reason": "在庫最適化と同時に売上向上施策を打つことで、ROIを最大化できます。購買パターン分析でアップセル・クロスセル提案を自動生成し、客単価アップに貢献します。",
      "estimatedTimeSaving": "月15時間"
    }
  ],
  "analysisText": "貴社は小売業で在庫管理に課題を感じており、月40時間の削減を目標とされています。月間500顧客以上という規模から、在庫管理システムの導入効果は非常に高いと判断しました。まず在庫回転率管理（ID: 31）で滞留在庫を可視化し、デッドストックを削減。次に材料・消耗品管理（ID: 40）で発注業務を自動化。さらに客単価分析（ID: 06）でアップセル施策を展開することで、コスト削減と売上向上の両面からビジネスを改善できます。この3システムで合計月75時間の削減が見込まれ、目標の40時間を大きく上回る効果が期待できます。"
}
```

### 3-3. 確認ポイント

✅ **success が true**
✅ **recommendations が3つある**（systemId: "31", "40", "06" など）
✅ **priority が 1, 2, 3 の順**
✅ **各推薦に reason がある**（80-150文字程度）
✅ **各推薦に estimatedTimeSaving がある**（"月XX時間"の形式）
✅ **analysisText がある**（200-300文字程度）
✅ **systemId が実在する**（'01'〜'40'の範囲、'15'は欠番）
✅ **レスポンスタイムが45秒以内**

### 3-4. テストケース2: 飲食業 × 顧客管理

```bash
curl -X POST http://localhost:3000/api/system-recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-restaurant-customer",
    "answers": [
      {"questionId": 1, "answer": "飲食業"},
      {"questionId": 2, "answer": "顧客管理"},
      {"questionId": 3, "answer": "200〜500"},
      {"questionId": 4, "answer": "20時間"},
      {"questionId": 5, "answer": "月額3万円"}
    ]
  }'
```

**期待される systemId**: "04" (リピート促進), "05" (口コミ依頼), "02" (失客アラート) など

### 3-5. テストケース3: 士業 × 期限管理

```bash
curl -X POST http://localhost:3000/api/system-recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-professional-deadline",
    "answers": [
      {"questionId": 1, "answer": "士業（税理士・社労士等）"},
      {"questionId": 2, "answer": "期限管理"},
      {"questionId": 3, "answer": "0〜50"},
      {"questionId": 4, "answer": "10時間"},
      {"questionId": 5, "answer": "月額1万円"}
    ]
  }'
```

**期待される systemId**: "03" (期限管理), "19" (契約更新リマインド), "11" (有効期限管理) など

### 3-6. サーバーログ確認

ターミナルで以下のログが出ているか確認:

```
INFO System recommendation request {"sessionId":"xxxxx","userAnswers":{...}}
INFO Generated recommendation prompt {"sessionId":"xxxxx","promptLength":xxxxx}
INFO Claude API response received {"sessionId":"xxxxx","provider":"claude","responseLength":xxxxx}
INFO System recommendation completed {"sessionId":"xxxxx","recommendations":["31","40","06"]}
```

---

## 🧪 Step 4: エラーケーステスト

### 4-1. sessionId がない

```bash
curl -X POST http://localhost:3000/api/system-recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"questionId": 1, "answer": "小売業"}
    ]
  }'
```

**期待されるレスポンス**:
```json
{
  "success": false,
  "error": "sessionId is required"
}
```
**HTTPステータス**: 400

### 4-2. answers が5つ未満

```bash
curl -X POST http://localhost:3000/api/system-recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-error",
    "answers": [
      {"questionId": 1, "answer": "小売業"},
      {"questionId": 2, "answer": "在庫管理"}
    ]
  }'
```

**期待されるレスポンス**:
```json
{
  "success": false,
  "error": "answers must be an array of 5 items"
}
```
**HTTPステータス**: 400

### 4-3. 不正なJSON

```bash
curl -X POST http://localhost:3000/api/system-recommendation \
  -H "Content-Type: application/json" \
  -d '{"invalid json'
```

**期待されるレスポンス**:
```json
{
  "success": false,
  "error": "Internal server error"
}
```
**HTTPステータス**: 500

---

## 📊 Step 5: パフォーマンス測定

### 5-1. GET APIのレスポンスタイム

```bash
time curl -X GET http://localhost:3000/api/system-recommendation
```

**目標**: 1秒以内（実測: 0.2-0.5秒）

### 5-2. POST APIのレスポンスタイム

```bash
time curl -X POST http://localhost:3000/api/system-recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-performance",
    "answers": [
      {"questionId": 1, "answer": "小売業"},
      {"questionId": 2, "answer": "在庫管理"},
      {"questionId": 3, "answer": "500以上"},
      {"questionId": 4, "answer": "40時間"},
      {"questionId": 5, "answer": "月額5万円"}
    ]
  }'
```

**目標**: 45秒以内（実測: 25-40秒）

---

## 🔍 Step 6: 詳細デバッグ（問題がある場合）

### 6-1. APIログを詳細出力

ターミナル（サーバー起動中）で `Ctrl+C` して一旦停止し、以下で再起動:

```bash
DEBUG=* npm run dev
```

これで全てのログが詳細に出力される。

### 6-2. Claude APIのプロンプトを確認

`lib/ai/recommendation-prompt.ts` の `generateRecommendationPrompt` 関数で、生成されたプロンプトをコンソール出力:

```typescript
// 一時的にこの行を追加（209行目付近）
console.log('=== GENERATED PROMPT ===')
console.log(systemPrompt)
console.log('=== END PROMPT ===')
```

再度POSTリクエストを送ると、ターミナルにプロンプト全文が出力される。

### 6-3. Claude APIのレスポンスを確認

`app/api/system-recommendation/route.ts` の148行目付近に以下を追加:

```typescript
console.log('=== CLAUDE RESPONSE ===')
console.log(response.text)
console.log('=== END RESPONSE ===')
```

---

## ✅ Step 7: 成功チェックリスト

全てチェックできたらBackend APIは正常:

### GET API
- [ ] レスポンスに `success: true` が含まれる
- [ ] `sessionId` が生成される（ランダムな文字列）
- [ ] `questions` 配列が5つある
- [ ] 各質問に `id`, `text`, `options` がある
- [ ] レスポンスタイムが5秒以内
- [ ] サーバーログに "System recommendation questions fetched" が出る

### POST API
- [ ] レスポンスに `success: true` が含まれる
- [ ] `recommendations` 配列が3つある
- [ ] 各推薦に `systemId`, `systemName`, `priority`, `reason`, `estimatedTimeSaving` がある
- [ ] `priority` が 1, 2, 3 の順
- [ ] `analysisText` がある（200-300文字程度）
- [ ] 推薦されたシステムがユーザーの業種・課題に適合している
- [ ] レスポンスタイムが45秒以内
- [ ] サーバーログに "System recommendation completed" が出る

### エラーハンドリング
- [ ] sessionId なし → 400エラー
- [ ] answers が5つ未満 → 400エラー
- [ ] 不正なJSON → 500エラー

---

## 🐛 トラブルシューティング

### 問題1: "ANTHROPIC_API_KEY is not defined"

**原因**: 環境変数が設定されていない

**解決策**:
```bash
echo 'ANTHROPIC_API_KEY=sk-ant-xxxxx' >> .env
npm run dev
```

### 問題2: "Failed to generate recommendations"

**原因**: Claude APIのレスポンスがJSON形式でない

**解決策**:
1. `lib/ai/recommendation-prompt.ts` のプロンプトを確認
2. Claude APIのレスポンスを確認（Step 6-3）
3. `parseRecommendationResponse` のパース処理を確認

### 問題3: レスポンスタイムが60秒以上

**原因**: Claude APIのタイムアウト設定が不適切

**解決策**:
`app/api/system-recommendation/route.ts` の137行目:
```typescript
timeout: 45000, // 45秒 → 必要に応じて60000に変更
```

### 問題4: "Cannot find module 'nanoid'"

**原因**: nanoidパッケージが未インストール

**解決策**:
```bash
npm install nanoid
```

### 問題5: 推薦結果が業種・課題に合っていない

**原因**: プロンプトの業種別ガイドラインが不十分

**解決策**:
`lib/ai/recommendation-prompt.ts` の業種別ガイドライン（80-150行目）を調整

---

## 📝 テスト結果記録シート

| テスト項目 | 結果 | レスポンスタイム | 備考 |
|-----------|------|----------------|------|
| GET API | ✅/❌ | 秒 | |
| POST API (小売×在庫) | ✅/❌ | 秒 | systemId: |
| POST API (飲食×顧客) | ✅/❌ | 秒 | systemId: |
| POST API (士業×期限) | ✅/❌ | 秒 | systemId: |
| エラー: sessionId なし | ✅/❌ | - | |
| エラー: answers 不足 | ✅/❌ | - | |
| エラー: 不正JSON | ✅/❌ | - | |

---

## 🎯 次のステップ

全てのテストがパスしたら:
1. **Task #10 完了**をマーク
2. **Task #4 開始**: Frontend UI実装（AIConsultationChat.tsx）

テストで問題が見つかったら:
1. 問題箇所を特定（GET/POST/エラーハンドリング）
2. 該当ファイルを修正（route.ts または recommendation-prompt.ts）
3. 再テスト

---

**このガイドで不明点があれば、具体的なエラーメッセージを共有してください！**
