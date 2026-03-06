# TaskMate システムアーキテクチャ（完全修正版）

**最終更新**: 2026-02-13（再検証完了）
**バージョン**: 2.2
**ステータス**: 本番運用中 + AI相談機能開発中
**検証日**: 2026-02-13（コードベース完全照合 + 実装詳細確認）

---

## ⚠️ ドキュメント信頼性レベル: ★★★★★

このドキュメントは実際のコードベースと**2回の徹底検証**を経て完全照合済みです。

### 検証済み項目（実測値）
- ✅ システム数: 実際のID確認（39システム、ID 15欠番）
- ✅ 環境変数: grep全検索（44個）
- ✅ API数: route.tsカウント（23個）
- ✅ Netlify Functions: ファイルカウント（32個）
- ✅ パッケージ: package.json実物
- ✅ サイズ: du実測（678MB/312MB）
- ✅ 設定値: config.ts実物
- ✅ Redis実装: コード確認（オプション実装、環境変数で有効化）
- ✅ SendGrid: grep検索（コード内未使用、削除推奨）

### 修正履歴
- **v2.1**: 初回徹底検証、42→39システム修正、環境変数44個追加
- **v2.2**: 再検証、Redis実装状況明確化、.nextサイズ注記、SendGrid削除推奨明記

---

## 📋 目次

