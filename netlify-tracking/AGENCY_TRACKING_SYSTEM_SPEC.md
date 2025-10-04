# 📋 営業代理店向けトラッキングシステム仕様書

## 1. 概要

### 1.1 システム目的
営業代理店が独自の流入経路測定リンクを作成・管理し、自分の顧客獲得状況を把握できるマルチテナント型トラッキングシステム

### 1.2 ユーザー階層
```
システムオーナー（管理者）
    ├── 代理店A
    │   ├── トラッキングリンク1
    │   ├── トラッキングリンク2
    │   └── 獲得顧客リスト
    ├── 代理店B
    │   ├── トラッキングリンク1
    │   └── 獲得顧客リスト
    └── 代理店C
```

## 2. データベース設計

### 2.1 新規追加テーブル

#### **agencies（代理店）**
```sql
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_code VARCHAR(50) UNIQUE NOT NULL, -- 代理店コード（URL用）
    agency_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    commission_rate DECIMAL(5,2), -- 手数料率（%）
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **agency_users（代理店ユーザー）**
```sql
CREATE TABLE agency_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'member', -- admin, member
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **agency_tracking_links（代理店トラッキングリンク）**
```sql
CREATE TABLE agency_tracking_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES agency_users(id),
    tracking_code VARCHAR(20) UNIQUE NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    description TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    line_friend_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_agency_tracking_links_agency_id ON agency_tracking_links(agency_id);
CREATE INDEX idx_agency_tracking_links_tracking_code ON agency_tracking_links(tracking_code);
```

#### **agency_tracking_visits（代理店トラッキング訪問）**
```sql
CREATE TABLE agency_tracking_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_link_id UUID REFERENCES agency_tracking_links(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES agencies(id),
    visitor_id VARCHAR(255), -- セッションID or Cookie ID
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    device_type VARCHAR(50),
    browser VARCHAR(50),
    os VARCHAR(50),
    country VARCHAR(50),
    city VARCHAR(100),
    language VARCHAR(10),
    screen_resolution VARCHAR(20),
    timezone VARCHAR(50),
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_agency_tracking_visits_tracking_link_id ON agency_tracking_visits(tracking_link_id);
CREATE INDEX idx_agency_tracking_visits_agency_id ON agency_tracking_visits(agency_id);
CREATE INDEX idx_agency_tracking_visits_visited_at ON agency_tracking_visits(visited_at);
```

#### **agency_conversions（代理店コンバージョン）**
```sql
CREATE TABLE agency_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    tracking_link_id UUID REFERENCES agency_tracking_links(id),
    tracking_visit_id UUID REFERENCES agency_tracking_visits(id),
    line_user_id VARCHAR(255) NOT NULL, -- LINE User ID
    user_display_name VARCHAR(255),
    user_picture_url TEXT,
    user_status_message TEXT,
    conversion_type VARCHAR(50), -- friend_add, block, unblock
    commission_amount DECIMAL(10,2), -- 手数料額
    commission_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, paid
    converted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_agency_conversions_agency_id ON agency_conversions(agency_id);
CREATE INDEX idx_agency_conversions_line_user_id ON agency_conversions(line_user_id);
```

#### **agency_commissions（代理店手数料）**
```sql
CREATE TABLE agency_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_conversions INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, paid
    payment_date DATE,
    payment_method VARCHAR(50),
    invoice_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.2 既存テーブルとの連携

#### **users テーブルとの連携**
- `agency_conversions.line_user_id` → `users.id` (LINE友達追加後の連携)
- 代理店経由の顧客には`referred_by_agency_id`カラムを追加

```sql
ALTER TABLE users ADD COLUMN referred_by_agency_id UUID REFERENCES agencies(id);
ALTER TABLE users ADD COLUMN referred_by_tracking_code VARCHAR(20);
ALTER TABLE users ADD COLUMN referred_at TIMESTAMP WITH TIME ZONE;
```

## 3. 機能仕様

### 3.1 代理店管理画面

#### **ログイン画面**
- URL: `https://taskmateai.net/agency/login`
- メールアドレス/パスワード認証
- パスワードリセット機能
- 2段階認証（オプション）

#### **ダッシュボード**
- URL: `https://taskmateai.net/agency/dashboard`

