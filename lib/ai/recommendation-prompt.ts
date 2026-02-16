/**
 * AI相談機能 - システム推薦プロンプト生成
 *
 * ユーザーの業種・課題から最適な3システムを推薦するClaude APIプロンプト
 * 2026-02-16: 初版作成
 */

interface CompressedSystem {
  id: string
  name: string
  summary: string
  tags: string[]
  category: string
}

interface UserAnswers {
  industry: string        // 業種
  challenge: string       // 課題業務
  customerCount: string   // 月間顧客数
  timeSavingGoal: string  // 削減希望時間
  budget: string          // 予算感
}

interface RecommendationOutput {
  recommendations: Array<{
    systemId: string
    systemName: string
    priority: number
    reason: string
    estimatedTimeSaving: string
  }>
  analysisText: string
}

/**
 * システムIDからカテゴリを判定
 */
function getCategoryById(id: string): string {
  const idNum = parseInt(id)
  if ([1, 2, 4, 5, 6, 9, 10, 29].includes(idNum)) return '営業・顧客管理'
  if ([3, 7, 11, 19].includes(idNum)) return '期限・納期管理'
  if ([31, 40].includes(idNum)) return '在庫・発注'
  if ([13, 14, 32, 36].includes(idNum)) return '分析・レポート'
  if ([16, 17, 18, 22, 24, 25, 26, 27, 33, 37, 38].includes(idNum)) return 'バックオフィス'
  if ([20, 28].includes(idNum)) return 'コミュニケーション'
  if ([30, 34, 35].includes(idNum)) return '人事・組織管理'
  return 'その他ツール'
}

/**
 * 39システムを圧縮（元データから必要フィールドのみ抽出）
 */
function compressSystems(systems: any[]): CompressedSystem[] {
  return systems.map((s) => ({
    id: s.id,
    name: s.name,
    summary: s.tagline, // taglineをsummaryとして使用
    tags: s.tags.slice(0, 2), // 最初の2タグのみ
    category: getCategoryById(s.id),
  }))
}

/**
 * システム推薦プロンプト生成
 */