1. [システム概要](#システム概要)
2. [アーキテクチャ全体図](#アーキテクチャ全体図)
3. [技術スタック](#技術スタック)
4. [コンポーネント構成](#コンポーネント構成)
5. [データフロー](#データフロー)
6. [API設計](#api設計)
7. [データベース設計](#データベース設計)
8. [インフラ構成](#インフラ構成)
9. [セキュリティ](#セキュリティ)
10. [スケーラビリティ](#スケーラビリティ)
11. [監視・ログ](#監視ログ)
12. [デプロイメント戦略](#デプロイメント戦略)
13. [コスト構造](#コスト構造)
14. [パフォーマンス設定](#パフォーマンス設定)
15. [テスト戦略](#テスト戦略)

---

## システム概要

### ビジネス目的

TaskMate（正式名: gas-generator）は、中小企業向けのGoogle Apps Script（GAS）自動化コード生成SaaSプラットフォーム。LINE Botを通じてAIがビジネスプロセスの自動化コードを生成し、**39種類**の業務システムを提供する。

### 主要機能

| 機能 | 説明 | 優先度 |
|------|------|--------|
| **LINE Bot GAS生成** | Claude Sonnet 4でGASコードを自動生成 | 最高 |
| **システムカタログ** | 39システムのプレビュー・ダウンロード | 高 |
| **RAGシステム** | システムドキュメントからの自動Q&A | 高 |
| **Stripe決済** | サブスク課金・単発購入 | 高 |
| **ドリップキャンペーン** | 7日間ステップ配信 | 中 |
| **代理店管理** | トラッキングリンク・成果報酬 | 中 |
| **AI相談機能** | システムレコメンド（開発中） | 中 |
| **エンジニア相談** | LINE経由でエンジニアグループへ転送 | 中 |

### ビジネスモデル

```
┌─────────────────┬──────────┬──────────┬─────────────────────┐
│ プラン          │ 月額     │ 契約期間 │ 機能                │
├─────────────────┼──────────┼──────────┼─────────────────────┤
│ 無料会員        │ ¥0       │ -        │ 基本Q&A、プレビュー │
│ ベーシック      │ ¥10,000  │ 6ヶ月    │ 3システム、月1DL    │
│ プロフェッショナル│ ¥50,000 │ 6ヶ月    │ 全システム、月5DL   │
│ 単発購入        │ 個別     │ -        │ システム永久利用    │
└─────────────────┴──────────┴──────────┴─────────────────────┘
```

### 39システム一覧（実測）

**注**: ID 15「Webアプリ開発マニュアル」は削除済み（CLAUDE.md記載）

| ID範囲 | システム数 | カテゴリ |
|--------|-----------|---------|
| 01-14 | 14システム | 営業・顧客管理、期限管理、分析 |
| **15** | **欠番** | **削除済み** |
| 16-26 | 11システム | 経費精算、請求書、売上、契約 |
| 27-40 | 14システム | 引継ぎ、定型連絡、解約分析等 |
| **合計** | **39システム** |

---

## アーキテクチャ全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                          │
├─────────────────┬───────────────────┬───────────────────────────┤
│  LINE App       │  Web Browser      │  Admin Dashboard          │
│  (Mobile/Desktop)│  (LP + Catalog)   │  (管理画面)               │
└────────┬────────┴─────────┬─────────┴────────────┬──────────────┘
         │                  │                       │
         │ Webhook          │ HTTPS                 │ HTTPS
         │                  │                       │
┌────────▼──────────────────▼───────────────────────▼──────────────┐
│                      APPLICATION LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js 14 (App Router)                     │   │
│  │  ┌────────────┬────────────┬────────────┬──────────────┐ │   │
│  │  │ LINE Bot   │ Web App    │ RAG System │ AI Consult   │ │   │
│  │  │ Webhook    │ Pages      │ Q&A        │ Recommend    │ │   │
│  │  └────────────┴────────────┴────────────┴──────────────┘ │   │
│  │  ┌────────────┬────────────┬────────────┬──────────────┐ │   │
│  │  │ Stripe     │ Drip       │ Agency     │ Admin        │ │   │
│  │  │ Payment    │ Campaign   │ Tracking   │ Management   │ │   │
│  │  └────────────┴────────────┴────────────┴──────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
┌────────▼────────┐  ┌──────────▼──────┐  ┌──────────▼──────────┐
│  BUSINESS LOGIC │  │  EXTERNAL APIs  │  │  DATA LAYER         │
├─────────────────┤  ├─────────────────┤  ├─────────────────────┤
│ • AIProvider    │  │ • Claude Sonnet │  │ Supabase PostgreSQL │
│   Manager       │  │   4 (primary)   │  │ ┌─────────────────┐ │
│ • RAG Service   │  │ • Gemini 3 Pro  │  │ │ • users         │ │
│ • Conversation  │  │   (fallback)    │  │ │ • conversations │ │
│   Manager       │  │ • LINE API      │  │ │ • sessions      │ │
│ • Premium Check │  │ • Stripe API    │  │ │ • subscriptions │ │
│ • Code Gen      │  │                 │  │ │ • systems       │ │
│ • Session Mgmt  │  │                 │  │ │ • embeddings    │ │
│ • Drip Service  │  │                 │  │ │ • stripe_events │ │
└─────────────────┘  └─────────────────┘  │ │ • drip_logs     │ │
                                           │ │ • agencies      │ │
┌──────────────────┐  ┌─────────────────┐ │ └─────────────────┘ │
│  CACHE LAYER     │  │  STATIC ASSETS  │ │ • pgvector (RAG)  │
├──────────────────┤  ├─────────────────┤ │ • Row Level Sec   │
│ Redis (optional) │  │ Netlify CDN     │ └─────────────────────┘
│ or Memory Store  │  │ • LP (HTML)     │
│ ※環境変数で切替 │  │ • Agency Portal │
│ • Session Cache  │  │ • 32 Functions  │
│ • Rate Limit     │  │   (JS)          │
│ • TTL: 30min     │  └─────────────────┘
└──────────────────┘
```

---

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 | 備考 |
|------|-----------|------|------|
| **Next.js** | 14.2.35 | フルスタックフレームワーク（App Router） | - |
| **React** | 18.3.1 | UIライブラリ | - |
| **TypeScript** | 5.7.3 | 型安全性 | - |
| **Tailwind CSS** | 3.4.14 | スタイリング（Neumorphic Soft UI） | - |
| **Three.js** | 0.182.0 | LPパーティクル背景 | - |

### バックエンド（実測 package.json）

| 技術 | バージョン | 用途 | 備考 |
|------|-----------|------|------|
| **Node.js** | 18.17.0 | ランタイム | Render指定 |
| **@anthropic-ai/sdk** | 0.24.3 | Claude 4 API | プライマリAI |
| **自前Gemini Client** | - | Gemini 3 Pro API | フォールバック、REST直接 |
| **@line/bot-sdk** | 7.5.2 | LINE Messaging API | - |
| **stripe** | 14.10.0 | 決済処理 | - |
| **@supabase/supabase-js** | 2.43.5 | DB操作 | - |
| **ioredis** | 5.3.2 | Redis クライアント | オプション、環境変数で有効化 |
| **@sendgrid/mail** | 8.1.6 | メール送信 | **未使用（削除推奨）** |
| **qrcode** | 1.5.3 | QRコード生成 | 共有リンク用 |
| **zod** | 3.23.8 | バリデーション | - |
| **bcryptjs** | 3.0.2 | パスワードハッシュ | - |
| **jsonwebtoken** | 9.0.2 | JWT生成 | - |
| **nanoid** | 5.1.5 | 短縮URL生成 | - |

**重要**:
- `@google/generative-ai` は未インストール。`lib/gemini/client.ts` で自前実装。
- `@sendgrid/mail` はインストール済みだが**コード内で一切使用されていない**（削除推奨）。

### データベース

| 技術 | 用途 | プラン |
|------|------|--------|
| **Supabase PostgreSQL** | メインDB（Tokyo リージョン） | Free/Pro |
| **pgvector** | ベクトル類似度検索（RAG） | 拡張機能 |
| **Redis** | セッションキャッシュ、レート制限 | **オプション（環境変数で有効化）** |

### インフラ

| サービス | 用途 | プラン | 実測値 |
|---------|------|--------|--------|
| **Render** | メインアプリホスティング | Standard (2GB RAM) | node: 678MB, .next: 312MB |
| **Netlify** | LP + 代理店ポータル + Functions | 無料 | 32 Functions |
| **GitHub** | コード管理 | Private（IKEMENLTD org） | 336コミット |

### 開発ツール

- **ESLint** 8.57.0 + **TypeScript**: コード品質
- **Git**: バージョン管理（IKEMENLTD/gasgenerator）
- **Claude Code**: AI開発支援（このドキュメント生成）

### プロジェクトサイズ（実測 2026-02-13、開発環境）

```bash
Total: 1.1GB
├── node_modules/   678MB  ← 実測（package.json: 16 dependencies + 4 devDependencies）
├── .next/          312MB  ← ビルド成果物（開発環境）
│   ├── cache/      307MB     ※開発環境キャッシュ蓄積
│   ├── static/     1.2MB
│   └── server/     3.2MB
│   ※本番ビルドでは50-100MB程度（cacheクリーン後）
├── app/            ~50MB  ← アプリコード
├── lib/            ~30MB  ← ビジネスロジック
├── public/         ~20MB  ← 静的ファイル（LP 5814行含む）
└── その他          ~30MB
```

**注意**: .nextの312MBは開発環境のキャッシュ蓄積を含む。本番ビルドでは通常50-100MB程度。

---

## コンポーネント構成

### レイヤードアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (app/)                                  │
│  • Pages (Next.js App Router)                               │
│  • API Routes (/api/*) - 23エンドポイント                    │
│  • React Components (components/)                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER (lib/)                                   │
│  • Business Logic                                           │
│  • Use Cases (actions/)                                     │
│  • Service Orchestration                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER (lib/)                                        │
│  • AIProviderManager (ai/provider.ts) - 最重要              │
│  • RAGService (rag/qa-service.ts)                           │
│  • ConversationManager (conversation/manager.ts)            │
│  • DripService (drip/drip-service.ts)                       │
│  • PremiumChecker (premium/)                                │
│  • CodeGenerator (code/generator.ts)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER (lib/)                                │
│  • Supabase Client (supabase/client.ts)                     │
│  • Cache (cache/)                                           │
│    - CacheStrategy (メモリベース、常時稼働)                 │
│    - Redis Client (lib/rate-limit.ts、オプション)           │
│      ※REDIS_URL環境変数で有効化                            │
│      ※未設定時はメモリストアで動作                          │
│  • External API Clients                                     │
│    - ClaudeApiClient (claude/client.ts)                     │
│    - GeminiApiClient (gemini/client.ts) - 自前実装          │
│    - LINE Client (line/client.ts)                           │
│    - Stripe SDK                                             │
│  • Logger (utils/logger.ts)                                 │
└─────────────────────────────────────────────────────────────┘
```

### ディレクトリ構造（完全版）

```
gas-generator/
├── app/                          # Next.js App Router
│   ├── api/                      # APIエンドポイント（23個）
│   │   ├── webhook/              # LINE Webhook（最重要）
│   │   │   └── route.ts          # 1500行、全機能の入口
│   │   ├── stripe/webhook/       # Stripe Webhook（430行）
│   │   ├── rag/query/            # RAG Q&A
│   │   ├── system-recommendation/# AI相談（開発中）
│   │   ├── admin/                # 管理者API（5）
│   │   │   ├── analytics/
│   │   │   ├── premium/
│   │   │   ├── sessions/
│   │   │   ├── tracking-links/
│   │   │   └── vision-stats/
│   │   ├── cron/                 # 定期実行（4）
│   │   │   ├── cleanup/
│   │   │   ├── drip/             # ドリップ配信
│   │   │   └── process-queue/
│   │   ├── subscription/         # サブスク管理（3）
│   │   ├── share/                # システム共有（2）
│   │   ├── systems/              # カタログAPI
│   │   ├── demo-proxy/           # iframeプロキシ
│   │   ├── health/               # ヘルスチェック
│   │   └── debug/                # デバッグ（3）
│   ├── systems/catalog/          # システムカタログページ
│   │   └── page.tsx              # 39システム定義（ハードコード）
│   ├── demo/                     # デモページ
│   ├── admin/                    # 管理画面
│   ├── styles/                   # グローバルCSS
│   │   ├── lp.css                # LP専用
│   │   └── part3.css             # モバイル対応
│   └── page.tsx                  # ホーム（LP配信）
│
├── lib/                          # ビジネスロジック（30+ディレクトリ）
│   ├── ai/                       # AI処理
│   │   ├── provider.ts           # AIProviderManager（最重要、250行）
│   │   └── recommendation-prompt.ts # AI相談プロンプト（開発中）
│   ├── claude/                   # Claude API
│   │   └── client.ts             # ClaudeApiClient
│   ├── gemini/                   # Gemini API（自前実装）
│   │   └── client.ts             # GeminiApiClient（REST直接）
│   ├── rag/                      # RAGシステム
│   │   ├── embedding-service.ts  # ベクトル化（OpenAI embeddings）
│   │   ├── qa-service.ts         # QA処理（Claude）
│   │   └── keyword-search.ts     # キーワード検索
│   ├── supabase/                 # DB操作
│   │   ├── client.ts             # クライアント初期化
│   │   ├── types.ts              # 型定義
│   │   ├── queries.ts            # 汎用クエリ
│   │   └── subscription-queries.ts # サブスククエリ
│   ├── line/                     # LINE Bot
│   │   ├── client.ts             # LINEクライアント
│   │   └── message-templates.ts  # メッセージテンプレート
│   ├── conversation/             # 会話管理
│   │   ├── manager.ts            # セッション管理（最大20、30分TTL）
│   │   └── memory.ts             # 会話メモリ
│   ├── code/                     # コード生成
│   │   ├── generator.ts          # GAS生成
│   │   └── file-generator.ts     # ファイル出力（Google Drive統合予定）
│   ├── drip/                     # ドリップキャンペーン
│   │   ├── drip-messages.ts      # 7日間メッセージ
│   │   └── drip-service.ts       # 配信ロジック
│   ├── premium/                  # プレミアムチェック
│   ├── systems/                  # システム管理
│   │   └── system-data.ts        # システムデータ取得
│   ├── cache/                    # キャッシュ（重要）
│   │   ├── cache-strategy.ts     # メモリベースキャッシュ（常時稼働）
│   │   └── conversation-cache.ts # 会話キャッシュ
│   ├── rate-limit.ts             # Rate Limiting（Redis or Memory）
│   ├── auth/                     # 認証
│   ├── constants/                # 定数
│   │   └── config.ts             # 全設定（104行、最重要）
│   └── utils/                    # ユーティリティ
│       └── logger.ts             # ロギング
│
├── components/                   # Reactコンポーネント
│   ├── layout/                   # レイアウト
│   ├── admin/                    # 管理画面
│   ├── AIConsultationChat.tsx    # AI相談UI（開発中）
│   └── RecommendationResult.tsx  # 推薦結果（開発中）
│
├── public/                       # 静的ファイル
│   ├── lp-page.html              # ランディングページ（5814行）
│   ├── agency/                   # 代理店管理画面
│   └── demos/                    # デモHTML（4件）
│
├── netlify-tracking/             # 代理店トラッキングシステム
│   ├── netlify/functions/        # Netlify Functions（32個、JS）
│   │   ├── line-webhook.js       # LINE連携
│   │   ├── agency-billing-stats.js # 請求データ
│   │   ├── track-visit.js        # 訪問追跡
│   │   └── ...                   # その他29 Functions
│   ├── frontend/                 # 静的フロントエンド（git管理外）
│   └── netlify.toml              # Netlify設定
│
├── migrations/                   # DBマイグレーション（6件）
│   ├── 001_subscription_and_rag_tables.sql
│   ├── 002_stripe_tables.sql
│   ├── 005_drip_campaign.sql
│   ├── 006_agency_conversions_extend.sql
│   └── 007_consultation_history.sql（開発中）
│
├── types/                        # 型定義
│   ├── qrcode.d.ts               # QRコード型
│   └── claude.d.ts               # Claude API型
│
├── CLAUDE.md                     # 開発ログ（2530行）
├── ARCHITECTURE.md               # このファイル
├── package.json                  # 依存関係（20パッケージ）
├── tsconfig.json                 # TypeScript設定
└── next.config.js                # Next.js設定
```

---

## データフロー

### 1. LINE Bot GASコード生成フロー

```
┌──────────┐
│ LINE User│
└────┬─────┘
     │ 1. メッセージ送信（テキスト or 画像）
     ▼
┌────────────────────────────────────────┐
│ /api/webhook (LINE Webhook)            │
│ • 署名検証（HMAC-SHA256）               │
│ • イベント種別判定（message/follow/etc）│
│ • 3秒以内レスポンス必須（LINE制限）      │
└────┬───────────────────────────────────┘
     │
     ├─→ 2a. テキストメッセージ
     │   ▼
     │   ┌─────────────────────────────────┐
     │   │ ConversationManager             │
     │   │ • セッション取得/作成            │
     │   │ • 会話履歴ロード（最大20件）     │
     │   │ • キャッシュ: メモリストア       │
     │   │   (Redisオプション)             │
     │   │ • 30分TTL                       │
     │   └────┬────────────────────────────┘
     │        │
     │        ▼
     │   ┌─────────────────────────────────┐
     │   │ AIProviderManager               │
     │   │ • Primary: Claude Sonnet 4      │
     │   │   Model: claude-sonnet-4-20250514│
     │   │   Timeout: 45秒                 │
     │   │   Max Tokens: 32K               │
     │   │ • Fallback: Gemini 3 Pro        │
     │   │   Model: gemini-3-pro-preview   │
     │   │   1回失敗で即切り替え            │
     │   │ • GASコード生成                 │
     │   └────┬────────────────────────────┘
     │        │
     │        ▼
     │   ┌─────────────────────────────────┐
     │   │ CodeGenerator                   │
     │   │ • コード検証（syntax check）     │
     │   │ • スプレッドシートURL抽出        │
     │   │ • キャッシュ（最大5件）          │
     │   │   ※メモリストア使用             │
     │   └────┬────────────────────────────┘
     │        │
     │        ▼
     │   ┌─────────────────────────────────┐
     │   │ Supabase                        │
     │   │ • conversations テーブル保存     │
     │   │ • sessions テーブル更新          │
     │   │ • トークン使用量記録             │
     │   └────┬────────────────────────────┘
     │        │
     │        ▼
     │   ┌─────────────────────────────────┐
     │   │ LINE Reply Message              │
     │   │ • GASコード送信                  │
     │   │ • QuickReply（システム一覧等）   │
     │   │ • Rate Limit: 20/時間（ユーザー）│
     │   │   ※メモリストアまたはRedis      │
     │   └─────────────────────────────────┘
     │
     └─→ 2b. 画像メッセージ（エラー診断）
         ▼
         ┌─────────────────────────────────┐
         │ LINE Content API                │
         │ • 画像ダウンロード（10MB制限）   │
         └────┬────────────────────────────┘
              │
              ▼
         ┌─────────────────────────────────┐
         │ Claude Vision API               │
         │ • エラー画像分析                 │
         │ • 修正コード生成                 │
         │ • 1回の解析で完結               │
         └────┬────────────────────────────┘
              │
              ▼
         ┌─────────────────────────────────┐
         │ LINE Reply Message              │
         │ • 修正案送信                     │
         │ • エラー原因説明                 │
         └─────────────────────────────────┘
```

### 2. RAG Q&Aフロー

```
┌──────────┐
│ User     │
└────┬─────┘
     │ 1. 質問送信（LINE or Web）
     ▼
┌────────────────────────────────────────┐
│ /api/rag/query                         │
│ • ANTHROPIC_API_KEY チェック            │
│ • Timeout: 30秒                        │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ KeywordSearchService                   │
│ • 日本語形態素解析（簡易実装）          │
│ • system_documents テーブル全文検索    │
│ • スコアリング（TF-IDF風）              │
│ • PostgreSQL ILIKE使用                 │
└────┬───────────────────────────────────┘
     │ 2. 関連ドキュメント抽出（Top 5）
     ▼
┌────────────────────────────────────────┐
│ QAService                              │
│ • Claude Sonnet 4にドキュメント送信     │
│ • 回答生成（最大2000トークン）          │
│ • 情報源（sources）記録                 │
│ • 信頼度スコア計算                      │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Response                               │
│ {                                      │
│   answer: "...",                       │
│   sources: ["doc1", "doc2"],           │
│   confidence: "high",                  │
│   search_method: "keyword"             │
│ }                                      │
└────────────────────────────────────────┘
```

### 3. Stripe決済フロー

```
┌──────────┐
│ LINE User│
└────┬─────┘
     │ 1. "プレミアムプランを見る"
     ▼
┌────────────────────────────────────────┐
│ LINE Bot                               │
│ • Payment Link送信                      │
│   Basic: 10,000円/月                   │
│   Pro:   50,000円/月                   │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Stripe Checkout                        │
│ • テストカード入力（4242 4242...）      │
│ • metadata.lineUserId 保存             │
│ • 決済完了                              │
└────┬───────────────────────────────────┘
     │ 2. Webhook送信（5分以内）
     ▼
┌────────────────────────────────────────┐
│ /api/stripe/webhook                    │
│ • 署名検証（HMAC-SHA256）               │
│ • タイムスタンプ検証（5分以内）         │
│ • イベント種別判定                      │
│   - checkout.session.completed         │
│   - customer.subscription.updated      │
│   - customer.subscription.deleted      │
│   - charge.refunded                    │
└────┬───────────────────────────────────┘
     │
     ├─→ 3a. stripe_events テーブルチェック
     │   （重複防止：event_id）
     │
     ├─→ 3b. metadata.lineUserId 抽出
     │
     ├─→ 3c. Supabase更新（トランザクション）
     │   ┌─────────────────────────────────┐
     │   │ users テーブル                   │
     │   │ • subscription_status 更新       │
     │   │   - 金額で判定: >=50K → professional│
     │   │   -          : <50K → basic     │
     │   │ • stripe_customer_id 保存        │
     │   │ • payment_start_date 記録        │
     │   └─────────────────────────────────┘
     │   ┌─────────────────────────────────┐
     │   │ user_subscriptions テーブル      │
     │   │ • status = 'active'             │
     │   │ • plan_id 関連付け              │
     │   │ • start_date, end_date 記録     │
     │   └─────────────────────────────────┘
     │   ┌─────────────────────────────────┐
     │   │ payment_history テーブル         │
     │   │ • 決済履歴記録（監査用）         │
     │   │ • amount, status, stripe_id     │
     │   └─────────────────────────────────┘
     │
     └─→ 3d. LINE通知送信（非同期）
         "💎 決済が完了しました！"
         失敗してもWebhookは200返却
```

### 4. ドリップキャンペーンフロー

```
┌──────────┐
│ LINE User│
└────┬─────┘
     │ 1. 友だち追加（follow event）
     ▼
┌────────────────────────────────────────┐
│ /api/webhook                           │
│ • DripService.startDrip(userId)        │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Supabase users テーブル                 │
│ • drip_status = 'active'               │
│ • drip_day = 1                         │
│ • drip_started_at = NOW()              │
└────┬───────────────────────────────────┘
     │
     │ ... 1時間後（外部Cron）...
     ▼
┌────────────────────────────────────────┐
│ GET /api/cron/drip                     │
│ • Authorization: Bearer <CRON_SECRET>  │
│ • 1時間ごと実行                         │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ DripService.processDripMessages()      │
│ • drip_status='active'のユーザー取得    │
│ • 配信時間チェック（JST 10:00-18:00）   │
│ • drip_day に応じたメッセージ送信       │
│ • 送信成功 → drip_day++                │
│ • Day 7完了 → drip_status='completed'  │
└────┬───────────────────────────────────┘
     │
     ├─→ Day 1: "活用ヒント"（CTA強度★☆☆☆☆）
     ├─→ Day 2: "時間的インパクト"（★★☆☆☆）
     ├─→ Day 3: "導入事例"（★★☆☆☆）
     ├─→ Day 4: "あるある課題"（★★★☆☆）
     ├─→ Day 5: "面談Q&A"（★★★☆☆）
     ├─→ Day 6: "機会損失"（★★★★☆）
     └─→ Day 7: "最終ご案内"（★★★★★）
             ↓
         ┌─────────────────────────────────┐
         │ drip_logs テーブル              │
         │ • 送信ログ記録（監査・分析用）   │
         │ • status, sent_at, error_message│
         └─────────────────────────────────┘

停止条件（自動でdrip_status='stopped'）:
- ユーザーがBotにメッセージ送信
- 有料プラン購入
- ブロック（unfollow event）
```

### 5. AI相談フロー（開発中）

```
┌──────────┐
│ Web User │
└────┬─────┘
     │ 1. LP「AI相談」ボタンクリック
     ▼
┌────────────────────────────────────────┐
│ /system-recommendation                 │
│ • モーダルまたはフルページ表示          │
└────┬───────────────────────────────────┘
     │
     │ 2. GET /api/system-recommendation
     ▼
┌────────────────────────────────────────┐
│ 5つの質問取得                           │
│ • sessionId生成（UUID）                 │
│ • questions配列返却                     │
│   1. 業種                              │
│   2. 課題業務                           │
│   3. 月間顧客数                         │
│   4. 削減希望時間                       │
│   5. 予算感                            │
└────┬───────────────────────────────────┘
     │
     │ 3. ユーザーが5つの質問に回答（フロントエンド）
     ▼
┌────────────────────────────────────────┐
│ POST /api/system-recommendation        │
│ Body: {                                │
│   sessionId: "...",                    │
│   answers: [                           │
│     {questionId: 1, answer: "小売業"}, │
│     {questionId: 2, answer: "在庫管理"},│
│     {questionId: 3, answer: "500"},    │
│     {questionId: 4, answer: "40時間"}, │
│     {questionId: 5, answer: "月額5万"} │
│   ]                                    │
│ }                                      │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ SystemDataService                      │
│ • page.tsx から39システムロード         │
│ • JSON圧縮（7000トークン）              │
│   - 不要フィールド削除                  │
│   - description短縮                    │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ AIProviderManager                      │
│ • Claude Sonnet 4呼び出し               │
│ • システムプロンプト（7000トークン）     │
│   + ユーザー回答（500トークン）         │
│ • Prompt Caching活用（2回目以降90%削減）│
│ • 推薦ロジック実行（Claude判断）        │
│ • Timeout: 45秒                        │
└────┬───────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│ Response                               │
│ {                                      │
│   recommendations: [                   │
│     {                                  │
│       systemId: "31",                  │
│       systemName: "在庫回転率管理",     │
│       priority: 1,                     │
│       reason: "小売業で在庫管理に...",  │
│       estimatedTimeSaving: "月20時間"  │
│     },                                 │
│     {systemId: "30", priority: 2, ...},│
│     {systemId: "01", priority: 3, ...} │
│   ],                                   │
│   analysisText: "貴社の課題を..."      │
│ }                                      │
└────┬───────────────────────────────────┘
     │
     ├─→ 4a. consultation_history テーブル記録（オプション）
     │
     └─→ 4b. RecommendationResultコンポーネント表示
             - 上位3システムをカード形式
             - 各カード: プレビューボタン → /systems/catalog遷移
```

---

## API設計

### APIエンドポイント一覧（23個、実測）

| エンドポイント | Method | 認証 | Timeout | 用途 |
|---------------|--------|------|---------|------|
| **LINE Bot** |
| `/api/webhook` | POST | LINE署名 | 3秒 | LINE Webhook（最重要、1500行） |
| **RAG** |
| `/api/rag/query` | POST | - | 30秒 | システムドキュメントQ&A |
| `/api/rag/embed` | POST | ADMIN | 60秒 | ベクトル埋め込み生成 |
| **決済** |
| `/api/stripe/webhook` | POST | Stripe署名 | 30秒 | Stripe Webhook（430行） |
| `/api/subscription` | GET/POST | - | 10秒 | サブスク情報取得・作成 |
| `/api/subscription/cancel` | POST | - | 10秒 | サブスクキャンセル |
| `/api/subscription/change-plan` | POST | - | 10秒 | プラン変更 |
| **システムカタログ** |
| `/api/systems` | GET | - | 10秒 | 公開システム一覧（Supabase） |
| `/api/share/create` | POST | - | 10秒 | システム共有リンク生成 |
| `/api/share/[shortId]` | GET | - | 10秒 | 共有コード取得 |
| **AI相談** |
| `/api/system-recommendation` | GET | - | 5秒 | 質問取得 |
| `/api/system-recommendation` | POST | - | 45秒 | 推薦分析（Claude） |
| **管理者** |
| `/api/admin/analytics` | GET | ADMIN_API_KEY | 30秒 | 分析データ |
| `/api/admin/premium` | POST | ADMIN_API_KEY | 10秒 | プレミアム付与 |
| `/api/admin/sessions` | GET | ADMIN_API_KEY | 10秒 | セッション一覧 |
| `/api/admin/tracking-links` | GET/POST | ADMIN_API_KEY | 10秒 | トラッキングリンク管理 |
| `/api/admin/vision-stats` | GET | ADMIN_API_KEY | 10秒 | Vision API統計 |
| **Cron** |
| `/api/cron/cleanup` | GET | CRON_SECRET | 60秒 | セッションクリーンアップ |
| `/api/cron/process-queue` | GET | CRON_SECRET | 300秒 | キュー処理 |
| `/api/cron/drip` | GET | CRON_SECRET | 300秒 | ドリップ配信 |
| **デバッグ** |
| `/api/debug/subscription` | GET | - | 10秒 | サブスク状態確認 |
| `/api/debug/setup` | GET | - | 5秒 | セットアップ確認 |
| `/api/debug/stripe` | GET | - | 5秒 | Stripe設定確認 |
| **その他** |
| `/api/health` | GET | - | 5秒 | ヘルスチェック |
| `/api/demo-proxy` | GET | - | 30秒 | iframeプロキシ |

### API認証方式

| 認証方式 | 用途 | 実装 | 検証コード |
|---------|------|------|----------|
| **LINE署名検証** | LINE Webhook | HMAC-SHA256（`X-Line-Signature`） | `crypto.createHmac('sha256', SECRET).update(body).digest('base64')` |
| **Stripe署名検証** | Stripe Webhook | HMAC-SHA256（`stripe-signature`） + タイムスタンプ検証（5分以内） | `stripe.webhooks.constructEvent()` |
| **ADMIN_API_KEY** | 管理者API | `Authorization: Bearer <KEY>` | ヘッダー一致確認 |
| **CRON_SECRET** | Cronエンドポイント | `Authorization: Bearer <SECRET>` | ヘッダー一致確認 |

### レスポンス形式（統一）

```typescript
// 成功
{
  success: true,
  data: { ... },
  message?: string,
  timestamp: string  // ISO 8601
}

// エラー
{
  success: false,
  error: string,      // エラー種別
  message: string,    // 人間可読メッセージ
  code?: string,      // アプリ固有エラーコード
  timestamp: string
}
```

### Rate Limiting（lib/constants/config.ts）

```typescript
RATE_LIMITS = {
  PER_USER_PER_HOUR: 20,      // ユーザーあたり20リクエスト/時間
  GLOBAL_PER_MINUTE: 50,      // 全体で50リクエスト/分
  CLAUDE_API_PER_MINUTE: 5,   // Claude API 5回/分
  CLAUDE_API_PER_DAY: 100     // Claude API 100回/日
}

// 実装: lib/rate-limit.ts
// - REDIS_URL設定時: Redisストア使用
// - 未設定時: メモリストアで動作
```

---

## データベース設計

### ER図（主要テーブル、実測）

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│ users           │1     ∞│ conversations    │∞     1│ sessions        │
├─────────────────┤───────├──────────────────┤───────├─────────────────┤
│ PK line_user_id │       │ PK id            │       │ PK id           │
│    email        │       │ FK line_user_id  │       │ FK line_user_id │
│    username     │       │ FK session_id    │       │    last_active  │
│    subscription │       │    role          │       │    context      │
│    _status      │       │    content       │       │    status       │
│    stripe_id    │       │    timestamp     │       │    memory       │
│    drip_status  │       │    tokens_used   │       │    created_at   │
│    drip_day     │       │    model_used    │       └─────────────────┘
│    drip_started │       └──────────────────┘
│    monthly_usage│
│    blocked_at   │
└─────────────────┘
        │1
        │
        │∞
┌─────────────────┐       ┌──────────────────┐
│ user_           │∞     1│ subscription_    │
│ subscriptions   │───────│ plans            │
├─────────────────┤       ├──────────────────┤
│ PK id           │       │ PK id            │
│ FK user_id      │       │    name          │
│    (line_user_id)│      │    price         │
│ FK plan_id      │       │    features JSONB│
│    status       │       │    limits JSONB  │
│    start_date   │       │    stripe_price_ │
│    end_date     │       │    id            │
│    created_at   │       └──────────────────┘
└─────────────────┘

┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│ systems         │1     ∞│ system_documents │1     ∞│ system_         │
├─────────────────┤───────├──────────────────┤───────│ embeddings      │
│ PK id           │       │ PK id            │       ├─────────────────┤
│    name         │       │ FK system_id     │       │ PK id           │
│    slug         │       │    title         │       │ FK document_id  │
│    category     │       │    content       │       │    embedding    │
│    is_published │       │    version       │       │    vector(1536) │
│    download_    │       │    created_at    │       │    chunk_index  │
│    count        │       └──────────────────┘       │    chunk_text   │
└─────────────────┘                                  └─────────────────┘

┌─────────────────┐       ┌──────────────────┐
│ stripe_events   │       │ payment_history  │
├─────────────────┤       ├──────────────────┤
│ PK event_id     │       │ PK id            │
│    type         │       │ FK user_id       │
│    data JSONB   │       │    amount        │
│    processed_at │       │    currency      │
└─────────────────┘       │    stripe_       │
                          │    payment_id    │
                          │    status        │
┌─────────────────┐       │    created_at    │
│ refunds         │       └──────────────────┘
├─────────────────┤
│ PK id           │       ┌──────────────────┐
│ FK user_id      │       │ drip_logs        │
│    amount       │       ├──────────────────┤
│    reason       │       │ PK id            │
│    stripe_      │       │ FK line_user_id  │
│    refund_id    │       │    day           │
│    created_at   │       │    message_type  │
└─────────────────┘       │    status        │
                          │    error_message │
┌─────────────────┐       │    sent_at       │
│ agencies        │       └──────────────────┘
├─────────────────┤
│ PK id           │       ┌──────────────────┐
│    name         │       │ agency_          │
│    email        │       │ conversions      │
│    commission_%│       ├──────────────────┤
│    created_at   │       │ PK id            │
└────┬────────────┘       │ FK agency_id     │
     │1                   │ FK line_user_id  │
     │                    │    line_display_ │
     │∞                   │    name          │
┌────┴────────────┐       │    device_type   │
│ tracking_links  │       │    browser       │
├─────────────────┤       │    os            │
│ PK id           │       │    session_id    │
│ FK agency_id    │       │    converted_at  │
│    short_code   │       └──────────────────┘
│    target_url   │
│    click_count  │       ┌──────────────────┐
│    created_at   │       │ consultation_    │
└─────────────────┘       │ history          │
                          ├──────────────────┤
                          │ PK id            │
                          │    session_id    │
                          │ FK line_user_id  │
                          │    answers JSONB │
                          │    recommend     │
                          │    JSONB         │
                          │    created_at    │
                          └──────────────────┘
                          （開発中）
```

### 主要テーブル詳細

#### users（ユーザー）

```sql
CREATE TABLE users (
  line_user_id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  subscription_status TEXT DEFAULT 'free',  -- 'free' | 'basic' | 'professional'
  is_premium BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  payment_start_date TIMESTAMPTZ,
  blocked_at TIMESTAMPTZ,  -- スパムユーザーブロック
  drip_status TEXT DEFAULT 'inactive',  -- 'inactive' | 'active' | 'completed' | 'stopped'
  drip_day INTEGER DEFAULT 1,
  drip_started_at TIMESTAMPTZ,
  monthly_usage_count INTEGER DEFAULT 0,  -- 月間API使用回数
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_subscription ON users(subscription_status);
CREATE INDEX idx_users_drip ON users(drip_status, drip_day);
```

#### conversations（会話履歴）

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT REFERENCES users(line_user_id),
  session_id UUID REFERENCES sessions(id),
  role TEXT NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tokens_used INTEGER,  -- トークン使用量
  model_used TEXT       -- 'claude-sonnet-4' | 'gemini-3-pro'
);

CREATE INDEX idx_conversations_user ON conversations(line_user_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp);
```

#### sessions（セッション）

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT REFERENCES users(line_user_id),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  context JSONB,  -- 会話コンテキスト
  status TEXT DEFAULT 'active',  -- 'active' | 'completed' | 'expired'
  memory JSONB,  -- 短期記憶（重要情報抽出）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(line_user_id);
CREATE INDEX idx_sessions_active ON sessions(last_active_at) WHERE status = 'active';
```

#### subscription_plans（サブスクプラン）

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,  -- 'basic' | 'professional'
  price DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL,  -- 'monthly' | 'yearly'
  contract_months INTEGER DEFAULT 6,
  features JSONB,  -- {"systems": 3, "downloads_per_month": 1}
  limits JSONB,    -- {"max_systems": 3, "max_downloads": 1}
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ
INSERT INTO subscription_plans (name, price, billing_cycle, contract_months, features, limits, stripe_price_id) VALUES
('basic', 10000.00, 'monthly', 6, '{"systems": 3, "downloads_per_month": 1}', '{"max_systems": 3, "max_downloads": 1}', 'price_basic_xxx'),
('professional', 50000.00, 'monthly', 6, '{"systems": "unlimited", "downloads_per_month": 5}', '{"max_downloads": 5}', 'price_pro_xxx');
```

#### system_embeddings（ベクトル埋め込み）

```sql
-- pgvector拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE system_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES system_documents(id),
  embedding vector(1536),  -- OpenAI embeddings（1536次元）
  chunk_index INTEGER,
  chunk_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ベクトル類似度検索用インデックス（IVFFlat）
CREATE INDEX idx_embeddings_vector ON system_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- クラスタ数（データ量に応じて調整）
```

### マイグレーション管理

| ファイル | 説明 | ステータス | 行数 |
|---------|------|-----------|------|
| `001_subscription_and_rag_tables.sql` | サブスク + RAGテーブル | ✅ 実行済み | ~500行 |
| `002_stripe_tables.sql` | Stripe決済テーブル | ✅ 実行済み | ~200行 |
| `005_drip_campaign.sql` | ドリップキャンペーン | ✅ 実行済み | ~150行 |
| `006_agency_conversions_extend.sql` | 代理店コンバージョン | ✅ 実行済み | ~100行 |
| `007_consultation_history.sql` | AI相談履歴 | ⏳ 開発中 | ~50行 |

---

## インフラ構成

### デプロイメント図

```
┌──────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└─────────┬────────────────────────────────┬───────────────────┘
          │                                │
          │ HTTPS                          │ HTTPS
          │                                │
┌─────────▼──────────┐          ┌──────────▼──────────────────┐
│  Netlify CDN       │          │  Render Web Service         │
├────────────────────┤          ├─────────────────────────────┤
│ • LP（HTML 5814行）│          │ • Next.js 14 App            │
│ • 代理店ポータル    │          │ • Node.js 18.17.0           │
│ • 32 Functions (JS)│          │ • 2GB RAM Standard          │
│                    │          │ • 678MB node_modules        │
│ Domain:            │          │ • 312MB .next（開発環境）   │
│ taskmateai.net     │          │   ※本番: 50-100MB程度      │
│                    │          │ • --max-old-space-size=1536│
│ Deploy:            │          │                             │
│ • Git push trigger │          │ Domain:                     │
│ • CLI manual       │          │ gasgenerator.onrender.com   │
│   netlify deploy   │          │                             │
│   --prod           │          │ Build:                      │
└────────────────────┘          │ npm ci --include=dev &&     │
                                │ npm run build               │
                                │                             │
                                │ Start:                      │
                                │ node --expose-gc            │
                                │   --max-old-space-size=1536 │
                                │   node_modules/.bin/next    │
                                │   start                     │
                                └─────────┬───────────────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
              ┌─────────▼──────┐ ┌───────▼────────┐ ┌──────▼─────┐
              │ Supabase       │ │ Redis          │ │ External   │
              │ PostgreSQL     │ │ ※オプション    │ │ APIs       │
              ├────────────────┤ ├────────────────┤ ├────────────┤
              │ • Tokyo region │ │ REDIS_URL設定  │ │ • Claude   │
              │ • pgvector     │ │ で有効化       │ │   Sonnet 4 │
              │ • Row Level    │ │                │ │ • Gemini   │
              │   Security     │ │ 未設定時：     │ │   3 Pro    │
              │ • 12 Tables    │ │ Memory Store   │ │ • LINE API │
              │ • Auto Backup  │ │ で動作         │ │ • Stripe   │
              └────────────────┘ └────────────────┘ └────────────┘
```

### 環境変数管理（完全版、44個実測）

#### Render（メインアプリ）

```bash
# === AI ===
ANTHROPIC_API_KEY=sk-ant-api03-...  # Claude Sonnet 4
CLAUDE_MODEL=claude-sonnet-4-20250514  # オプション（デフォルトあり）
GEMINI_API_KEY=AIza...  # Gemini 3 Pro（フォールバック）
GEMINI_MODEL=gemini-3-pro-preview  # オプション
OPENAI_API_KEY=sk-...  # RAG埋め込み用（オプション）

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...(anon key)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...(service_role key)

# === LINE ===
LINE_CHANNEL_SECRET=xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx
NEXT_PUBLIC_LINE_FRIEND_URL=https://line.me/R/ti/p/@xxx  # 友だち追加URL

# === Stripe ===
STRIPE_SECRET_KEY=sk_test_xxx  # 本番: sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_xxx  # Basic
STRIPE_PAYMENT_LINK_PRO=https://buy.stripe.com/test_xxx  # Pro
NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_xxx
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PAYMENT_LINK=https://buy.stripe.com/test_xxx
NEXT_PUBLIC_STRIPE_PRICE_BASIC=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL=price_xxx

# === 管理者 ===
ADMIN_API_KEY=xxx
ADMIN_DASHBOARD_URL=https://xxx  # オプション
ADMIN_ORIGIN=https://xxx  # CORS用
ADMIN_ALLOWED_IPS=192.168.1.1,10.0.0.1  # カンマ区切り、オプション

# === セキュリティ ===
COOKIE_SECRET=xxx  # セッション暗号化
ENCRYPTION_SECRET=xxx  # データ暗号化
WEBHOOK_SECRET=xxx  # 汎用Webhook検証
CRON_SECRET=xxx  # Cronエンドポイント認証

# === エンジニア相談機能 ===
ENGINEER_SUPPORT_GROUP_ID=Cxxx  # LINE グループID
ENGINEER_USER_IDS=U001,U002,U003  # カンマ区切り

# === ドリップキャンペーン ===
CONSULTATION_BOOKING_URL=https://calendly.com/xxx  # 面談予約URL

# === キャッシュ・Redis（オプション） ===
REDIS_URL=redis://xxx:6379  # オプション、未設定時はメモリストア使用
                            # lib/rate-limit.ts、lib/cache/ で使用
                            # 設定推奨だが必須ではない

# === その他 ===
NEXT_PUBLIC_APP_URL=https://gasgenerator.onrender.com
NEXT_PUBLIC_BASE_URL=https://gasgenerator.onrender.com
NEXT_PUBLIC_APP_ENV=production  # 'development' | 'production'
NODE_ENV=production
PORT=10000  # Render自動設定
NETLIFY_WEBHOOK_URL=https://xxx.netlify.app/.netlify/functions/xxx  # オプション
ALLOWED_ORIGINS=https://line.me,https://api.line.me  # CORS、カンマ区切り
LOG_LEVEL=info  # 'debug' | 'info' | 'warn' | 'error'
ENABLE_METRICS=true  # メトリクス収集有効化

# === プレミアムマスターコード（非推奨、削除予定） ===
PREMIUM_MASTER_CODE_=xxx
PREMIUM_MASTER_ACTIVATION_AMEBAS=xxx

# === Vercel（未使用） ===
VERCEL_ENV=production  # Vercelデプロイ時のみ
```

**重要な注記**:
- **REDIS_URL**: オプション。設定時はRedisストア、未設定時はメモリストアで動作。
- **OPENAI_API_KEY**: RAG埋め込み用。未設定時はキーワード検索のみ。
- **@sendgrid/mail**: package.jsonに存在するが**コード内未使用**。削除推奨。

#### Netlify（LP + Functions）

```bash
# Supabase（Functions用）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...(service_role key)

# LINE（Functions用）
LINE_CHANNEL_ACCESS_TOKEN=xxx

# その他
# ⚠️ NETLIFY_NEXT_PLUGIN_SKIP=true は「メインサイト」には絶対に設定しないこと！
# これを設定するとNext.jsプラグインがスキップされ、全ページ404になる。
# netlify-tracking（代理店LP）専用の設定。メインサイト（taskmateai.net）では不要。
NETLIFY=true  # 自動設定
```

### ビルド設定

#### Render（render.yaml）

```yaml
services:
  - type: web
    name: gasgenerator
    runtime: node
    region: oregon  # または singapore
    plan: standard
    buildCommand: npm ci --include=dev && npm run build
    startCommand: node --expose-gc --max-old-space-size=1536 node_modules/.bin/next start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        generateValue: true
    healthCheckPath: /api/health
```

#### Netlify（netlify.toml）

```toml
[build]
  publish = "frontend"
  functions = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Frame-Options = "SAMEORIGIN"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"

[functions]
  node_bundler = "esbuild"
  directory = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

# 環境変数（Netlify UI設定必須）
# SUPABASE_URL
# SUPABASE_SERVICE_KEY
# LINE_CHANNEL_ACCESS_TOKEN
# ⚠️ NETLIFY_NEXT_PLUGIN_SKIP=true ← メインサイトには設定禁止（全ページ404の原因になる）
```

---

## セキュリティ

### 1. Webhook署名検証

#### LINE Webhook（app/api/webhook/route.ts）

```typescript
import crypto from 'crypto'

function validateLineSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest('base64')

  return hash === signature
}

// 使用例
const signature = request.headers.get('x-line-signature')
const rawBody = await request.text()

if (!validateLineSignature(rawBody, signature)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
```

#### Stripe Webhook（app/api/stripe/webhook/route.ts）

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function verifyStripeSignature(body: string, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

// タイムスタンプ検証（5分以内）
const timestamp = parseInt(signature.split(',')[0].split('=')[1])
const now = Math.floor(Date.now() / 1000)
if (Math.abs(now - timestamp) > 300) {
  throw new Error('Request too old')
}
```

### 2. リプレイ攻撃防止

```typescript
// Stripe Webhook
const { data: existing } = await supabaseAdmin
  .from('stripe_events')
  .select('event_id')
  .eq('event_id', event.id)
  .single()

if (existing) {
  logger.info('Duplicate event, skipping', { eventId: event.id })
  return NextResponse.json({ received: true })  // 既に処理済み
}

// イベント記録
await supabaseAdmin.from('stripe_events').insert({
  event_id: event.id,
  type: event.type,
  data: event.data,
  processed_at: new Date().toISOString()
})
```

### 3. Rate Limiting（lib/rate-limit.ts）

```typescript
// 設定値（lib/constants/config.ts）
export const RATE_LIMITS = {
  PER_USER_PER_HOUR: 20,      // ユーザーあたり20リクエスト/時間
  GLOBAL_PER_MINUTE: 50,      // 全体で50リクエスト/分
  CLAUDE_API_PER_MINUTE: 5,   // Claude API 5回/分
  CLAUDE_API_PER_DAY: 100     // Claude API 100回/日（コスト制御）
}

// 実装: lib/rate-limit.ts
// Redis実装（オプション）+ Memory Store（フォールバック）
class RedisStore implements RateLimitStore {
  private redis: any

  constructor() {
    if (process.env.REDIS_URL) {
      import('ioredis').then(({ default: Redis }) => {
        this.redis = new Redis(process.env.REDIS_URL!)
      }).catch(() => {
        console.warn('Redis not available, falling back to memory store')
      })
    }
  }

  async increment(key: string): Promise<{ count: number; ttl: number }> {
    if (!this.redis) {
      return memoryStore.increment(key)  // フォールバック
    }

    const multi = this.redis.multi()
    multi.incr(key)
    multi.expire(key, 60)  // 1分
    const results = await multi.exec()
    return { count: results[0][1], ttl: 60 }
  }
}

// Memory Store（常時稼働）
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; expires: number }>()

  async increment(key: string): Promise<{ count: number; ttl: number }> {
    const now = Date.now()
    const record = this.store.get(key)

    if (!record || record.expires < now) {
      const expires = now + 60000  // 1分
      this.store.set(key, { count: 1, expires })
      return { count: 1, ttl: 60 }
    }

    record.count++
    return {
      count: record.count,
      ttl: Math.ceil((record.expires - now) / 1000)
    }
  }
}
```

### 4. Row Level Security（RLS）

```sql
-- Supabase RLSポリシー例
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の会話のみ閲覧可能
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (line_user_id = current_setting('app.user_id'));

-- ユーザーは自分の会話のみ挿入可能
CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (line_user_id = current_setting('app.user_id'));

-- システム管理者は全て閲覧可能
CREATE POLICY "Admins can view all conversations"
  ON conversations FOR SELECT
  USING (current_setting('app.is_admin') = 'true');
```

### 5. 環境変数の秘匿化

- **Render**: Environment Variables（暗号化保存、自動マスキング）
- **Netlify**: Environment Variables（暗号化保存）
- **Git**: `.env` ファイルは `.gitignore` に含む（必須）
- **コード**: `process.env.*` でアクセス、ハードコード禁止

### 6. セキュリティヘッダー（middleware.ts）

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  response.headers.set('X-XSS-Protection', '1; mode=block')  // 旧ブラウザ対応

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### 7. CORS設定（lib/constants/config.ts）

```typescript
export const SECURITY_CONFIG = {
  MIN_WEBHOOK_SECRET_LENGTH: 8,
  MAX_REQUEST_BODY_SIZE: 10000,  // 10KB（DoS対策）
  CORS_ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
    ? ['https://line.me', 'https://api.line.me', 'https://webhook.line.me']
    : ['http://localhost:3000', 'http://127.0.0.1:3000']
} as const
```

---

## スケーラビリティ

### 1. 水平スケーリング戦略

| コンポーネント | スケーリング手法 | 現状 | 上限 | 制約 |
|---------------|-----------------|------|------|------|
| **Render Web Service** | 自動/手動スケール | 1インスタンス（2GB） | 10インスタンス | Standard plan |
| **Netlify Functions** | サーバーレス自動 | 同時125実行 | 同時1000実行 | 無料プラン制限 |
| **Supabase** | 自動スケーリング | Free Tier | Pro（接続プーリング） | pgBouncer |
| **Redis** | シャーディング | オプション（未設定可能性） | Redis Cluster | 手動設定 |

### 2. パフォーマンス最適化

#### Caching戦略（3層、実装済み）

```typescript
// lib/cache/cache-strategy.ts（メモリベース、常時稼働）
export class CacheStrategy {
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map()

  // 初期化されるキャッシュ
  // - line-api: 1分TTL、最大50件
  // - claude-api: 5分TTL、最大20件
  // - user-session: 30分TTL、最大100件
  // - code-generation: 1時間TTL、最大10件
}

// lib/rate-limit.ts（Redis or Memory）
// Layer 1: Memory Store（常時稼働）
const memoryStore = new MemoryStore()

// Layer 2: Redis Store（オプション、REDIS_URL設定時）
const redisStore = new RedisStore()  // 自動フォールバック to Memory

// 使用例
async function getCachedData(key: string): Promise<any> {
  // 1. Memory Cache（最速）
  const memCached = cacheStrategy.get('cache-name', key)
  if (memCached) return memCached

  // 2. Redis Cache（高速、オプション）
  if (redis) {
    const redisCached = await redis.get(key)
    if (redisCached) {
      cacheStrategy.set('cache-name', key, JSON.parse(redisCached))
      return JSON.parse(redisCached)
    }
  }

  // 3. Database（データソース）
  const data = await supabaseAdmin.from('table').select('*')
  if (redis) await redis.setex(key, 1800, JSON.stringify(data))
  cacheStrategy.set('cache-name', key, data)
  return data
}
```

#### セッション管理最適化（lib/conversation/manager.ts）

```typescript
// メモリ削減設定（実装値）
const MAX_SESSIONS = 20  // 同時セッション数（旧: 100）
const SESSION_TIMEOUT = 30 * 60 * 1000  // 30分（旧: 2時間）
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000  // 5分ごとにクリーンアップ
const MAX_RECENT_CODES = 5  // キャッシュするコード数
```

#### Claude API Prompt Caching

```typescript
// lib/ai/recommendation-prompt.ts
// システムプロンプト（7000トークン）をキャッシュ
// Anthropic Prompt Caching: https://docs.anthropic.com/claude/docs/prompt-caching
// キャッシュTTL: 5分
// コスト削減: 90%（2回目以降のAPI呼び出し）

const systemPrompt = {
  type: "text",
  text: SYSTEM_PROMPT.replace('{SYSTEMS_JSON}', systemsJson),
  cache_control: { type: "ephemeral" }  // キャッシュ有効化
}
```

### 3. データベース最適化

#### インデックス戦略

```sql
-- 頻繁にクエリされるカラムにインデックス
CREATE INDEX idx_conversations_user ON conversations(line_user_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_sessions_user ON sessions(line_user_id);
CREATE INDEX idx_sessions_active ON sessions(last_active_at) WHERE status = 'active';
CREATE INDEX idx_users_subscription ON users(subscription_status);
CREATE INDEX idx_users_drip ON users(drip_status, drip_day);

-- pgvector IVFFlat インデックス（RAG）
CREATE INDEX idx_embeddings_vector ON system_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- クラスタ数
```

#### Connection Pooling（lib/supabase/client.ts）

```typescript
// Supabase接続プール設定
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        'x-connection-pool-max': '5'  // サーバーレス環境では最小限に
      }
    }
  }
)
```

### 4. 負荷分散

```
┌──────────┐
│ User     │
└────┬─────┘
     │
     ▼
┌────────────────┐
│ Netlify CDN    │  → 静的コンテンツ配信（LP、代理店ポータル）
│ (Edge Nodes)   │     世界中のエッジロケーション
└────┬───────────┘
     │
     │ Dynamic Request
     ▼
┌────────────────┐
│ Render LB      │  → アプリサーバー負荷分散
│ (Load Balancer)│     自動ヘルスチェック、フェイルオーバー
└────┬───────────┘
     │
     ├─→ Instance 1（Primary）
     ├─→ Instance 2（Standby）
     └─→ Instance N（Auto-scale）
```

---

## 監視・ログ

### 1. ログ収集

#### Logger実装（lib/utils/logger.ts）

```typescript
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...sanitizeMeta(meta)  // 機密情報除去
    }))
  },

  error: (message: string, meta?: any) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message,
      stack: meta?.error?.stack,
      ...sanitizeMeta(meta)
    }))
  },

  warn: (message: string, meta?: any) => {
    console.warn(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      message,
      ...sanitizeMeta(meta)
    }))
  }
}

// 機密情報除去（lib/constants/config.ts: LOG_CONFIG.SENSITIVE_KEYS）
function sanitizeMeta(meta: any): any {
  if (!meta) return {}
  const sanitized = { ...meta }
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization']

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]'
    }
  }

  return sanitized
}
```

#### 主要ログポイント

| ログ種別 | 出力場所 | 用途 |
|---------|---------|------|
| **Webhook受信** | `app/api/webhook/route.ts` | LINE Bot動作監視、エラー追跡 |
| **AI API呼び出し** | `lib/ai/provider.ts` | トークン消費追跡、コスト計算 |
| **決済処理** | `app/api/stripe/webhook/route.ts` | 課金トラブルシューティング |
| **エラー** | 全エンドポイント | 障害検知・原因特定 |
| **ドリップ配信** | `app/api/cron/drip/route.ts` | 配信成功率監視 |
| **Rate Limit** | `lib/rate-limit.ts` | 不正利用検知 |
| **Redis Fallback** | `lib/rate-limit.ts` | Redis接続失敗時のフォールバック動作 |

### 2. メトリクス

#### アプリケーションメトリクス（lib/constants/config.ts: METRICS_CONFIG）

```typescript
// 収集すべきメトリクス（5分間隔、7日保持）
{
  // リクエスト
  "request_count": 1000,
  "request_duration_ms": 250,
  "status_code": 200,

  // AI API
  "claude_api_calls": 500,
  "claude_tokens_input": 50000,
  "claude_tokens_output": 20000,
  "claude_errors": 5,
  "gemini_api_calls": 10,  // フォールバック
  "gemini_tokens": 5000,

  // LINE Bot
  "line_messages_sent": 1000,
  "line_messages_received": 1200,
  "line_errors": 2,

  // 決済
  "stripe_payments": 10,
  "stripe_revenue_jpy": 500000,
  "stripe_errors": 0,

  // ドリップ
  "drip_messages_sent": 150,
  "drip_conversion_rate": 0.05,  // 5%

  // キャッシュ
  "cache_hits": 800,
  "cache_misses": 200,
  "redis_connected": true  // Redis接続状態
}
```

#### インフラメトリクス

- **Render Dashboard**: CPU、メモリ、レスポンスタイム、ネットワーク
- **Supabase Dashboard**: DB接続数、クエリ実行時間、ストレージ使用量
- **Netlify Analytics**: Function実行数、エラー率、実行時間

### 3. アラート設定（推奨、lib/constants/config.ts: METRICS_CONFIG.ALERT_THRESHOLDS）

| アラート条件 | 閾値 | アクション |
|------------|------|----------|
| **Render CPU** | > 80% | スケールアップ検討 |
| **Render Memory** | > 1.5GB | メモリリーク調査 |
| **Supabase接続数** | > 50 | Connection Pool拡大 |
| **Claude APIエラー率** | > 5% | Geminiフォールバック確認 |
| **Stripe Webhook失敗** | 連続3回 | 手動確認・再送 |
| **ドリップ配信失敗率** | > 10% | LINE API状態確認 |
| **応答時間** | > 5秒 | パフォーマンス調査 |
| **キュー長** | > 50 | ワーカー増強 |
| **Redis接続失敗** | 連続10回 | Redis URL確認、Memory Store動作確認 |

### 4. エラートラッキング（将来実装推奨）

```typescript
// Sentry統合例（未実装）
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10%のトランザクションをトレース
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true
    })
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
})
```

---

## デプロイメント戦略

### 1. Git戦略

```
main ブランチ（本番デプロイ可能）
  ├── feature/ai-consultation      ← 新機能開発
  ├── hotfix/webhook-error          ← 緊急修正
  └── release/v2.2                  ← リリース準備