**表示項目:**
1. **統計サマリー**
   - 総リンク数
   - 今月の訪問数
   - 今月のコンバージョン数
   - コンバージョン率
   - 今月の見込み手数料

2. **グラフ表示**
   - 日別訪問数推移（過去30日）
   - 時間帯別アクセス分布
   - デバイス別割合
   - 流入元別割合

3. **最近のアクティビティ**
   - リアルタイム訪問ログ
   - 新規コンバージョン通知

#### **リンク管理**
- URL: `https://taskmateai.net/agency/links`

**機能:**
1. **リンク作成**
   - キャンペーン名（必須）
   - 説明文
   - UTMパラメータ設定
   - 有効期限設定
   - 使用回数制限
   - QRコード自動生成

2. **リンク一覧**
   - 検索・フィルター機能
   - ソート機能（作成日、訪問数、コンバージョン率）
   - 一括操作（有効/無効化、削除）
   - CSVエクスポート

3. **リンク詳細**
   - 訪問統計
   - コンバージョンファネル
   - 地域分布マップ
   - デバイス分析

#### **顧客管理**
- URL: `https://taskmateai.net/agency/customers`

**表示項目:**
- 獲得顧客リスト
- LINE表示名
- 友達追加日時
- 流入リンク
- ステータス（アクティブ/ブロック）
- 推定LTV（生涯価値）

#### **レポート**
- URL: `https://taskmateai.net/agency/reports`

**レポート種類:**
1. **月次レポート**
   - 総訪問数
   - コンバージョン数
   - 手数料計算
   - トップパフォーマンスリンク

2. **カスタムレポート**
   - 期間指定
   - 項目選択
   - PDF/Excel出力

#### **手数料管理**
- URL: `https://taskmateai.net/agency/commissions`

**機能:**
- 手数料履歴
- 支払い状況
- 請求書ダウンロード
- 振込先口座管理

### 3.2 システムオーナー管理画面（拡張）

#### **代理店管理**
- URL: `https://taskmateai.net/admin/agencies`

**機能:**
1. **代理店登録**
   - 基本情報入力
   - 手数料率設定
   - アカウント発行

2. **代理店一覧**
   - パフォーマンス順位
   - 手数料支払い管理
   - アカウント停止/再開

3. **統計分析**
   - 代理店別成績
   - 全体トレンド分析
   - 異常検知アラート

## 4. API仕様

### 4.1 代理店向けAPI

```javascript
// 認証
POST /api/agency/auth/login
POST /api/agency/auth/logout
POST /api/agency/auth/refresh

// リンク管理
GET    /api/agency/links
POST   /api/agency/links
GET    /api/agency/links/:id
PUT    /api/agency/links/:id
DELETE /api/agency/links/:id

// 統計
GET /api/agency/stats/summary
GET /api/agency/stats/visits
GET /api/agency/stats/conversions

// レポート
GET /api/agency/reports/monthly
GET /api/agency/reports/custom

// Webhook
POST /api/agency/webhook/line-event
```

### 4.2 トラッキングAPI

```javascript
// 訪問記録
POST /api/track/visit
{
  "tracking_code": "ABC123",
  "visitor_id": "xxx",
  "ip": "123.45.67.89",
  "user_agent": "...",
  "referrer": "https://..."
}

// コンバージョン記録
POST /api/track/conversion
{
  "tracking_code": "ABC123",
  "line_user_id": "Uxxxxx",
  "event_type": "friend_add"
}
```

## 5. セキュリティ要件

### 5.1 認証・認可
- **JWT認証**
- **ロール別アクセス制御**
  - システムオーナー: 全権限
  - 代理店管理者: 自社データのみ
  - 代理店メンバー: 閲覧のみ

### 5.2 データ保護
- **暗号化**
  - パスワード: bcrypt
  - 通信: HTTPS必須
  - データベース: 機密情報暗号化

- **アクセス制限**
  - IPホワイトリスト（オプション）
  - レート制限
  - SQLインジェクション対策
  - XSS対策

### 5.3 監査ログ
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_type VARCHAR(20), -- owner, agency
    user_id UUID,
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 6. パフォーマンス要件

### 6.1 応答時間
- API: 200ms以下
- ダッシュボード: 1秒以下
- レポート生成: 5秒以下

