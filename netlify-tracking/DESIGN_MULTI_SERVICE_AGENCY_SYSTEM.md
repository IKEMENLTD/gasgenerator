# マルチサービス型代理店システム 設計書 v1.0

**作成日**: 2025-01-21
**ステータス**: 最終版
**対象システム**: TaskMate AI 代理店管理システム

---

## 📋 目次

1. [概要](#1-概要)
2. [現状分析](#2-現状分析)
3. [要件定義](#3-要件定義)
4. [アーキテクチャ設計](#4-アーキテクチャ設計)
5. [データベース設計](#5-データベース設計)
6. [バックエンドAPI設計](#6-バックエンドapi設計)
7. [フロントエンド設計](#7-フロントエンド設計)
8. [デプロイ・インフラ設計](#8-デプロイインフラ設計)
9. [マイグレーション計画](#9-マイグレーション計画)
10. [実装チェックリスト](#10-実装チェックリスト)
11. [リスク分析](#11-リスク分析)
12. [付録](#12-付録)

---

## 1. 概要

### 1.1 目的

現在の TaskMate AI 専用代理店システムを、**複数の公式LINEサービスを1つのダッシュボードで管理できるマルチサービス型システム**に拡張する。

### 1.2 設計原則

- **Single Source of Truth**: データベースは1つ（Supabase）
- **Service Isolation**: サービスごとに独立したドメイン・ブランディング
- **Centralized Management**: 代理店管理は1つのダッシュボード
- **Flexible Commission**: サービス×代理店ごとに異なる報酬率
- **Backward Compatibility**: 既存システムを壊さない段階的移行

### 1.3 スコープ

**対象**:
- データベーススキーマ拡張
- バックエンドAPI修正
- 代理店ダッシュボードUI拡張
- 各サービスのトラッキング機能実装

**対象外**:
- 各サービスのメインアプリケーション開発
- 管理者向けサービス管理画面（将来実装）
- 自動支払いシステム

---

## 2. 現状分析

### 2.1 現行システム構成

```
TaskMate AI (1サービス専用)
├─ Domain: taskmateai.net
├─ Database: Supabase (単一サービス想定)
├─ Backend: Netlify Functions
└─ Frontend: 代理店ダッシュボード

制限事項:
❌ 複数サービスに対応していない
❌ サービスごとの報酬率設定ができない
❌ 別ドメインでの運用ができない
```

### 2.2 課題

1. **サービス情報がハードコード**
   - LINE認証情報が環境変数のみ
   - サービス追加にはコード変更が必須

2. **ドメイン固定**
   - taskmateai.net 以外で運用できない
   - 新サービス追加時に別リポジトリが必要

3. **報酬率固定**
   - 全代理店一律20%
   - サービスごとの柔軟な設定不可

4. **データ分離不可**
   - サービス別の統計が取れない
   - 混在リスク

---

## 3. 要件定義

### 3.1 機能要件

#### FR-1: マルチサービス対応
- [ ] 複数の公式LINEサービスを登録可能
- [ ] サービスごとに独立したLINE認証情報
- [ ] サービスごとに独立したドメイン

#### FR-2: 統合ダッシュボード
- [ ] 1つの代理店アカウントで全サービス管理
- [ ] サービス選択フィルタリング
- [ ] 全サービス統合統計表示

#### FR-3: 柔軟な報酬設定
- [ ] サービスごとのデフォルト報酬率
- [ ] 代理店×サービスごとの個別報酬率
- [ ] リファラル報酬もサービスごとに設定可能

#### FR-4: サービス別トラッキング
- [ ] サービスごとに異なるドメインでトラッキングリンク生成
- [ ] トラッキングコードからサービスを自動識別
- [ ] サービス別のコンバージョン記録

#### FR-5: データ分離と統合
- [ ] サービスごとのデータ分離
- [ ] 全サービス統合レポート
- [ ] サービス間でのデータ混在防止

### 3.2 非機能要件

#### NFR-1: パフォーマンス
- API レスポンス時間: 500ms 以内
- サービス追加時のコード変更: 不要

#### NFR-2: スケーラビリティ
- サービス数: 無制限（DB容量の範囲内）
- 代理店数: 10,000 代理店まで対応

#### NFR-3: セキュリティ
- サービスごとに独立したLINE署名検証
- CORS設定で許可ドメインのみアクセス可

#### NFR-4: 保守性
- サービス追加はDB登録のみ
- 既存コードへの影響最小化

---

## 4. アーキテクチャ設計

### 4.1 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│           Supabase（共通データベース）                │
│  - agencies（代理店マスター）                         │
│  - services（サービスマスター）                       │
│  - agency_service_settings（代理店×サービス設定）    │
│  - agency_tracking_links（トラッキングリンク）       │
│  - agency_conversions（コンバージョン）              │
│  - line_profiles（LINEユーザープロフィール）         │
└─────────────────────────────────────────────────────┘
                          ↑
                          │ すべてのデータを集約
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ↓                 ↓                 ↓
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│ 代理店管理     │  │ TaskMate AI  │  │ Service B    │
│ ダッシュボード │  │              │  │              │
├───────────────┤  ├──────────────┤  ├──────────────┤
│ Domain:       │  │ Domain:      │  │ Domain:      │
│ agency.       │  │ taskmateai   │  │ newservice   │
│ platform.com  │  │ .net         │  │ .com         │
├───────────────┤  ├──────────────┤  ├──────────────┤
│ 機能:         │  │ 機能:        │  │ 機能:        │
│ - 全サービス  │  │ - アプリ     │  │ - アプリ     │
│   統合管理    │  │ - LP         │  │ - LP         │
│ - リンク生成  │  │ - /t/:code   │  │ - /t/:code   │
│ - 統計表示    │  │   リダイレクト│  │   リダイレクト│
│ - 報酬管理    │  │              │  │              │
└───────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ↓
              ┌───────────────────────┐
              │ 共通バックエンドAPI    │
              ├───────────────────────┤
              │ Netlify Functions     │
              │ - LINE Webhook        │
              │ - トラッキング記録    │
              │ - 統計計算            │
              │ - 報酬計算            │
              └───────────────────────┘
                          ↑
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ↓                 ↓                 ↓
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│ LINE公式      │  │ LINE公式      │  │ LINE公式      │
│ TaskMate AI   │  │ Service B     │  │ Service C     │
└───────────────┘  └──────────────┘  └──────────────┘
```

### 4.2 データフロー

#### ケース1: トラッキングリンク生成

```
代理店ダッシュボード
  ↓
1. サービス選択（例: TaskMate AI）
  ↓
2. POST /agency-create-link
   {
     service_id: "taskmate-uuid",
     utm_campaign: "春キャンペーン"
   }
  ↓
3. DB: services テーブルから tracking_base_url 取得
   → "https://taskmateai.net/t"
  ↓
4. トラッキングコード生成: "abc123"
  ↓
5. 完成URL: "https://taskmateai.net/t/abc123"
  ↓
6. DB: agency_tracking_links に保存
   - service_id: taskmate-uuid
   - tracking_code: abc123
   - agency_id: xxx
```

#### ケース2: ユーザーがトラッキングリンクをクリック

```
ユーザー
  ↓
1. クリック: https://taskmateai.net/t/abc123
  ↓
2. GET /track-redirect?code=abc123
  ↓
3. DB: tracking_code から service_id, agency_id 取得
  ↓
4. セッション記録（agency_tracking_visits）
   - service_id: taskmate-uuid
   - agency_id: xxx
   - visitor_ip, user_agent, etc.
  ↓
5. visit_count をインクリメント
  ↓
6. リダイレクト先取得（services.app_redirect_url）
   → "https://taskmateai.net/app"
  ↓
7. 302 Redirect
```

#### ケース3: LINE友達追加

```
ユーザーがLINE友達追加
  ↓
1. LINE Webhook → POST /.netlify/functions/line-webhook?service=taskmate
  ↓
2. service_id 取得（クエリパラメータまたはパス）
  ↓
3. DB: services テーブルから LINE認証情報取得
  ↓
4. 署名検証（サービス固有の channel_secret）
  ↓
5. セッション検索（過去1時間以内）
   WHERE service_id = taskmate-uuid
     AND visitor_ip = xxx
  ↓
6. コンバージョン記録（agency_conversions）
   - service_id: taskmate-uuid
   - agency_id: xxx
   - conversion_type: line_friend
  ↓
7. conversion_count をインクリメント
  ↓
8. 報酬計算
   - agency_service_settings から報酬率取得
   - なければ services.default_commission_rate
```

### 4.3 ドメイン構成

#### パターン: ハイブリッド型（推奨）

```
1. 共通バックエンドAPI
   Domain: api.platform.com（または既存ドメイン）
   役割: Netlify Functions ホスティング

2. 代理店ダッシュボード
   Domain: agency.platform.com
   役割: 全サービス統合管理画面

3. TaskMate AI
   Domain: taskmateai.net
   役割: TaskMate アプリ + トラッキング
   API呼び出し先: api.platform.com

4. Service B
   Domain: newservice.com
   役割: Service B アプリ + トラッキング
   API呼び出し先: api.platform.com
```

**メリット**:
- ✅ バックエンドは1箇所（保守性向上）
- ✅ サービスごとに完全独立したブランディング
- ✅ 新サービス追加時はフロントエンドのみ作成

---

## 5. データベース設計

### 5.1 新規テーブル

#### 5.1.1 `services` テーブル（サービスマスター）

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本情報
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),

  -- ドメイン・URL設定
  domain TEXT UNIQUE NOT NULL,
  tracking_base_url TEXT NOT NULL,           -- 例: https://taskmateai.net/t
  app_redirect_url TEXT NOT NULL,            -- 例: https://taskmateai.net/app
  line_add_redirect_url TEXT,                -- LINE友達追加後のリダイレクト先

  -- LINE設定
  line_channel_id TEXT UNIQUE NOT NULL,
  line_channel_secret TEXT NOT NULL,
  line_channel_access_token TEXT NOT NULL,
  line_official_url TEXT NOT NULL,           -- 例: https://lin.ee/xxx

  -- 報酬設定（デフォルト値）
  default_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  default_referral_rate DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  subscription_price INTEGER NOT NULL DEFAULT 10000,  -- 月額料金（円）

  -- メタデータ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_domain ON services(domain);

-- サンプルデータ
INSERT INTO services (
  name, description, domain, tracking_base_url, app_redirect_url,
  line_channel_id, line_channel_secret, line_channel_access_token, line_official_url,
  default_commission_rate, default_referral_rate, subscription_price
) VALUES (
  'TaskMate AI',
  'AI搭載のタスク管理アシスタント',
  'taskmateai.net',
  'https://taskmateai.net/t',
  'https://taskmateai.net/app',
  'LINE_CHANNEL_ID_TASKMATE',
  'LINE_CHANNEL_SECRET_TASKMATE',
  'LINE_ACCESS_TOKEN_TASKMATE',
  'https://lin.ee/FMy4xlx',
  20.00,
  2.00,
  10000
);
```

#### 5.1.2 `agency_service_settings` テーブル（代理店×サービス設定）

```sql
CREATE TABLE agency_service_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 関連
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- カスタム報酬率（NULL の場合は services.default_* を使用）
  commission_rate DECIMAL(5,2),              -- 例: 25.00 (25%)
  referral_rate DECIMAL(5,2),                -- 例: 3.00 (3%)

  -- 状態
  is_active BOOLEAN DEFAULT true,

  -- メモ
  notes TEXT,

  -- メタデータ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(agency_id, service_id)
);

-- インデックス
CREATE INDEX idx_agency_service_settings_agency ON agency_service_settings(agency_id);
CREATE INDEX idx_agency_service_settings_service ON agency_service_settings(service_id);
CREATE INDEX idx_agency_service_settings_active ON agency_service_settings(is_active);
```

#### 5.1.3 `line_profile_services` テーブル（LINEユーザー×サービス関連）

```sql
-- LINEユーザーが複数サービスで友達追加する可能性に対応
CREATE TABLE line_profile_services (
  line_user_id TEXT NOT NULL REFERENCES line_profiles(user_id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  is_friend BOOLEAN DEFAULT true,
  added_at TIMESTAMP DEFAULT NOW(),
  unfollowed_at TIMESTAMP,

  PRIMARY KEY (line_user_id, service_id)
);

-- インデックス
CREATE INDEX idx_line_profile_services_service ON line_profile_services(service_id);
CREATE INDEX idx_line_profile_services_is_friend ON line_profile_services(is_friend);
```

### 5.2 既存テーブルの拡張

#### 5.2.1 `agency_tracking_links`

```sql
ALTER TABLE agency_tracking_links
  ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE RESTRICT;

-- インデックス追加
CREATE INDEX idx_agency_tracking_links_service ON agency_tracking_links(service_id);

-- NOT NULL制約（既存データ移行後）
-- ALTER TABLE agency_tracking_links ALTER COLUMN service_id SET NOT NULL;
```

#### 5.2.2 `agency_tracking_visits`

```sql
ALTER TABLE agency_tracking_visits
  ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE RESTRICT;

CREATE INDEX idx_agency_tracking_visits_service ON agency_tracking_visits(service_id);
```

#### 5.2.3 `agency_conversions`

```sql
ALTER TABLE agency_conversions
  ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE RESTRICT;

CREATE INDEX idx_agency_conversions_service ON agency_conversions(service_id);
```

#### 5.2.4 `agency_commissions`

```sql
ALTER TABLE agency_commissions
  ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE RESTRICT;

CREATE INDEX idx_agency_commissions_service ON agency_commissions(service_id);
```

### 5.3 データベースER図

```
┌──────────────┐
│  services    │
│──────────────│
│ id (PK)      │◄─────┐
│ name         │      │
│ domain       │      │
│ line_*       │      │
│ default_*    │      │
└──────────────┘      │
                      │
        ┌─────────────┴──────────────┐
        │                            │
        │                            │
┌───────┴──────────┐     ┌───────────┴────────────┐
│ agency_service_  │     │ agency_tracking_links  │
│ settings         │     │────────────────────────│
│──────────────────│     │ id (PK)                │
│ id (PK)          │     │ agency_id (FK)         │
│ agency_id (FK)   │     │ service_id (FK) ◄──────┤
│ service_id (FK)  │     │ tracking_code          │
│ commission_rate  │     │ visit_count            │
│ referral_rate    │     └────────────────────────┘
└──────────────────┘                 │
        ▲                            │
        │                            ▼
        │                ┌────────────────────────┐
        │                │ agency_tracking_visits │
        │                │────────────────────────│
        │                │ tracking_link_id (FK)  │
        │                │ service_id (FK)        │
┌───────┴──────┐         │ visitor_ip             │
│  agencies    │         └────────────────────────┘
│──────────────│                     │
│ id (PK)      │                     │
│ code         │                     ▼
│ name         │         ┌────────────────────────┐
│ level        │         │ agency_conversions     │
└──────────────┘         │────────────────────────│
                         │ agency_id (FK)         │
                         │ service_id (FK)        │
                         │ line_user_id           │
                         │ conversion_type        │
                         └────────────────────────┘
                                     │
                                     ▼
                         ┌────────────────────────┐
                         │ agency_commissions     │
                         │────────────────────────│
                         │ agency_id (FK)         │
                         │ service_id (FK)        │
                         │ commission_amount      │
                         └────────────────────────┘
```

---

## 6. バックエンドAPI設計

### 6.1 Webhook処理

#### 6.1.1 エンドポイント設計

**推奨**: クエリパラメータ方式

```
/.netlify/functions/line-webhook?service={service_slug}

例:
/.netlify/functions/line-webhook?service=taskmate
/.netlify/functions/line-webhook?service=serviceb
```

**理由**:
- Netlify Functionsでパス変数が使いづらい
- クエリパラメータは実装が簡単
- LINE Developers で設定しやすい

#### 6.1.2 実装（line-webhook.js）

```javascript
// netlify/functions/line-webhook.js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Line-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 1. サービス識別
    const serviceSlug = event.queryStringParameters?.service;
    if (!serviceSlug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing service parameter' })
      };
    }

    // 2. サービス情報取得
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('domain', `${serviceSlug}.*`)  // 簡易マッピング
      .or(`name.ilike.%${serviceSlug}%`) // または名前で検索
      .eq('status', 'active')
      .single();

    if (serviceError || !service) {
      console.error('Service not found:', serviceSlug);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Service not found' })
      };
    }

    // 3. LINE署名検証（サービス固有のsecret）
    const signature = event.headers['x-line-signature'];
    const body = event.body;

    const hash = crypto
      .createHmac('SHA256', service.line_channel_secret)
      .update(body)
      .digest('base64');

    if (signature !== hash) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    // 4. イベント処理
    const webhookBody = JSON.parse(body);
    const events = webhookBody.events;

    for (const evt of events) {
      await processLineEvent(evt, service);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error('LINE webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function processLineEvent(event, service) {
  if (event.type === 'follow') {
    await handleFollowEvent(event, service);
  } else if (event.type === 'unfollow') {
    await handleUnfollowEvent(event, service);
  }
  // 他のイベントタイプ...
}

async function handleFollowEvent(event, service) {
  const userId = event.source.userId;

  // 1. LINEプロフィール取得・保存（既存処理）
  // ...

  // 2. line_profile_services に記録
  await supabase
    .from('line_profile_services')
    .upsert({
      line_user_id: userId,
      service_id: service.id,
      is_friend: true,
      added_at: new Date().toISOString()
    });

  // 3. セッション検索（過去1時間以内）
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { data: sessions } = await supabase
    .from('agency_tracking_visits')
    .select('tracking_link_id, agency_id, session_id')
    .eq('service_id', service.id)  // ← サービスでフィルタ
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (!sessions || sessions.length === 0) {
    console.log('No matching session found for service:', service.name);
    return;
  }

  const session = sessions[0];

  // 4. コンバージョン記録
  const conversionData = {
    agency_id: session.agency_id,
    service_id: service.id,  // ← サービスID記録
    line_user_id: userId,
    conversion_type: 'line_friend',
    tracking_link_id: session.tracking_link_id,
    session_id: session.session_id,
    metadata: {
      service_name: service.name,
      line_official_url: service.line_official_url
    }
  };

  await supabase
    .from('agency_conversions')
    .insert([conversionData]);

  // 5. conversion_count インクリメント
  if (session.tracking_link_id) {
    await supabase
      .from('agency_tracking_links')
      .update({
        conversion_count: supabase.raw('conversion_count + 1')
      })
      .eq('id', session.tracking_link_id);
  }

  console.log(`Conversion recorded for service: ${service.name}`);
}
```

### 6.2 トラッキングリンク生成API

#### 6.2.1 エンドポイント

```
POST /.netlify/functions/agency-create-link
```

#### 6.2.2 リクエスト

```json
{
  "service_id": "uuid",
  "name": "春のキャンペーン",
  "utm_source": "twitter",
  "utm_medium": "social",
  "utm_campaign": "spring2025",
  "utm_term": "",
  "utm_content": ""
}
```

#### 6.2.3 実装

```javascript
// netlify/functions/agency-create-link.js
exports.handler = async (event) => {
  // 認証処理...

  const { service_id, name, utm_source, utm_medium, utm_campaign } = JSON.parse(event.body);

  // 1. サービス情報取得
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('tracking_base_url, status')
    .eq('id', service_id)
    .single();

  if (serviceError || !service || service.status !== 'active') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or inactive service' })
    };
  }

  // 2. トラッキングコード生成
  const trackingCode = generateTrackingCode(); // UUID または短縮コード

  // 3. トラッキングリンク保存
  const { data: link, error: linkError } = await supabase
    .from('agency_tracking_links')
    .insert({
      agency_id: agencyId,
      service_id: service_id,  // ← サービスID保存
      tracking_code: trackingCode,
      name: name,
      utm_source: utm_source,
      utm_medium: utm_medium,
      utm_campaign: utm_campaign,
      // ...
    })
    .select()
    .single();

  if (linkError) {
    console.error('Error creating link:', linkError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create link' })
    };
  }

  // 4. 完全URL生成
  const fullUrl = `${service.tracking_base_url}/${trackingCode}`;

  return {
    statusCode: 200,
    body: JSON.stringify({
      tracking_code: trackingCode,
      url: fullUrl,
      short_url: fullUrl  // 短縮URL機能は将来実装
    })
  };
};

function generateTrackingCode() {
  // ランダム8文字の英数字
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```

### 6.3 統計・分析API

#### 6.3.1 エンドポイント

```
GET /.netlify/functions/agency-stats?service_id={uuid}
GET /.netlify/functions/agency-analytics?service_id={uuid}
```

#### 6.3.2 実装パターン

```javascript
// 全APIで共通のサービスフィルタリング処理

async function getStats(agencyId, serviceId = null) {
  let query = supabase
    .from('agency_tracking_links')
    .select('visit_count')
    .eq('agency_id', agencyId);

  // サービスフィルタ（オプション）
  if (serviceId && serviceId !== 'all') {
    query = query.eq('service_id', serviceId);
  }

  const { data } = await query;

  const totalClicks = data?.reduce((sum, link) => sum + (link.visit_count || 0), 0) || 0;

  return { totalClicks };
}
```

### 6.4 報酬計算API

#### 6.4.1 報酬率取得ロジック

```javascript
async function getCommissionRate(agencyId, serviceId) {
  // 1. 代理店×サービス設定を確認
  const { data: settings } = await supabase
    .from('agency_service_settings')
    .select('commission_rate')
    .eq('agency_id', agencyId)
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .single();

  if (settings?.commission_rate) {
    return settings.commission_rate;
  }

  // 2. サービスのデフォルト報酬率を使用
  const { data: service } = await supabase
    .from('services')
    .select('default_commission_rate')
    .eq('id', serviceId)
    .single();

  return service?.default_commission_rate || 0;
}

async function calculateCommission(conversion) {
  const rate = await getCommissionRate(conversion.agency_id, conversion.service_id);

  // サービスの月額料金取得
  const { data: service } = await supabase
    .from('services')
    .select('subscription_price')
    .eq('id', conversion.service_id)
    .single();

  const subscriptionPrice = service?.subscription_price || 10000;
  const commissionAmount = subscriptionPrice * (rate / 100);

  return {
    rate: rate,
    amount: Math.round(commissionAmount)
  };
}
```

### 6.5 CORS設定

```javascript
// すべてのAPI関数で共通

const headers = {
  'Access-Control-Allow-Origin': '*',  // または許可ドメインのリスト
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agency-Id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
};

// 本番環境では動的に設定
const allowedOrigins = [
  'https://agency.platform.com',
  'https://taskmateai.net',
  'https://newservice.com'
];

const origin = event.headers.origin;
if (allowedOrigins.includes(origin)) {
  headers['Access-Control-Allow-Origin'] = origin;
}
```

---

## 7. フロントエンド設計

### 7.1 代理店ダッシュボード（統合管理画面）

#### 7.1.1 URL構成

```
https://agency.platform.com/
├─ /              ログイン画面
├─ /dashboard     ダッシュボード
│   ├─ ?service=all          全サービス表示
│   ├─ ?service=taskmate     TaskMate AIのみ
│   └─ ?service=serviceb     Service Bのみ
```

#### 7.1.2 データ構造

```javascript
// dashboard.js
{
  // サービス選択
  selectedServiceId: 'all',  // 'all' | service_id
  services: [
    {
      id: 'uuid',
      name: 'TaskMate AI',
      domain: 'taskmateai.net',
      commission_rate: 20,  // この代理店の報酬率
      status: 'active'
    },
    {
      id: 'uuid',
      name: 'Service B',
      domain: 'newservice.com',
      commission_rate: 15,
      status: 'active'
    }
  ],

  // 統計（フィルタリング済み）
  stats: {
    totalLinks: 10,
    totalClicks: 500,
    totalConversions: 50,
    conversionRate: 10,
    monthlyCommission: 100000
  },

  // トラッキングリンク（サービス情報付き）
  trackingLinks: [
    {
      id: 'xxx',
      service_id: 'uuid',
      service_name: 'TaskMate AI',
      service_color: '#10b981',  // サービス別色分け
      tracking_code: 'abc123',
      url: 'https://taskmateai.net/t/abc123',
      visit_count: 100,
      conversion_count: 10
    }
  ]
}
```

#### 7.1.3 UI変更

##### サービス選択UI（全タブ共通）

```html
<!-- ダッシュボード上部 -->
<div class="service-selector bg-white rounded-lg border p-4 mb-6">
  <label class="text-sm font-medium text-gray-700 mb-2">サービスフィルタ</label>
  <select x-model="selectedServiceId" @change="loadDashboardData()"
          class="w-full px-4 py-2 border rounded-lg">
    <option value="all">すべてのサービス</option>
    <template x-for="service in services" :key="service.id">
      <option :value="service.id" x-text="service.name"></option>
    </template>
  </select>
</div>
```

##### リンク作成タブ

```html
<!-- サービス選択を追加 -->
<div class="form-group">
  <label>サービス *</label>
  <select x-model="newLink.service_id" required>
    <option value="">サービスを選択</option>
    <template x-for="service in services" :key="service.id">
      <option :value="service.id" x-text="service.name"></option>
    </template>
  </select>
</div>

<!-- 報酬率表示 -->
<div class="bg-blue-50 p-3 rounded" x-show="newLink.service_id">
  <p class="text-sm text-blue-800">
    このサービスの報酬率:
    <span x-text="`${getServiceCommissionRate(newLink.service_id)}%`"></span>
  </p>
</div>
```

##### リンク一覧

```html
<!-- サービスバッジ追加 -->
<template x-for="link in trackingLinks" :key="link.id">
  <tr>
    <td>
      <!-- サービスバッジ -->
      <span class="px-2 py-1 text-xs rounded-full"
            :style="`background: ${link.service_color}20; color: ${link.service_color}`"
            x-text="link.service_name"></span>
    </td>
    <td x-text="link.name"></td>
    <td>
      <a :href="link.url" target="_blank" class="text-blue-600">
        <span x-text="link.url"></span>
      </a>
    </td>
    <!-- ... -->
  </tr>
</template>
```

##### Analyticsタブ

```html
<!-- サービス比較グラフ追加 -->
<div class="bg-white rounded-lg border p-6">
  <h3>サービス別パフォーマンス</h3>
  <canvas id="serviceComparisonChart"></canvas>
</div>

<!-- 既存のチャートはフィルタリング適用 -->
```

##### 報酬タブ

```html
<!-- サービス別報酬内訳 -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  <template x-for="service in services" :key="service.id">
    <div class="bg-white rounded-lg border p-4">
      <p class="text-sm text-gray-600" x-text="service.name"></p>
      <p class="text-2xl font-bold text-emerald-600 mt-2"
         x-text="`¥${getServiceCommission(service.id).toLocaleString()}`"></p>
      <p class="text-xs text-gray-500 mt-1"
         x-text="`報酬率: ${service.commission_rate}%`"></p>
    </div>
  </template>
</div>
```

#### 7.1.4 JavaScript変更

```javascript
// dashboard.js

// 初期化時にサービス一覧を取得
async init() {
  await this.loadServices();
  await this.login();
},

async loadServices() {
  try {
    const response = await fetch('/.netlify/functions/agency-services', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
        'X-Agency-Id': localStorage.getItem('agencyId')
      }
    });

    if (response.ok) {
      const data = await response.json();
      this.services = data.services || [];

      // URLパラメータからサービス選択を復元
      const params = new URLSearchParams(window.location.search);
      this.selectedServiceId = params.get('service') || 'all';
    }
  } catch (error) {
    console.error('Error loading services:', error);
  }
},

// 全データ取得時にサービスフィルタを適用
async loadDashboardData() {
  // URLパラメータ更新
  const url = new URL(window.location);
  url.searchParams.set('service', this.selectedServiceId);
  window.history.pushState({}, '', url);

  await Promise.all([
    this.loadStats(),
    this.loadLinks(),
    this.loadAnalytics(),
    this.loadCommissions()
  ]);
},

async loadStats() {
  const serviceParam = this.selectedServiceId !== 'all'
    ? `?service_id=${this.selectedServiceId}`
    : '';

  const response = await fetch(`/.netlify/functions/agency-stats${serviceParam}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
      'X-Agency-Id': localStorage.getItem('agencyId')
    }
  });

  if (response.ok) {
    const data = await response.json();
    this.stats = data;
  }
},

// サービスの報酬率取得
getServiceCommissionRate(serviceId) {
  const service = this.services.find(s => s.id === serviceId);
  return service?.commission_rate || 0;
},

// サービス別報酬計算
getServiceCommission(serviceId) {
  return this.commissions
    .filter(c => c.service_id === serviceId)
    .reduce((sum, c) => sum + c.amount, 0);
}
```

### 7.2 各サービスのフロントエンド

#### 7.2.1 トラッキングリダイレクト実装

**必須機能**: 各サービスのドメインに `/t/:code` エンドポイントを実装

##### Next.js の場合（TaskMate AI）

```typescript
// app/t/[code]/page.tsx
import { redirect } from 'next/navigation';

export default async function TrackingRedirect({
  params
}: {
  params: { code: string }
}) {
  const { code } = params;

  try {
    // トラッキングAPI呼び出し
    const response = await fetch(
      `https://api.platform.com/.netlify/functions/track-redirect?code=${code}`,
      {
        headers: {
          'X-Forwarded-For': headers().get('x-forwarded-for') || '',
          'User-Agent': headers().get('user-agent') || ''
        }
      }
    );

    const data = await response.json();

    // リダイレクト先（サービス情報から取得）
    const redirectUrl = data.redirect_url || '/app';

    redirect(redirectUrl);
  } catch (error) {
    console.error('Tracking error:', error);
    redirect('/app'); // エラー時はアプリトップへ
  }
}
```

##### 静的HTML の場合（Service B）

```html
<!-- newservice.com/t/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>リダイレクト中...</title>
  <script>
    // URLから tracking_code 取得
    const pathParts = window.location.pathname.split('/');
    const trackingCode = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

    if (trackingCode && trackingCode !== 't') {
      // トラッキングAPI呼び出し
      fetch(`https://api.platform.com/.netlify/functions/track-redirect?code=${trackingCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          visitor_ip: '', // バックエンドで取得
          user_agent: navigator.userAgent,
          referrer: document.referrer
        })
      })
      .then(res => res.json())
      .then(data => {
        // リダイレクト
        window.location.href = data.redirect_url || '/';
      })
      .catch(err => {
        console.error('Tracking error:', err);
        window.location.href = '/';
      });
    } else {
      window.location.href = '/';
    }
  </script>
</head>
<body>
  <div style="text-align: center; padding: 50px;">
    <p>リダイレクト中...</p>
  </div>
</body>
</html>
```

#### 7.2.2 トラッキングAPIエンドポイント

```javascript
// netlify/functions/track-redirect.js
exports.handler = async (event) => {
  const trackingCode = event.queryStringParameters?.code;

  if (!trackingCode) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing tracking code' })
    };
  }

  try {
    // 1. トラッキングリンク検索
    const { data: link, error: linkError } = await supabase
      .from('agency_tracking_links')
      .select('id, agency_id, service_id')
      .eq('tracking_code', trackingCode)
      .single();

    if (linkError || !link) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Tracking link not found' })
      };
    }

    // 2. サービス情報取得
    const { data: service } = await supabase
      .from('services')
      .select('app_redirect_url')
      .eq('id', link.service_id)
      .single();

    // 3. 訪問記録
    const visitorIp = event.headers['x-forwarded-for'] || event.headers['client-ip'];
    const userAgent = event.headers['user-agent'];
    const sessionId = generateSessionId();

    await supabase
      .from('agency_tracking_visits')
      .insert({
        tracking_link_id: link.id,
        agency_id: link.agency_id,
        service_id: link.service_id,  // ← サービスID記録
        visitor_ip: visitorIp,
        user_agent: userAgent,
        session_id: sessionId,
        // ...
      });

    // 4. visit_count インクリメント
    await supabase
      .from('agency_tracking_links')
      .update({
        visit_count: supabase.raw('visit_count + 1')
      })
      .eq('id', link.id);

    // 5. リダイレクト先URL返却
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        redirect_url: service?.app_redirect_url || '/',
        session_id: sessionId
      })
    };

  } catch (error) {
    console.error('Tracking error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

---

## 8. デプロイ・インフラ設計

### 8.1 ドメイン設定

#### 8.1.1 Netlify Site構成（推奨パターン）

```
Site 1: 代理店管理 + 共通API
├─ Domain: agency.platform.com
├─ Functions: /.netlify/functions/*
├─ Deploy: netlify-tracking/
└─ 役割: 代理店ダッシュボード + 全API

Site 2: TaskMate AI
├─ Domain: taskmateai.net
├─ Deploy: taskmate-ai/
├─ API呼び出し: agency.platform.com/.netlify/functions/*
└─ 役割: TaskMate アプリ + トラッキングリダイレクト

Site 3: Service B
├─ Domain: newservice.com
├─ Deploy: service-b/
├─ API呼び出し: agency.platform.com/.netlify/functions/*
└─ 役割: Service B アプリ + トラッキングリダイレクト
```

**メリット**:
- 各サービス完全独立
- API は1箇所で管理
- デプロイも独立

#### 8.1.2 DNS設定

```
# 代理店管理
agency.platform.com  →  Netlify Site 1

# TaskMate AI
taskmateai.net       →  Netlify Site 2
www.taskmateai.net   →  taskmateai.net (CNAME)

# Service B
newservice.com       →  Netlify Site 3
www.newservice.com   →  newservice.com (CNAME)
```

### 8.2 環境変数管理

#### 8.2.1 代理店管理サイト（Site 1）

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT
JWT_SECRET=xxx

# CORS（カンマ区切り）
ALLOWED_ORIGINS=https://agency.platform.com,https://taskmateai.net,https://newservice.com
```

**重要**: LINE認証情報は**環境変数に入れない**（DBから動的取得）

#### 8.2.2 各サービスサイト（Site 2, 3...）

```bash
# トラッキングAPI URL
TRACKING_API_URL=https://agency.platform.com/.netlify/functions

# サービス固有の設定（必要に応じて）
```

### 8.3 Netlify設定ファイル

#### 8.3.1 代理店管理サイト（netlify.toml）

```toml
[build]
  publish = "netlify-tracking/agency"
  functions = "netlify-tracking/netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Headers = "Content-Type, Authorization, X-Agency-Id, X-Line-Signature"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
```

#### 8.3.2 TaskMate AIサイト（netlify.toml）

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[redirects]]
  from = "/t/:code"
  to = "/t/[code]"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 8.4 LINE Developers設定

#### 各サービスのWebhook URL設定

```
TaskMate AI:
└─ Webhook URL: https://agency.platform.com/.netlify/functions/line-webhook?service=taskmate

Service B:
└─ Webhook URL: https://agency.platform.com/.netlify/functions/line-webhook?service=serviceb

Service C:
└─ Webhook URL: https://agency.platform.com/.netlify/functions/line-webhook?service=servicec
```

**注意**: `service` パラメータはサービス識別用（name またはslug）

---

## 9. マイグレーション計画

### 9.1 マイグレーション手順

#### Phase 1: データベース準備

```sql
-- Step 1: 新規テーブル作成
\i 001_create_services_table.sql
\i 002_create_agency_service_settings_table.sql
\i 003_create_line_profile_services_table.sql

-- Step 2: 既存テーブルにカラム追加
ALTER TABLE agency_tracking_links ADD COLUMN service_id UUID;
ALTER TABLE agency_tracking_visits ADD COLUMN service_id UUID;
ALTER TABLE agency_conversions ADD COLUMN service_id UUID;
ALTER TABLE agency_commissions ADD COLUMN service_id UUID;

-- Step 3: インデックス作成
CREATE INDEX idx_agency_tracking_links_service ON agency_tracking_links(service_id);
CREATE INDEX idx_agency_tracking_visits_service ON agency_tracking_visits(service_id);
CREATE INDEX idx_agency_conversions_service ON agency_conversions(service_id);
CREATE INDEX idx_agency_commissions_service ON agency_commissions(service_id);
```

#### Phase 2: TaskMate AI登録とデータ移行

```sql
-- Step 1: TaskMate AI をサービスとして登録
INSERT INTO services (
  id,
  name,
  description,
  domain,
  tracking_base_url,
  app_redirect_url,
  line_channel_id,
  line_channel_secret,
  line_channel_access_token,
  line_official_url,
  default_commission_rate,
  default_referral_rate,
  subscription_price,
  status
) VALUES (
  'b5e8f3c2-1a4d-4e9b-8f6a-2c3d4e5f6a7b',  -- 固定UUID
  'TaskMate AI',
  'AI搭載のタスク管理アシスタント',
  'taskmateai.net',
  'https://taskmateai.net/t',
  'https://taskmateai.net/app',
  '${LINE_CHANNEL_ID}',      -- 環境変数から取得
  '${LINE_CHANNEL_SECRET}',
  '${LINE_ACCESS_TOKEN}',
  'https://lin.ee/FMy4xlx',
  20.00,
  2.00,
  10000,
  'active'
);

-- Step 2: 既存データに service_id を設定
UPDATE agency_tracking_links
SET service_id = 'b5e8f3c2-1a4d-4e9b-8f6a-2c3d4e5f6a7b'
WHERE service_id IS NULL;

UPDATE agency_tracking_visits
SET service_id = 'b5e8f3c2-1a4d-4e9b-8f6a-2c3d4e5f6a7b'
WHERE service_id IS NULL;

UPDATE agency_conversions
SET service_id = 'b5e8f3c2-1a4d-4e9b-8f6a-2c3d4e5f6a7b'
WHERE service_id IS NULL;

UPDATE agency_commissions
SET service_id = 'b5e8f3c2-1a4d-4e9b-8f6a-2c3d4e5f6a7b'
WHERE service_id IS NULL;

-- Step 3: NOT NULL 制約追加
ALTER TABLE agency_tracking_links ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE agency_tracking_visits ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE agency_conversions ALTER COLUMN service_id SET NOT NULL;
ALTER TABLE agency_commissions ALTER COLUMN service_id SET NOT NULL;

-- Step 4: 既存代理店にデフォルト設定を作成
INSERT INTO agency_service_settings (agency_id, service_id, is_active)
SELECT
  id AS agency_id,
  'b5e8f3c2-1a4d-4e9b-8f6a-2c3d4e5f6a7b' AS service_id,
  true AS is_active
FROM agencies
WHERE status = 'active';
```

#### Phase 3: バックエンドAPI修正

```
修正対象ファイル（推定15ファイル）:
✅ line-webhook.js
✅ track-redirect.js
✅ agency-create-link.js
✅ agency-stats.js
✅ agency-analytics.js
✅ agency-commissions.js
✅ agency-billing-stats.js
✅ agency-link-visits.js
✅ agency-referral-users.js
... その他

修正内容:
1. service_id パラメータの追加
2. WHERE句に service_id 条件追加
3. サービス情報の動的取得
```

#### Phase 4: フロントエンド修正

```
修正対象ファイル:
✅ dashboard.js
   - services 配列追加
   - selectedServiceId 追加
   - loadServices() 実装
   - 全API呼び出しにservice_idパラメータ追加

✅ index.html
   - サービス選択UI追加
   - サービスバッジ表示
   - サービス別色分け
```

#### Phase 5: テストとデプロイ

```
1. ローカル環境でテスト
   ✅ 既存機能が動作するか（TaskMate AI）
   ✅ サービスフィルタが動作するか

2. ステージング環境デプロイ
   ✅ 既存データの整合性確認
   ✅ 全API動作確認

3. 本番環境デプロイ
   ✅ ダウンタイムなしでデプロイ
   ✅ 既存代理店への影響なし確認
```

### 9.2 ロールバック計画

```sql
-- 緊急ロールバック用SQL

-- Step 1: NOT NULL制約削除
ALTER TABLE agency_tracking_links ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE agency_tracking_visits ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE agency_conversions ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE agency_commissions ALTER COLUMN service_id DROP NOT NULL;

-- Step 2: service_id カラム削除（最終手段）
-- ALTER TABLE agency_tracking_links DROP COLUMN service_id;
-- ALTER TABLE agency_tracking_visits DROP COLUMN service_id;
-- ALTER TABLE agency_conversions DROP COLUMN service_id;
-- ALTER TABLE agency_commissions DROP COLUMN service_id;

-- Step 3: 新規テーブル削除（最終手段）
-- DROP TABLE line_profile_services;
-- DROP TABLE agency_service_settings;
-- DROP TABLE services;
```

---

## 10. 実装チェックリスト

### 10.1 データベース

- [ ] `services` テーブル作成
- [ ] `agency_service_settings` テーブル作成
- [ ] `line_profile_services` テーブル作成
- [ ] 既存テーブルに `service_id` カラム追加（4テーブル）
- [ ] インデックス作成（8個）
- [ ] TaskMate AI データ登録
- [ ] 既存データに `service_id` 設定
- [ ] NOT NULL 制約追加
- [ ] 既存代理店にデフォルト設定作成

### 10.2 バックエンドAPI

- [ ] `line-webhook.js` - サービス動的取得、署名検証修正
- [ ] `track-redirect.js` - service_id 記録
- [ ] `agency-create-link.js` - サービス選択対応
- [ ] `agency-stats.js` - サービスフィルタ追加
- [ ] `agency-analytics.js` - サービスフィルタ追加
- [ ] `agency-commissions.js` - サービス別報酬計算
- [ ] `agency-billing-stats.js` - サービスフィルタ追加
- [ ] `agency-link-visits.js` - サービスフィルタ追加
- [ ] `agency-referral-users.js` - サービスフィルタ追加
- [ ] **新規** `agency-services.js` - サービス一覧API
- [ ] 全API関数の CORS 設定更新

### 10.3 フロントエンド（代理店ダッシュボード）

- [ ] `dashboard.js` - services, selectedServiceId 追加
- [ ] `dashboard.js` - loadServices() 実装
- [ ] `dashboard.js` - 全データ取得にフィルタ適用
- [ ] `index.html` - サービス選択UIheader追加
- [ ] `index.html` - リンク作成タブにサービス選択追加
- [ ] `index.html` - リンク一覧にサービスバッジ追加
- [ ] `index.html` - Analyticsタブにサービスフィルタ追加
- [ ] `index.html` - 報酬タブにサービス別内訳追加

### 10.4 各サービスフロントエンド

- [ ] TaskMate AI - `/t/[code]` リダイレクト実装
- [ ] Service B - `/t/:code` リダイレクト実装（将来）

### 10.5 インフラ・デプロイ

- [ ] Netlify Site 1（代理店管理）ドメイン設定
- [ ] Netlify Site 2（TaskMate）ドメイン設定
- [ ] DNS レコード設定
- [ ] SSL証明書設定
- [ ] 環境変数設定（各サイト）
- [ ] LINE Developers Webhook URL設定（各サービス）

### 10.6 テスト

- [ ] 既存機能回帰テスト
- [ ] サービスフィルタリング動作確認
- [ ] トラッキングリンク生成・記録テスト
- [ ] Webhook受信テスト（各サービス）
- [ ] 報酬計算テスト（サービス別報酬率）
- [ ] CORS動作確認

---

## 11. リスク分析

### 11.1 技術リスク

| リスク | 影響度 | 発生確率 | 対策 |
|-------|-------|---------|------|
| 既存データ移行失敗 | 高 | 低 | バックアップ取得、ロールバック計画策定 |
| LINE署名検証エラー | 高 | 中 | サービスごとの検証ロジックテスト強化 |
| CORS設定ミス | 中 | 中 | 許可ドメインリスト明確化、テスト |
| パフォーマンス劣化 | 中 | 低 | インデックス最適化、クエリ最適化 |
| service_id NULL残存 | 高 | 低 | NOT NULL制約前の完全チェック |

### 11.2 運用リスク

| リスク | 影響度 | 発生確率 | 対策 |
|-------|-------|---------|------|
| 代理店の混乱 | 中 | 中 | 事前通知、操作ガイド作成 |
| LINE Webhook設定ミス | 高 | 中 | 設定チェックリスト、テストアカウント |
| 報酬計算ミス | 高 | 低 | 計算ロジック二重チェック、テストケース |
| サービス追加時の設定漏れ | 中 | 中 | チェックリスト、自動化 |

### 11.3 ビジネスリスク

| リスク | 影響度 | 発生確率 | 対策 |
|-------|-------|---------|------|
| 複雑化による保守コスト増 | 中 | 高 | ドキュメント整備、コード標準化 |
| スケール時のパフォーマンス | 中 | 中 | 定期的なパフォーマンステスト |

---

## 12. 付録

### 12.1 用語集

| 用語 | 定義 |
|-----|------|
| サービス | LINE公式アカウントを持つ独立したプロダクト（例: TaskMate AI） |
| 代理店 | サービスを紹介してコミッションを得るパートナー |
| トラッキングリンク | 代理店が生成する計測用URL |
| コンバージョン | LINE友達追加または課金登録 |
| 報酬率 | コンバージョンに対する代理店のコミッション率 |
| リファラル報酬 | 傘下代理店の成果に対する報酬 |

### 12.2 想定FAQ

**Q1: 既存の代理店に影響はありますか？**
A: ありません。既存データは自動的にTaskMate AIサービスに紐付けられます。

**Q2: 新しいサービスを追加する手順は？**
A:
1. Supabase の `services` テーブルに1レコード追加
2. 各サービスのドメインに `/t/:code` リダイレクト実装
3. LINE Developers でWebhook URL設定

**Q3: サービスごとに報酬率を変えられますか？**
A: はい。`agency_service_settings` で代理店×サービスごとに設定可能です。

**Q4: 既存のトラッキングリンクは使えますか？**
A: はい。すべてTaskMate AIサービスとして動作します。

**Q5: 代理店は複数のサービスを同時に扱えますか？**
A: はい。1つのダッシュボードで全サービスを管理できます。

### 12.3 参考資料

- [LINE Messaging API Documentation](https://developers.line.biz/ja/docs/messaging-api/)
- [Supabase Documentation](https://supabase.com/docs)
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)

---

## 変更履歴

| バージョン | 日付 | 変更内容 | 作成者 |
|----------|------|---------|-------|
| 1.0 | 2025-01-21 | 初版作成 | Claude Code |

---

**設計書終了**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