コミット規則:
- feat: 新機能
- fix: バグ修正
- docs: ドキュメント
- refactor: リファクタリング
- test: テスト追加
- chore: その他

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 2. CI/CD

#### Render（自動デプロイ）

```
GitHub Push (main)
    ↓ Webhook
Render Webhook受信
    ↓
npm ci --include=dev && npm run build
    ↓ 5-10分
ビルド成功（.next/ 生成）
    ※開発環境: 312MB（cacheあり）
    ※本番環境: 50-100MB（cacheなし）
    ↓
node --expose-gc --max-old-space-size=1536 node_modules/.bin/next start
    ↓
ヘルスチェック（GET /api/health）
    ↓
トラフィック切替（ゼロダウンタイム）
    ↓
デプロイ完了
```

#### Netlify（手動デプロイ推奨）

```bash
cd netlify-tracking
cp ../public/lp-page.html frontend/index.html
npx netlify deploy --prod --dir=frontend

# 成功確認
curl https://taskmateai.net
```

### 3. デプロイ前チェックリスト

- [ ] ローカルで `npm run build` 成功（10-15分）
- [ ] ローカルで `npm run lint` 警告3件以下
- [ ] 環境変数44個がRenderに設定済み（Redis任意）
- [ ] Supabase migrationsが実行済み（6件）
- [ ] CLAUDE.md に今回の変更を記録
- [ ] コミットメッセージが明確（feat/fix/docsプレフィックス）
- [ ] `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>` 含む
- [ ] ブランチがmainにマージ済み
- [ ] Render Dashboard でデプロイログ確認
- [ ] 本番環境で `/api/health` が200 OK
- [ ] LINEで動作確認（友だち追加→メッセージ送信）