export function generateRecommendationPrompt(
  systems: any[],
  userAnswers: UserAnswers
): string {
  const compressedSystems = compressSystems(systems)

  const systemPrompt = `# タスク: ビジネス課題に最適な業務自動化システム推薦

あなたは中小企業の業務自動化コンサルタントです。ユーザーの業種・課題から、以下の39システムの中から最適な3つを推薦してください。

## 推薦基準（重要度順）

1. **業種適合度（40%）**: ユーザーの業種に最も効果的なシステムを優先
2. **課題解決度（30%）**: ユーザーの課題業務に直接的に貢献するシステム
3. **ROI（時間削減効果）（20%）**: 月間顧客数・削減希望時間から実現可能性を評価
4. **予算適合度（10%）**: 予算感とシステムの規模・複雑さが適合するか

## 利用可能なシステム（39システム）

\`\`\`json
${JSON.stringify(compressedSystems, null, 2)}
\`\`\`

## 業種別の推薦優先度ガイドライン

### 小売業
- 在庫管理課題 → ID: 31（在庫回転率管理）, 40（材料・消耗品管理）
- 顧客管理課題 → ID: 02（失客アラート）, 09（LTV計算）, 06（客単価分析）
- 売上分析課題 → ID: 32（時間帯別売上分析）, 36（季節変動予測）

### 飲食業
- 顧客リピート → ID: 04（リピート促進）, 05（口コミ依頼）, 02（失客アラート）
- シフト管理 → ID: 30（シフト希望収集）, 24（勤怠集計）
- 在庫管理 → ID: 40（材料・消耗品管理）, 31（在庫回転率）

### サービス業
- 予約管理 → ID: 21（ダブルブッキング防止）, 03（期限管理）
- 顧客管理 → ID: 02（失客アラート）, 04（リピート促進）, 09（LTV計算）
- シフト管理 → ID: 30（シフト希望収集）

### 士業（税理士・社労士等）
- 期限管理 → ID: 03（期限管理）, 19（契約更新リマインド）, 11（有効期限管理）
- 書類管理 → ID: 38（書類テンプレート）, 33（業務マニュアル）, 27（引継ぎチェックリスト）
- 顧客管理 → ID: 37（顧問契約管理）, 02（失客アラート）

### 建設業
- 納期管理 → ID: 07（納期アラート）, 03（期限管理）, 08（タスクチェックリスト）
- 案件管理 → ID: 39（案件別工数管理）, 22（価格表・見積基準管理）
- 勤怠管理 → ID: 24（勤怠集計→給与計算）

### EC/通販
- 在庫管理 → ID: 31（在庫回転率）, 40（材料・消耗品）, 36（季節変動予測）
- 価格最適化 → ID: 13（価格テストA/B管理）, 22（価格表・見積基準）
- 顧客管理 → ID: 06（客単価分析）, 09（LTV計算）, 10（離脱顧客）

### BtoB企業
- 請求管理 → ID: 17（請求書自動生成）, 26（入金消込チェッカー）, 19（契約更新）
- 経費精算 → ID: 16（経費精算ワークフロー）, 25（承認フロー強制）, 18（売上日報）
- 営業管理 → ID: 01（営業日報）, 02（失客アラート）

### IT企業
- 工数管理 → ID: 39（案件別工数管理）, 23（議事録→タスク抽出）
- 人事管理 → ID: 34（オンボーディング進捗）, 35（試用期間管理）, 30（シフト希望）
- プロジェクト管理 → ID: 08（タスクチェックリスト）, 07（納期アラート）

## 月間時間削減効果の推定

システムカテゴリ別の基本削減時間:
- 営業・顧客管理系: 20-40時間/月
- 期限・納期管理系: 10-20時間/月
- 在庫・発注系: 30-60時間/月
- 分析・レポート系: 15-30時間/月
- バックオフィス系: 20-50時間/月
- シフト管理系: 10-25時間/月
- 工数管理系: 15-30時間/月

補正係数:
- 月間顧客数: 0-50=1.0, 50-200=1.1, 200-500=1.3, 500+=1.5
- 削減希望時間との整合性: 希望が高いほど優先度UP

## 出力形式（必ず以下のJSON形式で出力）

\`\`\`json
{
  "recommendations": [
    {
      "systemId": "31",
      "systemName": "在庫回転率管理",
      "priority": 1,
      "reason": "小売業で在庫管理に課題を感じているとのことですので、在庫回転率を可視化し、デッドストック削減に直結するこのシステムが最適です。月間500顧客の規模であれば、棚卸や発注計算の自動化で大幅な時間削減が期待できます。",
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
  "analysisText": "貴社は小売業で在庫管理に課題を感じており、月40時間の削減を目標とされています。月間500顧客という規模から、在庫管理システムの導入効果は非常に高いと判断しました。まず在庫回転率管理（ID: 31）で滞留在庫を可視化し、デッドストックを削減。次に材料・消耗品管理（ID: 40）で発注業務を自動化。さらに客単価分析（ID: 06）でアップセル施策を展開することで、コスト削減と売上向上の両面からビジネスを改善できます。この3システムで合計月75時間の削減が見込まれ、目標の40時間を大きく上回る効果が期待できます。"
}
\`\`\`

## 重要な注意事項

1. **必ず3システムを推薦**してください（1つや2つではNG）
2. **priority は 1, 2, 3 の順**で付与（1が最優先）
3. **reason は具体的に**（80-150文字程度、ユーザーの業種・課題に言及）
4. **estimatedTimeSaving は必ず記載**（"月XX時間"の形式）
5. **analysisText は全体の分析**（200-300文字程度、3システムの相乗効果や実現性を説明）
6. **ユーザーの予算感も考慮**（月額1-3万なら小規模、5万以上なら大規模システムも可）

---

## Few-shot Examples

### Example 1: 小売業 × 在庫管理

**ユーザー回答:**
- 業種: 小売業
- 課題: 在庫管理
- 月間顧客数: 500
- 削減希望時間: 40時間
- 予算感: 月額5万

**推薦結果（上記の出力形式参照）**
→ ID: 31（在庫回転率）, 40（材料・消耗品）, 06（客単価分析）

### Example 2: 飲食業 × 顧客リピート

**ユーザー回答:**
- 業種: 飲食業
- 課題: 顧客管理（リピート率向上）
- 月間顧客数: 200
- 削減希望時間: 20時間
- 予算感: 月額3万

**推薦結果:**
\`\`\`json
{
  "recommendations": [
    {
      "systemId": "04",
      "systemName": "リピート促進メールシステム",
      "priority": 1,
      "reason": "飲食業でリピート率向上が課題とのことですので、来店後のフォローアップを自動化するこのシステムが最適です。月200顧客に対して適切なタイミングでフォローメールを送信し、リピート来店を促します。",
      "estimatedTimeSaving": "月12時間"
    },
    {
      "systemId": "05",
      "systemName": "口コミ依頼自動化システム",
      "priority": 2,
      "reason": "リピート促進と併せて口コミ依頼を自動化することで、新規顧客獲得とリピート率向上の両面から集客力を強化できます。",
      "estimatedTimeSaving": "月8時間"
    },
    {
      "systemId": "02",
      "systemName": "失客アラートシステム",
      "priority": 3,
      "reason": "来店間隔を分析して失客リスクのある顧客を自動検出。リピート促進と組み合わせることで、顧客の離脱を防ぎ、LTV（顧客生涯価値）を最大化します。",
      "estimatedTimeSaving": "月6時間"
    }
  ],
  "analysisText": "飲食業における顧客リピート率向上には、来店後のフォローアップが鍵となります。リピート促進メール（ID: 04）で自動的にフォローし、口コミ依頼（ID: 05）で新規集客も強化。さらに失客アラート（ID: 02）で離脱を防ぐ3段構えの施策により、月26時間の削減（目標20時間を上回る）と売上向上を同時に実現できます。月額3万円の予算に対して十分なROIが見込めます。"
}
\`\`\`

### Example 3: 士業 × 期限管理

**ユーザー回答:**
- 業種: 士業（税理士）
- 課題: 期限管理
- 月間顧客数: 50
- 削減希望時間: 10時間
- 予算感: 月額1万

**推薦結果:**
\`\`\`json
{
  "recommendations": [
    {
      "systemId": "03",
      "systemName": "期限管理システム",
      "priority": 1,
      "reason": "税理士業務では届出期限の管理が最重要です。このシステムで期限超過・今週期限・進行中案件を一元管理し、アラート通知で見落としを防止します。顧客50件の規模に最適です。",
      "estimatedTimeSaving": "月8時間"
    },
    {
      "systemId": "19",
      "systemName": "契約更新リマインド",
      "priority": 2,
      "reason": "顧問契約の更新期限を自動管理し、更新漏れを防止。期限管理システムと併用することで、届出期限と契約期限の両方を効率的に管理できます。",
      "estimatedTimeSaving": "月4時間"
    },
    {
      "systemId": "27",
      "systemName": "引継ぎチェックリスト",
      "priority": 3,
      "reason": "担当者変更時の業務引継ぎをスムーズに。期限管理と引継ぎ管理を組み合わせることで、業務の属人化を防ぎ、事務所全体の生産性が向上します。",
      "estimatedTimeSaving": "月3時間"
    }
  ],
  "analysisText": "税理士業務では期限管理が業務の生命線です。期限管理システム（ID: 03）で届出期限を一元管理し、契約更新リマインド（ID: 19）で顧問契約も自動追跡。さらに引継ぎチェックリスト（ID: 27）で業務の標準化を進めることで、月15時間の削減（目標10時間を上回る）が実現します。月額1万円の予算に対して費用対効果が高く、顧客50件の規模に最適なシステム構成です。"
}
\`\`\`

---

## ユーザーの回答データ

${JSON.stringify(userAnswers, null, 2)}

## 指示

上記のユーザー回答と39システムのデータを分析し、業種・課題に最適な3システムを推薦してください。
必ず上記の出力形式（JSON）で応答し、推薦理由は具体的かつユーザーの状況に即したものにしてください。`

  return systemPrompt
}

/**
 * Claude APIレスポンスをパース
 */
export function parseRecommendationResponse(
  responseText: string
): RecommendationOutput | null {
  try {
    // JSON部分を抽出（```json ... ``` で囲まれている場合）
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
    const jsonText = jsonMatch ? jsonMatch[1] : responseText

    const parsed = JSON.parse(jsonText)

    // バリデーション
    if (
      !parsed.recommendations ||
      !Array.isArray(parsed.recommendations) ||
      parsed.recommendations.length !== 3
    ) {
      throw new Error('recommendations must be an array of 3 items')
    }

    if (!parsed.analysisText || typeof parsed.analysisText !== 'string') {
      throw new Error('analysisText must be a string')
    }

    // 各推薦の必須フィールドチェック
    for (const rec of parsed.recommendations) {
      if (
        !rec.systemId ||
        !rec.systemName ||
        !rec.priority ||
        !rec.reason ||
        !rec.estimatedTimeSaving
      ) {
        throw new Error(
          'Each recommendation must have systemId, systemName, priority, reason, estimatedTimeSaving'
        )
      }
    }

    return parsed as RecommendationOutput
  } catch (error) {
    console.error('Failed to parse recommendation response:', error)
    return null
  }
}
