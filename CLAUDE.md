# TaskMate Development Log

---
## 🚨 2026-02-02: 緊急引継ぎ情報（次セッション必読）

### 現在のステータス: Renderデプロイ中

**最新コミット**: `709a952` - qrcode型定義ファイル追加
**デプロイ状況**: Renderで再ビルド中（成功を待っている状態）

---

### 上長からの依頼（本日対応中）

りゅうさん（上長）からの連絡:
> 「今日明日で、TaskMateって完成したりしますかね？」
> 「Stripeのログイン言ってもらえたら一緒にやるので」
> 「テストモードで課金したら実際に動くかも見ましょう」

**回答**: Stripe課金フローは今日明日で動かせる状態

**待ち事項**: Stripeログイン情報（りゅうさんから後ほどもらう予定）

---

### 本日（2026-02-02）完了した作業

#### 1. Stripe連携用DBテーブル作成
**ファイル**: `migrations/002_stripe_tables.sql`（新規作成）

| テーブル | 用途 |
|---------|------|
| `stripe_events` | Webhook重複防止 |
| `refunds` | 返金記録 |
| `payment_history` | 決済履歴 |
| `users`への列追加 | blocked_at, stripe_customer_id, payment_start_date等 |

**⚠️ Supabaseで実行待ち**

#### 2. プレミアムチェック改善
**ファイル**: `app/api/share/create/route.ts`
- `isProfessional`も考慮するように修正
- TODOコメント削除

#### 3. QRコード生成実装
**ファイル**: `app/api/share/create/route.ts`
- qrcodeパッケージを使用
- 型定義ファイル追加: `types/qrcode.d.ts`（Renderビルドエラー対策）

#### 4. Stripe Webhook強化
**ファイル**: `app/api/stripe/webhook/route.ts`
- 決済履歴を`payment_history`テーブルに記録する処理追加

#### 5. ユーザーブロック機能
**ファイル**: `app/api/webhook/route.ts`
- スパムユーザーの`blocked_at`記録実装
- `supabaseAdmin`インポート追加

#### 6. エラー自動修正ロジック
**ファイル**: `lib/error-recovery/auto-fixer.ts`
- 関数修正ロジック（try-catch自動挿入）実装

#### 7. LINE Bot UX改善（システム一覧を先頭に）
**修正箇所**:
- `app/api/webhook/route.ts`: メインメニュー、LLM応答、再追加時、プレミアムユーザー
- `lib/line/message-templates.ts`: ウェルカムメッセージ

**変更後のquickReply順序**:
```
📦 システム一覧    ← 先頭に移動
📊 スプレッドシート
📧 Gmail
📅 カレンダー
👨‍💻 エンジニア相談
📋 メニュー
```

#### 8. システムカタログページ改善
**ファイル**: `app/systems/catalog/page.tsx`
- `isSidebarOpen`のデフォルト値を`true`に変更
- モバイルでアクセス時、最初からサイドバー（システム一覧）が開いている

---

### デプロイ履歴（本日）

| コミット | 内容 | 結果 |
|---------|------|------|
| `e3a1f5e` | 機能追加（システム一覧先頭等） | ❌ ビルドエラー |
| `1325754` | @types/qrcodeとeslint追加 | ❌ ビルドエラー |
| `709a952` | 型定義ファイル追加 | 🔄 ビルド中 |

**ビルドエラーの原因と解決**:
- Renderは本番ビルドで`devDependencies`をインストールしない
- `@types/qrcode`はdevDependenciesのため利用不可
- → `types/qrcode.d.ts`を直接作成して解決

---

### 次のセッションでやるべきこと

#### 優先度：高
1. **Renderデプロイ成功確認**
   - ビルドログを確認
   - 失敗した場合はエラー内容を確認して修正

2. **LINEで動作確認**
   - 友だち追加し直す or ブロック解除
   - 「メニュー」送信 → 「📦 システム一覧」が先頭か確認
   - システムカタログページでサイドバーが開いているか確認