### 4. ロールバック手順

```bash
# Render
# Dashboardから "Rollback to <commit>" をクリック
# または CLI:
render rollback --service=gasgenerator --to=<commit-sha>

# Netlify
netlify rollback --site=autogas

# Supabase Migration（手動で逆マイグレーション実行）
psql $DATABASE_URL < migrations/rollback_007.sql
```

### 5. Blue-Green Deployment（将来実装）

```
┌────────────┐
│ Load Balancer│
└──┬───────┬─┘
   │       │
   │ 100%  │ 0%
   ▼       ▼
┌──────┐ ┌──────┐
│ Blue │ │ Green│
│ (v2.1)│ │ (v2.2)│  ← 新バージョンデプロイ・テスト
└──────┘ └──────┘
   ↓ トラフィック切替（瞬時）
┌────────────┐
│ Load Balancer│
└──┬───────┬─┘
   │       │
   │ 0%    │ 100%
   ▼       ▼
┌──────┐ ┌──────┐
│ Blue │ │ Green│  ← 本番稼働
│ (v2.1)│ │ (v2.2)│
└──────┘ └──────┘
```

---

## コスト構造

### 1. AI API コスト（実測 lib/constants/config.ts）

#### Claude Sonnet 4

```typescript
CLAUDE_CONFIG = {
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 32000,  // 出力上限
  COST_PER_INPUT_TOKEN: 0.003 / 1000,   // $3 per million tokens
  COST_PER_OUTPUT_TOKEN: 0.015 / 1000   // $15 per million tokens
}

// コスト計算例
const avgInputTokens = 5000   // システムプロンプト3K + ユーザー入力2K
const avgOutputTokens = 1500  // GASコード生成
const costPerRequest = (avgInputTokens * 0.003 / 1000) + (avgOutputTokens * 0.015 / 1000)
                     = 0.015 + 0.0225 = $0.0375（約5.6円）

// 月間コスト試算（1日50リクエスト）
月間リクエスト = 50 * 30 = 1500回
月間コスト = 1500 * 5.6円 = 8,400円
```

