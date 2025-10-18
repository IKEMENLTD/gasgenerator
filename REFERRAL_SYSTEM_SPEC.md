# 4段階代理店制度（リファラルシステム）実装仕様書

## 1. 概要

既存のトラッキングシステムに、4段階の代理店階層制度を実装します。
下位代理店は上位代理店の招待コードを使用して登録し、案件成約時には成約代理店と上位代理店全員にコミッションが分配されます。

---

## 2. 代理店階層と報酬体系

### 2.1 階層構造

```
1次代理店 (Level 1)
  └─ 2次代理店 (Level 2)
      └─ 3次代理店 (Level 3)
          └─ 4次代理店 (Level 4)
```

### 2.2 報酬率テーブル

| 階層 | 自己報酬率 | 直上代理店へのコミッション |
|------|-----------|------------------------|
| 1次代理店 | 20.0% | 0.0% |
| 2次代理店 | 18.0% | 2.0% → 1次代理店 |
| 3次代理店 | 16.0% | 2.0% → 2次代理店 |
| 4次代理店 | 14.0% | 2.0% → 3次代理店 |

### 2.3 コミッション計算例

**例: 4次代理店が ¥100,000 の案件を成約した場合**

| 受取代理店 | 報酬タイプ | 計算式 | 金額 |
|-----------|----------|--------|------|
| 4次代理店（成約者） | 自己報酬 | ¥100,000 × 14% | ¥14,000 |
| 3次代理店（親） | リファラル | ¥100,000 × 2% | ¥2,000 |
| 2次代理店（祖父） | リファラル | ¥100,000 × 2% | ¥2,000 |
| 1次代理店（曾祖父） | リファラル | ¥100,000 × 2% | ¥2,000 |
| **合計** | | | **¥20,000** |

---

## 3. データベース設計

### 3.1 既存テーブルの拡張

**agenciesテーブルに追加するカラム:**

```sql
-- 親代理店ID（1次代理店の場合はNULL）
parent_agency_id UUID REFERENCES agencies(id)

-- 代理店階層レベル（1, 2, 3, 4）
level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 4)

-- 自己報酬率（案件総額に対するパーセンテージ）
own_commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 20.00

-- 代理店固有の招待コード（既存のcodeカラムを使用）
-- 既存: code VARCHAR(50) UNIQUE NOT NULL
```

### 3.2 新規テーブル: 報酬分配記録

```sql
CREATE TABLE agency_commission_distributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversion_id UUID NOT NULL REFERENCES agency_conversions(id),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    deal_amount DECIMAL(12, 2) NOT NULL,
    commission_type VARCHAR(50) NOT NULL, -- 'own' or 'referral'
    commission_rate DECIMAL(5, 2) NOT NULL,
    commission_amount DECIMAL(12, 2) NOT NULL,
    level INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. API仕様

### 4.1 代理店登録API

**エンドポイント:** `POST /.netlify/functions/agency-register`

**リクエストボディ（拡張）:**
```json
{
  "company_name": "株式会社サンプル",
  "agency_name": "サンプル代理店",
  "contact_name": "山田太郎",
  "email": "sample@example.com",
  "phone": "090-1234-5678",
  "password": "password123",
  "invitation_code": "ewyaoak0g2py",  // 招待コード（必須）
  "address": "東京都渋谷区..."
}
```

**処理フロー:**
1. `invitation_code`から親代理店を検索
2. 親代理店の`level`に基づいて新規代理店の`level`と`own_commission_rate`を決定
3. 新規代理店レコードを作成

### 4.2 コミッション計算API

**エンドポイント:** `POST /.netlify/functions/agency-calculate-commission`

**リクエストボディ:**
```json
{
  "conversion_id": "uuid-of-conversion",
  "deal_amount": 100000
}
```

**レスポンス:**
```json
{
  "success": true,
  "total_commission": 20000,
  "distributions": [
    {
      "agency_id": "uuid-4th-agent",
      "agency_name": "4次代理店",
      "level": 4,
      "commission_type": "own",
      "rate": 14.0,
      "amount": 14000
    },
    {
      "agency_id": "uuid-3rd-agent",
      "agency_name": "3次代理店",
      "level": 3,
      "commission_type": "referral",
      "rate": 2.0,
      "amount": 2000
    },
    {
      "agency_id": "uuid-2nd-agent",
      "agency_name": "2次代理店",
      "level": 2,
      "commission_type": "referral",
      "rate": 2.0,
      "amount": 2000
    },
    {
      "agency_id": "uuid-1st-agent",
      "agency_name": "1次代理店",
      "level": 1,
      "commission_type": "referral",
      "rate": 2.0,
      "amount": 2000
    }
  ]
}
```

---

## 5. 実装ステップ

### Phase 1: データベース拡張
- [ ] マイグレーションSQLの作成
- [ ] Supabaseでマイグレーション実行

### Phase 2: バックエンド実装
- [ ] 代理店登録処理の修正
- [ ] コミッション計算関数の実装
- [ ] 報酬分配記録の保存

### Phase 3: フロントエンド実装
- [ ] ダッシュボードに階層情報表示
- [ ] 紹介コードの表示とコピー機能
- [ ] コミッション履歴の表示

### Phase 4: テストとデプロイ
- [ ] テストデータ作成
- [ ] 計算ロジックのテスト
- [ ] 本番環境デプロイ

---

## 6. セキュリティとバリデーション

### 6.1 登録時のバリデーション
- 招待コードは必須（1次代理店除く）
- 最大階層は4まで（4次代理店はさらに招待できない）
- 招待コードは有効な代理店のものでなければならない

### 6.2 コミッション計算時のバリデーション
- 案件金額は正の数値
- 成約代理店が存在することを確認
- 親代理店チェーンが途中で切れていないか確認

---

## 7. 今後の拡張案

- [ ] 代理店パフォーマンスダッシュボード
- [ ] 紹介実績ランキング
- [ ] 月次レポート自動生成
- [ ] メール通知（コミッション発生時）
- [ ] カスタム報酬率設定（管理者用）