3. **Stripe連携（りゅうさんと一緒に）**
   - Stripeダッシュボードにログイン
   - テスト用環境変数をRenderに設定:
     ```
     STRIPE_SECRET_KEY=sk_test_xxxxx
     STRIPE_WEBHOOK_SECRET=whsec_xxxxx
     STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_5kQ6oHdq63gzbxLbdQ8EM00
     ```
   - Webhook設定:
     ```
     Endpoint URL: https://gasgenerator.onrender.com/api/stripe/webhook
     Events: checkout.session.completed, customer.subscription.deleted, charge.refunded
     ```
   - テストカード（4242 4242 4242 4242）で決済テスト

4. **DBマイグレーション実行（Supabase）**
   - `migrations/001_subscription_and_rag_tables.sql`
   - `migrations/002_stripe_tables.sql`

#### 優先度：中
- Google Drive統合（`lib/code/file-generator.ts`）
- RAG精度向上（日本語キーワード検索）

---

### Stripe連携の現状（95%完成）

**実装済み**:
- ✅ Webhook署名検証（HMAC-SHA256）
- ✅ リプレイ攻撃防止（5分以内チェック）
- ✅ checkout.session.completed処理
- ✅ プラン自動判定（金額ベース: 50,000円以上→professional）
- ✅ 重複イベント防止（stripe_eventsテーブル）
- ✅ サブスクリプションキャンセル処理
- ✅ 返金処理
- ✅ LINE通知送信
- ✅ 決済履歴記録

**テスト用Payment Link（作成済み）**:
```
https://buy.stripe.com/test_5kQ6oHdq63gzbxLbdQ8EM00
商品ID: prod_T3jvUMrAIKVOwW
```

**テスト手順**:
1. LINEで「プレミアムプランを見る」送信
2. Payment Linkタップ → Stripe決済ページ
3. テストカード入力（4242 4242 4242 4242）
4. 決済完了
5. 確認:
   - Renderログでwebhook受信確認
   - Supabase usersテーブルでsubscription_status更新確認
   - LINEで「💎 決済が完了しました！」メッセージ受信確認

---

### DBマイグレーション（実行待ち）

**001_subscription_and_rag_tables.sql**:
- subscription_plans（プラン定義）
- user_subscriptions（ユーザーのサブスク状態）
- systems（システムカタログ）
- system_documents（RAG用ドキュメント）
- system_embeddings（ベクトル埋め込み）
- user_downloads（ダウンロード履歴）
- user_system_access（アクセス権管理）
- RPC関数（can_download_system, execute_system_download等）

**002_stripe_tables.sql**:
- stripe_events（Webhook重複防止）
- refunds（返金記録）
- payment_history（決済履歴）
- usersテーブルへの列追加

---

### プロジェクト概要

**TaskMate**（正式名: gas-generator）
- Google Apps Script（GAS）の自動化コード生成をLINE Botを通じてAIで提供するSaaS
- 本番URL: https://gasgenerator.onrender.com
- カタログURL: https://gasgenerator.onrender.com/systems/catalog
- GitHub: https://github.com/IKEMENLTD/gasgenerator

**技術スタック**:
- Next.js 14.2.32 + React 18 + TypeScript 5
- Anthropic SDK（Claude API）
- Supabase（PostgreSQL + pgvector）
- LINE Bot SDK
- Stripe SDK
- Render（ホスティング、2GB RAM）

**ビジネスモデル**:
| プラン | 月額 | 契約期間 | 機能 |
|--------|------|----------|------|
| ベーシック | ¥10,000 | 6ヶ月 | 3システム閲覧、月1DL |
| プロフェッショナル | ¥50,000 | 6ヶ月 | 全システム、月5DL |

---

### 重要なファイルパス

| ファイル | 説明 |
|---------|------|
| `app/api/webhook/route.ts` | LINE Webhook（最重要） |
| `app/api/stripe/webhook/route.ts` | Stripe Webhook |
| `app/systems/catalog/page.tsx` | システムカタログページ |
| `lib/premium/premium-checker.ts` | プレミアムチェック |
| `lib/line/message-templates.ts` | LINEメッセージテンプレート |
| `lib/rag/qa-service.ts` | RAG QA処理 |
| `migrations/` | DBマイグレーション |
| `types/qrcode.d.ts` | QRコード型定義（本日追加） |

---

### 注意事項