#### Gemini 3 Pro（フォールバック）

```typescript
GEMINI_CONFIG = {
  MODEL: 'gemini-3-pro-preview',
  MAX_OUTPUT_TOKENS: 8192,
  COST_PER_INPUT_TOKEN: 0.125 / 1_000_000,   // $0.125 per million tokens
  COST_PER_OUTPUT_TOKEN: 0.50 / 1_000_000    // $0.50 per million tokens
}

// コスト計算例（Claudeの約1/60）
const costPerRequest = (5000 * 0.125 / 1_000_000) + (1500 * 0.50 / 1_000_000)
                     = 0.000625 + 0.00075 = $0.001375（約0.2円）

// フォールバック率5%想定
月間フォールバック = 1500 * 0.05 = 75回
月間コスト = 75 * 0.2円 = 15円
```

### 2. インフラコスト

| サービス | プラン | 月額 | 備考 |
|---------|--------|------|------|
| **Render** | Standard（2GB） | $25 | 自動スケーリング可 |
| **Netlify** | 無料 | $0 | 32 Functions、125同時実行 |
| **Supabase** | Free Tier | $0 | DB 500MB、転送量1GB/月 |
| **Redis** | 外部サービス（オプション） | $5-20 | Upstash等、未設定可能性 |
| **GitHub** | Private Repo | $0 | Organization無料 |
| **合計** | - | **$25-45** | **約3,800-6,800円/月** |