### 6.2 同時接続
- 代理店数: 最大1,000社
- 同時ユーザー: 最大10,000人
- リクエスト/秒: 1,000 RPS

### 6.3 データ保持
- 訪問ログ: 1年間
- コンバージョン: 無期限
- 監査ログ: 2年間

## 7. 実装フェーズ

### Phase 1: 基盤構築（2週間）
- データベース設計・実装
- 認証システム構築
- 基本API実装

### Phase 2: 代理店機能（3週間）
- 代理店管理画面
- リンク作成・管理
- 基本統計機能

### Phase 3: 高度な機能（2週間）
- 詳細レポート
- 手数料管理
- 通知システム

### Phase 4: 統合・最適化（1週間）
- システムオーナー画面統合
- パフォーマンス最適化
- セキュリティ監査

## 8. 画面設計

### 8.1 代理店ダッシュボード
```
┌─────────────────────────────────────────┐
│  TaskMate 代理店ポータル                │
│  [ロゴ] 株式会社〇〇 様  [ログアウト]    │
├─────────────────────────────────────────┤
│                                         │
│  今月の成績                             │
│  ┌──────┬──────┬──────┬──────┐      │
│  │訪問数 │CV数  │CV率  │手数料│      │
│  │1,234  │123   │10%   │¥12,345│      │
│  └──────┴──────┴──────┴──────┘      │
│                                         │
│  [グラフエリア]                         │
│                                         │
│  最近のコンバージョン                    │
│  ┌─────────────────────────────────┐  │
│  │ 山田太郎 | 10分前 | Campaign_A   │  │
│  │ 鈴木花子 | 1時間前 | Campaign_B  │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 8.2 リンク作成画面
```
┌─────────────────────────────────────────┐
│  新規トラッキングリンク作成              │
├─────────────────────────────────────────┤
│                                         │
│  キャンペーン名: [_______________]      │
│  説明: [_________________________]      │
│                                         │
│  ▼ UTMパラメータ（任意）               │
│  Source:   [_______________]            │
│  Medium:   [_______________]            │
│  Campaign: [_______________]            │
│                                         │
│  ▼ 詳細設定                            │
│  有効期限: [2024/12/31]                │
│  使用上限: [1000] 回                   │
│                                         │
│  [キャンセル] [プレビュー] [作成]       │
└─────────────────────────────────────────┘
```

## 9. 通知機能

### 9.1 代理店向け通知
- **メール通知**
  - 新規コンバージョン
  - 月次レポート
  - 手数料確定

- **ダッシュボード通知**
  - リアルタイム訪問
  - 目標達成アラート

### 9.2 システムオーナー向け通知
- **異常検知**
  - 不正アクセス
  - 異常なトラフィック
  - システムエラー

## 10. 料金体系（案）

### 10.1 代理店手数料
```
基本手数料率: 新規顧客獲得1件につき
- スタンダードプラン顧客: ¥500
- プロフェッショナルプラン顧客: ¥1,000
- エンタープライズプラン顧客: ¥2,000

ボーナス:
- 月間10件以上: +10%
- 月間50件以上: +20%
- 月間100件以上: +30%
```

### 10.2 代理店ランク
```
ブロンズ: 累計10件
シルバー: 累計50件
ゴールド: 累計100件
プラチナ: 累計500件

※ランクに応じて手数料率アップ
```

## 11. 今後の拡張案

### 11.1 機能拡張
- A/Bテスト機能
- ヒートマップ分析
- チャットボット連携
- SMS/メール自動送信
- アフィリエイトプログラム

### 11.2 連携拡張
- Google Analytics連携
- Facebook Pixel連携
- Twitter広告連携
- CRM連携（Salesforce, HubSpot）

### 11.3 AI機能
- 最適な投稿時間予測
- コンバージョン予測
- 異常検知自動化
- レポート自動生成

## 12. 成功指標（KPI）

### 12.1 システム指標
- 代理店登録数
- アクティブ代理店率
- 月間リンク作成数
- 総コンバージョン数

### 12.2 ビジネス指標
- 代理店経由売上
- 平均顧客獲得単価
- 顧客生涯価値（LTV）
- 代理店満足度

---

この仕様書に基づいて、段階的に実装を進めることで、スケーラブルで使いやすい代理店向けトラッキングシステムを構築できます。