1. **Renderビルド**: devDependenciesはインストールされない → 型定義は`types/`に直接配置
2. **Git認証**: IKEMENLTDアカウントで認証済み
3. **netlify-tracking/frontend/**: git管理対象外
4. **SVGにtitle属性を使わない**: TypeScriptエラーになる

---

### 環境変数（必須）

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# LINE Bot
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

# Claude AI
ANTHROPIC_API_KEY=

# Stripe（設定待ち）
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_xxxxx

# その他
ADMIN_API_KEY=
CRON_SECRET=
```

---

### カスタムスラッシュコマンド

- `/debug` - デバッグとエラー解決
- `/research` - コードベース調査
- `/implement` - 新機能実装
- `/refactor` - リファクタリング
- `/test` - テスト作成・実行
- `/review` - コードレビュー

---
## 🚨 引継ぎ情報ここまで
---

**重要な指示: Claude Code利用時の進捗ログ記録について**

このCLAUDE.mdファイルは、Claude Codeとの全ての作業セッションにおける半永久的なメモリとして機能します。
Claude Codeを利用する際は、必ず以下のルールを守ってください:

1. **作業開始時**: このファイルを最初に読み込み、前回までの文脈を理解する
2. **作業中**: 重要な決定事項、実装内容、問題と解決策を随時記録する
3. **作業完了時**: セッション終了前に必ず今回の作業内容をまとめて追記する
4. **形式**: 日付見出し（## YYYY-MM-DD:）で区切り、Markdown形式で記述する
5. **内容**:
   - 実装した機能の概要
   - 変更したファイルのリスト
   - 技術的な決定事項と理由
   - 未解決の課題や次のステップ
   - 重要な設定やURL、認証情報など（機密情報は除く）

これにより、次回のセッションでClaude Codeが前回の作業内容を正確に把握し、一貫性のある開発を継続できます。

---

## 過去のセッション履歴（参考）

### 2026-01-27: 新料金プラン・RAGシステム基盤実装
- migrations/001_subscription_and_rag_tables.sql 作成
- lib/supabase/subscription-types.ts, subscription-queries.ts 作成
- lib/rag/embedding-service.ts, qa-service.ts 作成
- メモリ最適化（MAX_SESSIONS: 100→20、SESSION_TIMEOUT: 2h→30m）

### 2026-01-28: LINE Bot RAG統合
- システム一覧コマンド実装
- RAGクエリ応答実装
- キーワード検索の日本語処理改善

### 2025-11-07: index.htmlページ改善
- GAS説明セクション追加
- LINEチャットモックアップを動画に置き換え
- 料金プラン詳細セクション追加
- ローディングスクリーン時間短縮（4秒→1.5秒）

### 2025-11-05: デモページ実装・Netlifyデプロイ
- /demo ページ実装（LINE風チャットUI）
- Netlifyデプロイエラー修正
- 静的HTML + Next.js共存パターン確立

---

## 26システム一覧

| ID | システム名 |
|----|-----------|
| 01 | 営業日報システム |
| 02 | 失客アラートシステム |
| 03 | 期限管理システム |
| 04 | リピート促進メールシステム |
| 05 | 口コミ依頼自動化システム |
| 06 | 客単価分析＋アップセル提案 |
| 07 | 納期アラートシステム |
| 08 | 必須タスクチェックリスト |
| 09 | LTV（顧客生涯価値）計算 |
| 10 | 離脱顧客掘り起こし |
| 11 | 有効期限管理（資格・免許） |
| 12 | 紹介プログラム完全管理 |
| 13 | 価格テストA/B管理 |
| 14 | キャンペーン効果測定 |
| 15 | Webアプリ開発マニュアル |
| 16 | 経費精算ワークフロー |
| 17 | 請求書自動生成＋送付 |
| 18 | 売上日報自動集計 |
| 19 | 契約更新リマインド |
| 20 | 定例MTGアジェンダ自動収集 |
| 21 | ダブルブッキング防止（予約） |
| 22 | 価格表・見積基準管理 |
| 23 | 議事録→タスク自動抽出 |
| 24 | 勤怠集計→給与計算連携 |
| 25 | 承認フロー強制 |
| 26 | 入金消込チェッカー |

全システムiframeプレビュー対応済み。

---

**このドキュメントで新しいセッションを開始する際、TaskMateプロジェクトの全体像を把握して開発を継続できます。**