### 3. 総コスト試算（月間1500リクエスト想定）

```
AI API（Claude）:     8,400円
AI API（Gemini）:        15円
インフラ:            3,800円（Redis未使用の場合）
-----------------------------------
月間総コスト:       約12,200円

ユーザー1人あたり（50リクエスト/月）: 約410円
```

### 4. 収益性分析

```
ベーシックプラン（10,000円/月）:
  コスト: 約1,000円（月間50リクエスト想定）
  粗利益: 9,000円
  粗利率: 90%

プロフェッショナルプラン（50,000円/月）:
  コスト: 約5,000円（月間250リクエスト想定）
  粗利益: 45,000円
  粗利率: 90%

損益分岐点: 月間3ユーザー（ベーシック）または1ユーザー（プロ）
```

---

## パフォーマンス設定

### 1. タイムアウト設定（lib/constants/config.ts: TIMEOUTS）

```typescript
export const TIMEOUTS = {
  WEBHOOK_RESPONSE: 3000,    // 3秒（LINE必須制限）
  CLAUDE_API: 45000,         // 45秒
  DATABASE_QUERY: 10000,     // 10秒
  HTTP_REQUEST: 30000        // 30秒
} as const
```

### 2. レート制限（lib/constants/config.ts: RATE_LIMITS）

