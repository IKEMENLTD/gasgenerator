# 代理店ダッシュボード 独立ドメイン移行 完全設計書

**作成日**: 2025-10-22
**対象**: TaskMate AI 代理店管理システム
**目的**: taskmateai.net → 別ドメインのサブドメインへの移行

---

## 📋 目次

1. [移行概要](#1-移行概要)
2. [現状と課題](#2-現状と課題)
3. [移行後のアーキテクチャ](#3-移行後のアーキテクチャ)
4. [ドメイン設計](#4-ドメイン設計)
5. [Netlifyサイト構成](#5-netlifyサイト構成)
6. [DNS設定](#6-dns設定)
7. [環境変数設定](#7-環境変数設定)
8. [コード修正](#8-コード修正)
9. [デプロイ手順](#9-デプロイ手順)
10. [動作確認](#10-動作確認)
11. [移行チェックリスト](#11-移行チェックリスト)

---

## 1. 移行概要

### 1.1 移行の目的

**現在の問題**:
- 代理店ダッシュボードが TaskMate AI のメインドメイン（taskmateai.net）で動作
- ブランディングの混在（TaskMate アプリと代理店管理が同じドメイン）
- 将来的に複数サービスを管理する際に拡張困難

**移行後のメリット**:
- ✅ 代理店プログラムを独立したドメインで運用
- ✅ TaskMate AI と完全に分離されたブランディング
- ✅ 将来的に複数サービスの代理店管理に対応可能
- ✅ SEO的にも明確な分離

### 1.2 移行方針

**移行タイプ**: **完全分離型**

- 代理店ダッシュボード: 別ドメインのサブドメイン
- バックエンドAPI: 代理店ダッシュボードと同じサイト
- TaskMate AI: 現在のドメインを維持

**ダウンタイム**: **ゼロダウンタイム移行**

1. 新ドメインで新サイトを構築
2. 完全にテスト
3. DNS切り替えで瞬時に移行

---

## 2. 現状と課題

### 2.1 現在のアーキテクチャ

```
taskmateai.net (Netlify Site)
├─ / (ルート)
│   └─ TaskMate AI メインサイト
├─ /agency (代理店ダッシュボード) ← 現在ここ
│   ├─ /agency/index.html
│   ├─ /agency/dashboard.js
│   └─ /agency/privacy.html
└─ /.netlify/functions/ (バックエンドAPI)
    ├─ line-webhook.js
    ├─ agency-auth.js
    ├─ agency-stats.js
    └─ ... (31個のfunctions)
```

**課題**:
- ❌ TaskMate と代理店が同じドメイン
- ❌ `/agency` というパスが必要（ルートにできない）
- ❌ CORS設定が複雑
- ❌ 将来的な拡張が困難

### 2.2 現在のファイル構成

```
gas-generator/
├─ netlify-tracking/            ← 代理店プログラム
│   ├─ agency/                  ← フロントエンド
│   │   ├─ index.html
│   │   ├─ dashboard.js
│   │   ├─ privacy.html
│   │   ├─ terms.html
│   │   └─ reset-password.html
│   ├─ netlify/
│   │   └─ functions/           ← バックエンドAPI (31個)
│   └─ netlify.toml
└─ app/                          ← TaskMate AI (Next.js)
```

---

## 3. 移行後のアーキテクチャ

### 3.1 全体構成

```
┌──────────────────────────────────────────────────┐
│           Supabase（共通データベース）            │
│  - agencies（代理店マスター）                    │
│  - agency_tracking_links（トラッキングリンク）  │
│  - agency_conversions（コンバージョン）          │
│  - line_profiles（LINEユーザー）                │
└──────────────────────────────────────────────────┘
                         ↑
          ┌──────────────┼──────────────┐
          │              │              │
          ↓              ↓              ↓
┌─────────────────┐  ┌────────────┐  ┌────────────┐
│ 代理店管理      │  │ TaskMate   │  │ 将来の     │
│ ダッシュボード  │  │ AI         │  │ サービスB  │
├─────────────────┤  ├────────────┤  ├────────────┤
│ Domain:         │  │ Domain:    │  │ Domain:    │
│ agency.         │  │ taskmateai │  │ serviceb   │
│ yoursite.com    │  │ .net       │  │ .com       │
├─────────────────┤  ├────────────┤  ├────────────┤
│ Netlify Site 1  │  │ Netlify    │  │ Netlify    │
│ (新規作成)      │  │ Site 2     │  │ Site 3     │
│                 │  │ (既存)     │  │ (将来)     │
├─────────────────┤  └────────────┘  └────────────┘
│ フロントエンド: │
│ - ダッシュボード│
│ - リンク生成UI  │
│ - 統計表示      │
│                 │
│ バックエンド:   │
│ - 31 Functions  │
│ - LINE Webhook  │
│ - トラッキング  │
│ - 認証・統計    │
└─────────────────┘
```

### 3.2 データフロー

```
1. LINE友達追加
   LINE → agency.yoursite.com/.netlify/functions/line-webhook
   → Supabase (コンバージョン記録)

2. トラッキングリンク
   代理店 → agency.yoursite.com (リンク生成)
   ユーザー → taskmateai.net/t/abc123 (クリック)
   → agency.yoursite.com/.netlify/functions/track-redirect (訪問記録)
   → Supabase → リダイレクト

3. 統計表示
   代理店 → agency.yoursite.com/dashboard
   → agency.yoursite.com/.netlify/functions/agency-stats
   → Supabase → レスポンス
```

---

## 4. ドメイン設計

### 4.1 推奨ドメイン構成

**パターン1: 独自ドメイン + サブドメイン（推奨）**

```
例: あなたの会社ドメインが "example.com" の場合

agency.example.com       → 代理店ダッシュボード
api.example.com          → (オプション) APIエイリアス
```

**パターン2: 完全独立ドメイン**

```
例: 代理店専用ドメインを取得

agency-platform.com      → 代理店ダッシュボード
```

**パターン3: 既存ドメインのサブドメイン**

```
例: TaskMate AIのサブドメインを使用（非推奨）

agency.taskmateai.net    → 代理店ダッシュボード
```

### 4.2 URL構成（移行後）

**代理店ダッシュボード（新ドメイン）**:
```
https://agency.yoursite.com/
├─ /                              ログイン画面
├─ /dashboard                     ダッシュボード（リダイレクト）
├─ /privacy                       プライバシーポリシー
├─ /terms                         利用規約
├─ /reset-password                パスワードリセット
└─ /.netlify/functions/           バックエンドAPI
    ├─ line-webhook               LINE Webhook受信
    ├─ track-redirect             トラッキング記録
    ├─ agency-auth                認証
    ├─ agency-stats               統計取得
    └─ ... (31個のfunctions)
```

**TaskMate AI（既存ドメイン）**:
```
https://taskmateai.net/
├─ /                              メインサイト
├─ /app                           アプリ
└─ /t/:code                       トラッキングリダイレクト
```

---

## 5. Netlifyサイト構成

### 5.1 新規Netlifyサイト（Site 1）

**サイト名**: `agency-dashboard` (または任意)

**設定**:
```
Site settings:
├─ Site name: agency-dashboard
├─ Custom domain: agency.yoursite.com
├─ HTTPS: Enabled (自動)
└─ Deploy settings:
    ├─ Repository: github.com/IKEMENLTD/gasgenerator
    ├─ Branch: main
    ├─ Base directory: netlify-tracking
    ├─ Build command: echo 'Build complete'
    ├─ Publish directory: . (netlify-trackingのルート)
    └─ Functions directory: netlify/functions
```

### 5.2 既存Netlifyサイト（Site 2）

**サイト名**: `taskmateai` (既存)

**設定**: 変更なし（TaskMate AIのまま運用）

### 5.3 リポジトリ構成

**変更不要**: 既存の git リポジトリをそのまま使用

```
github.com/IKEMENLTD/gasgenerator
├─ netlify-tracking/     ← Site 1 (agency.yoursite.com)
└─ app/                  ← Site 2 (taskmateai.net)
```

---

## 6. DNS設定

### 6.1 DNSレコード設定

**あなたのドメインの DNS管理画面**（例: Cloudflare, お名前.com, Route53）で以下を設定:

#### 新規サブドメイン（agency.yoursite.com）

```
Type: CNAME
Name: agency
Value: agency-dashboard.netlify.app
TTL: Auto または 3600
```

**または Aレコード** (Netlifyの負荷分散IP):

```
Type: A
Name: agency
Value: 75.2.60.5
TTL: 3600
```

**AAAA レコード** (IPv6):

```
Type: AAAA
Name: agency
Value: 2600:1901:0:1::7
TTL: 3600
```

### 6.2 SSL証明書

**Netlify自動SSL**:
- DNS設定後、Netlify が自動的に Let's Encrypt 証明書を発行
- 通常 5〜10分で完了
- `https://agency.yoursite.com` でアクセス可能になる

### 6.3 DNS伝播確認

```bash
# DNS伝播確認
dig agency.yoursite.com

# 期待される結果:
# agency.yoursite.com. 3600 IN CNAME agency-dashboard.netlify.app.
# agency-dashboard.netlify.app. 20 IN A 75.2.60.5
```

**オンラインツール**:
- https://dnschecker.org/
- https://www.whatsmydns.net/

---

## 7. 環境変数設定

### 7.1 Netlify環境変数（Site 1: agency.yoursite.com）

**Netlify Dashboard** → **Site settings** → **Environment variables** で設定:

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# LINE (TaskMate AI)
LINE_CHANNEL_SECRET=xxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
LINE_OFFICIAL_URL=https://lin.ee/FMy4xlx

# JWT認証
JWT_SECRET=your-secret-key-here

# CORS設定（カンマ区切り）
ALLOWED_ORIGINS=https://agency.yoursite.com,https://taskmateai.net

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Render Webhook転送（オプション）
RENDER_WEBHOOK_URL=https://gasgenerator.onrender.com/api/webhook

# Netlify Webhook転送（オプション）
NETLIFY_WEBHOOK_URL=https://agency.yoursite.com/.netlify/functions/line-webhook
```

### 7.2 環境変数の取得方法

**現在の環境変数を確認**:

1. `.env.local` ファイルを確認（gas-generator/app/.env.local）
2. または Netlify Dashboard → taskmateai → Environment variables で確認

**重要**: 以下の環境変数は必須:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `JWT_SECRET`

---

## 8. コード修正

### 8.1 修正が必要なファイル

#### ❌ 修正不要なファイル（ゼロ）

**理由**: すべてのコードは環境変数とSupabaseを使用しているため、ドメイン依存の箇所なし

#### ✅ 確認が必要な設定ファイル（1ファイル）

**netlify-tracking/netlify.toml**:

現在の設定を確認:

```toml
[build]
  publish = "."
  functions = "netlify/functions"
  command = "echo 'Build complete'"

[build.environment]
  NODE_VERSION = "18"

# SPA routing - すべてのルートを index.html に
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# CORS ヘッダー
[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Headers = "Content-Type, X-Line-Signature"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
```

**変更不要**: このまま使用できます ✅

### 8.2 ハードコードされたURL確認

念のため、ハードコードされたURLがないか確認:

```bash
# 検索コマンド
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking
grep -r "taskmateai.net" agency/
grep -r "taskmateai.net" netlify/functions/
```

**期待される結果**: マッチなし

もし見つかった場合は、環境変数または相対パスに修正。

---

## 9. デプロイ手順

### 9.1 Netlify新規サイト作成

#### Step 1: Netlifyダッシュボードにログイン

https://app.netlify.com/

#### Step 2: 新規サイト作成

1. **「Add new site」** → **「Import an existing project」** をクリック
2. **「GitHub」** を選択
3. **リポジトリ選択**: `IKEMENLTD/gasgenerator` を選択
4. **ビルド設定**:
   ```
   Base directory: netlify-tracking
   Build command: echo 'Build complete'
   Publish directory: .  (または空欄)
   Functions directory: netlify/functions
   ```
5. **「Deploy site」** をクリック

#### Step 3: サイト名変更（オプション）

1. **Site settings** → **General** → **Site details**
2. **「Change site name」** をクリック
3. 新しいサイト名を入力（例: `agency-dashboard`）
4. **Save**

#### Step 4: カスタムドメイン設定

1. **Site settings** → **Domain management** → **Domains**
2. **「Add custom domain」** をクリック
3. ドメインを入力: `agency.yoursite.com`
4. **「Verify」** をクリック
5. DNS設定の指示に従う（Section 6参照）
6. DNS伝播を待つ（5〜30分）
7. **「Verify DNS configuration」** をクリック
8. SSL証明書が自動発行される（5〜10分）

#### Step 5: 環境変数設定

1. **Site settings** → **Environment variables**
2. **「Add a variable」** をクリック
3. Section 7.1 の環境変数をすべて追加

**重要**: すべての環境変数を追加するまでデプロイしない

#### Step 6: 再デプロイ

1. **Deploys** タブ
2. **「Trigger deploy」** → **「Deploy site」**
3. デプロイログを確認
4. **「Published」** になったら完了

### 9.2 LINE Webhook URL変更

#### LINE Developers Console

1. https://developers.line.biz/console/ にアクセス
2. TaskMate AI のチャネルを選択
3. **「Messaging API」** タブ
4. **「Webhook URL」** を変更:

   **変更前**:
   ```
   https://taskmateai.net/.netlify/functions/line-webhook
   ```

   **変更後**:
   ```
   https://agency.yoursite.com/.netlify/functions/line-webhook
   ```

5. **「Update」** をクリック
6. **「Verify」** ボタンをクリックして動作確認

**期待される結果**: `Success` と表示される

### 9.3 Stripe Webhook URL変更（該当する場合）

#### Stripe Dashboard

1. https://dashboard.stripe.com/ にアクセス
2. **「Developers」** → **「Webhooks」**
3. 既存のWebhook エンドポイントを編集:

   **変更前**:
   ```
   https://taskmateai.net/.netlify/functions/stripe-webhook
   ```

   **変更後**:
   ```
   https://agency.yoursite.com/.netlify/functions/stripe-webhook
   ```

4. **「Update endpoint」** をクリック

---

## 10. 動作確認

### 10.1 基本動作確認チェックリスト

#### ✅ フロントエンド

```
□ https://agency.yoursite.com/ にアクセスできる
□ ログイン画面が表示される
□ HTTPSが有効（鍵マーク）
□ プライバシーポリシーページが表示される
□ 利用規約ページが表示される
```

#### ✅ 認証

```
□ 既存の代理店アカウントでログインできる
□ ログイン後、ダッシュボードが表示される
□ 代理店情報（名前、コードなど）が正しく表示される
```

#### ✅ トラッキングリンク

```
□ 新しいトラッキングリンクを作成できる
□ 生成されたURLが正しい（taskmateai.net/t/xxxxx）
□ リンク一覧が表示される
□ リンクをクリックしてアクセスカウントが増える
```

#### ✅ LINE Webhook

```
□ LINE公式アカウントに友達追加する
□ コンバージョンが記録される
□ LINE名がダッシュボードに表示される
□ 「訪問履歴」タブでLINE名が表示される
```

#### ✅ 統計・分析

```
□ Analyticsタブで統計が表示される
□ パフォーマンスチャートが表示される
□ CVファネルが表示される
□ トップキャンペーンが表示される
```

#### ✅ 報酬管理

```
□ 報酬タブで報酬履歴が表示される
□ 今月の報酬額が表示される
□ 累計報酬額が表示される
```

### 10.2 詳細動作確認

#### Test 1: 新規トラッキングリンク生成

1. ダッシュボードにログイン
2. 「リンク作成」タブ
3. リンク名: `テスト`、UTM Campaign: `test` を入力
4. 「リンクを作成」をクリック
5. 生成されたURLを確認: `https://taskmateai.net/t/xxxxx`
6. URLをブラウザで開く
7. TaskMate AIのアプリにリダイレクトされる ✅
8. ダッシュボードの「訪問履歴」でアクセスが記録されている ✅

#### Test 2: LINE友達追加コンバージョン

1. 上記のトラッキングリンクをクリック
2. TaskMate AIのLINE友達追加ボタンをクリック
3. LINE友達追加を完了
4. ダッシュボードの「課金状況」タブ
5. 新しいコンバージョンが表示される ✅
6. LINE名が表示される ✅

#### Test 3: 統計表示

1. 「Analytics」タブ
2. 「期間別パフォーマンスチャート」が表示される ✅
3. 「CVファネル」が表示される ✅
4. クリック数、コンバージョン数が正しい ✅

### 10.3 トラブルシューティング

#### 問題1: ログインできない

**症状**: ログインボタンをクリックしても何も起こらない

**原因**: 環境変数 `JWT_SECRET` が未設定

**解決策**:
1. Netlify Dashboard → Environment variables
2. `JWT_SECRET` を追加
3. 再デプロイ

#### 問題2: LINE Webhookが動作しない

**症状**: 友達追加してもコンバージョンが記録されない

**原因チェック**:
1. LINE Developers Console で Webhook URL が正しいか確認
2. Netlify Function Logs で LINE Webhook のログを確認
3. 環境変数 `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` が正しいか確認

**Netlify Function Logs確認方法**:
```
Netlify Dashboard
→ Functions
→ line-webhook
→ 最新のログを確認
```

**期待されるログ**:
```
📤 [v2.0] Forwarding to Render TaskMate AI
✅ Render forward successful
```

#### 問題3: CORS エラー

**症状**: ブラウザコンソールに `CORS policy` エラー

**原因**: `ALLOWED_ORIGINS` 環境変数が未設定または間違っている

**解決策**:
1. Netlify Dashboard → Environment variables
2. `ALLOWED_ORIGINS` を追加または修正:
   ```
   https://agency.yoursite.com,https://taskmateai.net
   ```
3. 再デプロイ

#### 問題4: 統計が表示されない

**症状**: Analytics タブが空白

**原因**: Supabase接続エラーまたは環境変数ミス

**確認**:
1. ブラウザコンソールでエラーを確認
2. Netlify Function Logs で `agency-stats` のログを確認
3. 環境変数 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` を確認

---

## 11. 移行チェックリスト

### 11.1 準備フェーズ

- [ ] 新しいドメインを決定（例: agency.yoursite.com）
- [ ] 既存の環境変数をすべて記録（.env.local または Netlify）
- [ ] Supabase アクセス確認
- [ ] LINE Developers Console アクセス確認
- [ ] Stripe Dashboard アクセス確認（該当する場合）

### 11.2 Netlifyサイト作成フェーズ

- [ ] Netlifyで新規サイトを作成
- [ ] リポジトリを接続（IKEMENLTD/gasgenerator）
- [ ] Base directory を `netlify-tracking` に設定
- [ ] Functions directory を `netlify/functions` に設定
- [ ] サイト名を変更（例: agency-dashboard）
- [ ] カスタムドメインを追加（例: agency.yoursite.com）

### 11.3 DNS設定フェーズ

- [ ] DNS管理画面にアクセス
- [ ] CNAME レコードを追加（agency → agency-dashboard.netlify.app）
- [ ] DNS伝播を確認（5〜30分待つ）
- [ ] Netlifyで「Verify DNS configuration」を実行
- [ ] SSL証明書が発行されたことを確認（Netlify自動）
- [ ] https://agency.yoursite.com にアクセスできることを確認

### 11.4 環境変数設定フェーズ

- [ ] SUPABASE_URL を設定
- [ ] SUPABASE_ANON_KEY を設定
- [ ] SUPABASE_SERVICE_ROLE_KEY を設定
- [ ] LINE_CHANNEL_SECRET を設定
- [ ] LINE_CHANNEL_ACCESS_TOKEN を設定
- [ ] LINE_OFFICIAL_URL を設定
- [ ] JWT_SECRET を設定
- [ ] ALLOWED_ORIGINS を設定
- [ ] STRIPE_SECRET_KEY を設定（該当する場合）
- [ ] STRIPE_WEBHOOK_SECRET を設定（該当する場合）
- [ ] RENDER_WEBHOOK_URL を設定（オプション）
- [ ] NETLIFY_WEBHOOK_URL を設定（オプション）

### 11.5 デプロイフェーズ

- [ ] Netlify で「Trigger deploy」を実行
- [ ] デプロイログを確認（エラーなし）
- [ ] 31 functions がデプロイされたことを確認
- [ ] https://agency.yoursite.com にアクセスできる
- [ ] ログイン画面が表示される

### 11.6 Webhook URL変更フェーズ

- [ ] LINE Developers Console にアクセス
- [ ] Webhook URL を変更（taskmateai.net → agency.yoursite.com）
- [ ] Webhook URL を Verify して成功確認
- [ ] Stripe Webhook URL を変更（該当する場合）

### 11.7 動作確認フェーズ

- [ ] 既存アカウントでログインできる
- [ ] ダッシュボードが正しく表示される
- [ ] トラッキングリンクを作成できる
- [ ] トラッキングリンクをクリックして訪問記録される
- [ ] LINE友達追加でコンバージョンが記録される
- [ ] 統計が正しく表示される（Analytics タブ）
- [ ] 報酬履歴が表示される
- [ ] 課金状況が表示される

### 11.8 移行完了フェーズ

- [ ] 代理店に新しいURLを通知（agency.yoursite.com）
- [ ] 旧URL（taskmateai.net/agency）にリダイレクト設定（オプション）
- [ ] ドキュメントを更新
- [ ] 移行完了を記録

---

## 12. オプション機能

### 12.1 旧URLからのリダイレクト

**既存のtaskmateai.netサイトに追加**:

taskmateai.netのnetlify.tomlに以下を追加:

```toml
# 代理店ダッシュボードリダイレクト
[[redirects]]
  from = "/agency"
  to = "https://agency.yoursite.com/"
  status = 301
  force = true

[[redirects]]
  from = "/agency/*"
  to = "https://agency.yoursite.com/:splat"
  status = 301
  force = true
```

これで、`https://taskmateai.net/agency` にアクセスすると自動的に `https://agency.yoursite.com/` にリダイレクトされます。

### 12.2 複数ドメイン対応

将来的に複数のドメインで同じダッシュボードにアクセスしたい場合:

**Netlify Dashboard** → **Domain management** で複数のカスタムドメインを追加可能:

```
Primary domain: agency.yoursite.com
Aliases:
  - agency.example.com
  - partners.yoursite.com
```

すべてのドメインで同じダッシュボードにアクセスできます。

### 12.3 Cloudflare統合（オプション）

**メリット**:
- CDN高速化
- DDoS保護
- 詳細なアクセス解析

**設定**:
1. Cloudflare にドメインを追加
2. Cloudflare のネームサーバーに変更
3. DNS設定を Cloudflare で管理
4. Netlify カスタムドメインは同様に設定

---

## 13. まとめ

### 13.1 移行後のURL

**新しいURL**:
```
代理店ダッシュボード: https://agency.yoursite.com/
バックエンドAPI: https://agency.yoursite.com/.netlify/functions/
```

**既存のURL（変更なし）**:
```
TaskMate AI: https://taskmateai.net/
トラッキングリンク: https://taskmateai.net/t/:code
```

### 13.2 メリットまとめ

- ✅ 代理店プログラムが独立したドメインで運用
- ✅ TaskMate AIと完全に分離
- ✅ 将来的に複数サービス対応可能
- ✅ SEO的にも明確な分離
- ✅ 保守性向上（ドメインごとにデプロイ独立）

### 13.3 次のステップ

1. **すぐに実行**: このガイドに従って新ドメインに移行
2. **移行完了後**: 代理店に新URLを通知
3. **将来的**: 複数サービスを追加する際は DESIGN_MULTI_SERVICE_AGENCY_SYSTEM.md を参照

---

**設計書作成完了**

この設計書に従って、taskmateai.net から agency.yoursite.com への移行を安全に実施できます。

質問や問題が発生した場合は、Section 10.3（トラブルシューティング）を参照してください。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