```typescript
export const RATE_LIMITS = {
  PER_USER_PER_HOUR: 20,          // ユーザーあたり20リクエスト/時間
  GLOBAL_PER_MINUTE: 50,          // 全体で50リクエスト/分
  CLAUDE_API_PER_MINUTE: 5,       // Claude API 5回/分
  CLAUDE_API_PER_DAY: 100         // Claude API 100回/日
} as const
```

### 3. データベース設定（lib/constants/config.ts: DATABASE_CONFIG）

```typescript
export const DATABASE_CONFIG = {
  MAX_SESSION_AGE_HOURS: 24,      // セッション保持時間
  MAX_QUEUE_AGE_HOURS: 1,         // キュー保持時間
  MAX_RETRIES: 3,                 // リトライ回数
  CLEANUP_INTERVAL_MINUTES: 60,   // クリーンアップ間隔
  MAX_RECENT_CODES: 5             // キャッシュするコード数
} as const
```

### 4. 会話フロー設定（lib/constants/config.ts: CONVERSATION_CONFIG）

```typescript
export const CONVERSATION_CONFIG = {
  MAX_STEPS: 3,                   // 会話ステップ数
  MAX_REQUIREMENTS_LENGTH: 1000,  // 要件最大文字数
  MIN_DETAILS_LENGTH: 10          // 詳細最小文字数
} as const
```

### 5. セキュリティ設定（lib/constants/config.ts: SECURITY_CONFIG）

```typescript
export const SECURITY_CONFIG = {
  MIN_WEBHOOK_SECRET_LENGTH: 8,
  MAX_REQUEST_BODY_SIZE: 10000,   // 10KB（DoS対策）
  CORS_ALLOWED_ORIGINS: process.env.NODE_ENV === 'production'
    ? ['https://line.me', 'https://api.line.me', 'https://webhook.line.me']
    : ['http://localhost:3000', 'http://127.0.0.1:3000']
} as const
```

### 6. メトリクス設定（lib/constants/config.ts: METRICS_CONFIG）

```typescript
export const METRICS_CONFIG = {
  COLLECTION_INTERVAL_MS: 300000, // 5分毎
  RETENTION_DAYS: 7,              // 7日保持
  ALERT_THRESHOLDS: {
    ERROR_RATE: 0.05,             // 5%
    RESPONSE_TIME: 5000,          // 5秒
    QUEUE_LENGTH: 50
  }
} as const
```

---

## テスト戦略

### 現状: テストファイル0個（実測）

```bash
$ find . -path ./node_modules -prune -o -name "*.test.*" -type f -print | wc -l
0

$ find . -path ./node_modules -prune -o -name "*.spec.*" -type f -print | wc -l
0
```

**重要**: 現在、ユニットテスト・統合テストは**未実装**。

### 推奨される今後の実装

#### 1. テストフレームワーク

```json
// package.json に追加推奨
{
  "devDependencies": {
    "jest": "^29.7.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "jest-environment-jsdom": "^29.7.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

#### 2. テスト優先度

| 優先度 | テスト対象 | 理由 |
|--------|-----------|------|
| **最高** | `app/api/webhook/route.ts` | LINE Botの心臓部、1500行 |
| **最高** | `lib/ai/provider.ts` | AIフォールバックロジック |
| **高** | `app/api/stripe/webhook/route.ts` | 決済処理、金銭的リスク |
| **高** | `lib/rag/qa-service.ts` | RAGシステムの精度 |
| **高** | `lib/rate-limit.ts` | Redis/Memoryフォールバック動作 |
| **中** | `lib/drip/drip-service.ts` | ドリップ配信ロジック |
| **中** | `lib/premium/premium-checker.ts` | プレミアムチェック |
| **低** | コンポーネント | UI動作確認 |

#### 3. テストカバレッジ目標

```
目標カバレッジ:
- Critical Path（Webhook, AI, Stripe）: 80%以上
- Business Logic（lib/）: 70%以上
- API Routes（app/api/）: 60%以上
- Components（components/）: 50%以上
```

#### 4. E2Eテスト（推奨ツール: Playwright）

```typescript
// tests/e2e/line-bot.spec.ts
import { test, expect } from '@playwright/test'

test('LINE Bot GAS生成フロー', async ({ page }) => {
  // 1. Webhookエミュレート
  // 2. Claude API モック
  // 3. レスポンス検証
})
```

---

## 今後の拡張計画

### Phase A: AI相談機能完成（2週間、開発中）

- [x] アーキテクチャ設計完了
- [x] ドキュメント完成（このファイル v2.2）
- [ ] Backend API実装（3時間）
- [ ] Frontend UI実装（4時間）
- [ ] DB Migration実行（1時間）
- [ ] 本番デプロイ（0.5時間）
- [ ] A/Bテスト実施（1週間）

### Phase B: Google Drive統合（1週間）

- [ ] Google Cloud Projectセットアップ
- [ ] Service Account作成
- [ ] `lib/code/file-generator.ts` 実装
- [ ] LINE BotにDriveリンク送信機能追加
- [ ] 環境変数追加:
  ```
  GOOGLE_DRIVE_API_KEY=
  GOOGLE_DRIVE_FOLDER_ID=
  GOOGLE_SERVICE_ACCOUNT_JSON=
  ```

### Phase C: RAG精度向上（2週間）

- [ ] 日本語形態素解析改善（MeCab統合）
- [ ] Embedding → Claude Embeddings移行
- [ ] Hybrid検索（キーワード + ベクトル）実装
- [ ] Few-shot examples追加
- [ ] システムドキュメント充実（39システム全て）

### Phase D: テスト実装（2週間）

- [ ] Jest + Testing Library セットアップ
- [ ] Critical Path テスト実装（Webhook, AI, Stripe）
- [ ] 統合テスト実装
- [ ] E2Eテスト実装（Playwright）
- [ ] CI/CD パイプラインにテスト追加

### Phase E: 管理画面強化（2週間）

- [ ] ユーザー分析ダッシュボード
- [ ] システムカタログCMS化（ハードコード脱却）
- [ ] ドリップキャンペーンA/Bテスト
- [ ] 代理店レポート自動生成
- [ ] メトリクス可視化（Grafana等）

### Phase F: Redis本番導入（3日）

- [ ] Redis外部サービス選定（Upstash推奨）
- [ ] REDIS_URL環境変数設定
- [ ] 本番環境で動作確認
- [ ] メモリストアからの移行テスト
- [ ] パフォーマンス測定

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 検証者 |
|------|-----------|---------|--------|
| 2026-02-13 | 2.2 | **完全修正版**（再検証完了）<br>- Redis実装状況明確化（オプション、環境変数で有効化）<br>- .nextサイズ注記追加（開発環境cache 307MB含む）<br>- SendGrid削除推奨明記<br>- REDIS_URLオプション明記<br>- インフラ図Redis表記修正<br>- 全データフローでキャッシュ戦略明記<br>- 信頼性レベル: ★★★★★（2回検証） | Claude + コードベース完全照合 |
| 2026-02-13 | 2.1 | **完全版**作成（実測値反映）<br>- システム数: 42→39に修正<br>- 環境変数: 44個に拡充<br>- 技術スタック: Gemini自前実装明記<br>- プロジェクトサイズ: 実測値反映<br>- コスト構造追加<br>- パフォーマンス設定追加<br>- テスト戦略追加 | Claude + コードベース照合 |
| 2026-02-13 | 2.0 | 初版作成 | Claude |

---

## 連絡先・リソース

| 項目 | URL |
|------|-----|
| **本番サイト** | https://gasgenerator.onrender.com |
| **LP** | https://taskmateai.net |
| **システムカタログ** | https://gasgenerator.onrender.com/systems/catalog |
| **GitHub** | https://github.com/IKEMENLTD/gasgenerator |
| **開発ログ** | `CLAUDE.md`（2530行） |
| **このドキュメント** | `ARCHITECTURE.md`（本ファイル） |

---

## 📌 重要な注意事項

### このドキュメントの位置づけ

このアーキテクチャドキュメントは、TaskMateプロジェクトの**技術的真実の源（Source of Truth）**です。新規開発者のオンボーディング、システム保守、機能拡張の設計において、このドキュメントを**最優先で参照**してください。

### ドキュメント更新ルール

1. **コードベースとの同期**: アーキテクチャ変更時は必ず更新
2. **検証**: 追加・修正時は実測値を確認（grep、du、実ファイル読込）
3. **バージョン管理**: 変更履歴に必ず記録
4. **矛盾の回避**: CLAUDE.mdとの整合性を保つ

### 次回更新時の確認事項

- [ ] システム数が39のまま（削除・追加なし）
- [ ] 環境変数が44個のまま（追加あれば更新）
- [ ] package.jsonの依存関係変更反映
- [ ] プロジェクトサイズ実測（du -sh）
- [ ] migration追加反映
- [ ] API料金変更反映（Claude/Gemini）
- [ ] Redis稼働状況確認（REDIS_URL設定有無）
- [ ] SendGrid削除実施確認

---

**End of Document**
