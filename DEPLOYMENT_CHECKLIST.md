# 🚀 TaskMate デプロイメントチェックリスト

## 📋 事前準備

### アカウント準備
- [ ] Supabaseアカウント作成済み
- [ ] Netlifyアカウント作成済み
- [ ] LINE Developersアカウント作成済み
- [ ] GitHubアカウント作成済み（推奨）

### LINE設定
- [ ] LINE Developers Consoleでプロバイダー作成
- [ ] Messaging APIチャネル作成
- [ ] Channel Secret取得
- [ ] Channel Access Token発行
- [ ] Webhook URL設定準備
- [ ] 友だち追加URL（lin.ee）取得

### Supabase設定
- [ ] プロジェクト作成
- [ ] プロジェクトURL取得
- [ ] Anon Key取得
- [ ] Service Role Key取得
- [ ] データベースパスワード設定

## 🔧 ローカル環境セットアップ

### 環境準備
- [ ] Node.js 18以上インストール
- [ ] Git インストール
- [ ] コードエディタ準備（VS Code推奨）

### プロジェクトセットアップ
- [ ] リポジトリクローン
- [ ] `npm install`実行
- [ ] `.env.local`ファイル作成
- [ ] 環境変数設定

### 環境変数設定チェック
```bash
# 以下のコマンドで検証
node scripts/validate-env.js
```

- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_URL
- [ ] SUPABASE_SERVICE_KEY
- [ ] LINE_CHANNEL_SECRET
- [ ] LINE_CHANNEL_ACCESS_TOKEN
- [ ] LINE_FRIEND_URL
- [ ] NEXT_PUBLIC_LINE_FRIEND_URL
- [ ] ADMIN_API_KEY（生成済み）
- [ ] ADMIN_API_SECRET（生成済み）
- [ ] REDIS_URL（オプション）

## 🗄️ データベースセットアップ

### Supabase Migration
- [ ] Supabase CLIインストール
- [ ] `supabase login`実行
- [ ] `supabase link`でプロジェクト接続
- [ ] `001_create_tracking_tables.sql`実行
- [ ] `002_create_transaction_function.sql`実行
- [ ] テーブル作成確認
  - [ ] tracking_links
  - [ ] tracking_sessions
  - [ ] user_states
- [ ] RLS有効化確認
- [ ] インデックス作成確認

## 🧪 ローカルテスト

### ビルドテスト
- [ ] `npm run build`成功
- [ ] TypeScriptエラーなし
- [ ] ESLintエラーなし

### 機能テスト
- [ ] `npm run dev`で起動
- [ ] http://localhost:3000 アクセス可能
- [ ] `/api/health`エンドポイント確認
- [ ] 管理画面アクセス（/admin/tracking）

### 動作確認
- [ ] トラッキングリンク作成
- [ ] QRコード生成
- [ ] トラッキングURL動作確認
- [ ] 認証トークン表示
- [ ] エラーページ表示

## 🌐 Netlifyデプロイ準備

### GitHubリポジトリ
- [ ] GitHubにリポジトリ作成
- [ ] ローカルからプッシュ
- [ ] .gitignoreで.env.local除外確認
- [ ] 不要ファイル除外確認

### Netlify設定
- [ ] Netlifyサイト作成
- [ ] GitHubリポジトリ接続
- [ ] ビルド設定
  - [ ] Build command: `npm run build`
  - [ ] Publish directory: `.next`
  - [ ] Node version: 18

### 環境変数設定（Netlify Dashboard）
- [ ] すべての環境変数を設定
- [ ] 本番用の値に更新
- [ ] LINE_FRIEND_URL確認

## 📡 デプロイ実行

### 初回デプロイ
- [ ] Netlifyでデプロイトリガー
- [ ] ビルドログ確認
- [ ] デプロイ成功確認
- [ ] カスタムドメイン設定（必要な場合）

### LINE Webhook設定
- [ ] デプロイ後のURL取得
- [ ] LINE DevelopersでWebhook URL設定
  - URL: `https://[your-domain]/api/webhook/line`
- [ ] Webhook利用をON
- [ ] Webhook検証

## ✅ デプロイ後確認

### システムヘルスチェック
- [ ] `/api/health`アクセス
- [ ] すべてのチェック項目がhealthy
- [ ] データベース接続確認
- [ ] LINE API接続確認

### 機能テスト（本番）
- [ ] 管理画面ログイン（Admin API Key使用）
- [ ] トラッキングリンク作成
- [ ] トラッキングURL動作確認
- [ ] LINE友だち追加フロー確認
- [ ] トークン認証フロー確認
- [ ] セッションデータ保存確認
- [ ] CSV出力機能確認

### 監視設定
- [ ] Netlify Functionsログ確認
- [ ] エラー通知設定（オプション）
- [ ] 定期クリーンアップ動作確認

## 🔐 セキュリティ最終確認

### 環境変数
- [ ] 本番用の強固なキー使用
- [ ] デフォルト値を使用していない
- [ ] シークレットが公開されていない

### アクセス制御
- [ ] 管理APIに認証設定
- [ ] CORS設定確認
- [ ] Rate Limiting有効

### データ保護
- [ ] HTTPS有効（Netlify自動）
- [ ] Supabase RLS有効
- [ ] SQLインジェクション対策確認

## 📊 パフォーマンス確認

### 初期表示
- [ ] ページロード時間測定
- [ ] Lighthouse スコア確認

### スケーラビリティ
- [ ] Redis設定（推奨）
- [ ] CDN有効（Netlify自動）

## 📝 ドキュメント

### 運用ドキュメント
- [ ] 環境変数一覧作成
- [ ] トラブルシューティング手順
- [ ] バックアップ手順
- [ ] リストア手順

### 引き継ぎ資料
- [ ] システム構成図
- [ ] API仕様書
- [ ] データベース設計書

## 🎉 リリース

- [ ] ステークホルダーへの通知
- [ ] 運用開始日時の決定
- [ ] サポート体制の確立
- [ ] 初期モニタリング計画

---

## 📌 重要な注意事項

1. **環境変数の管理**
   - 本番環境の環境変数は安全に管理
   - 定期的にキーのローテーション

2. **バックアップ**
   - Supabaseの自動バックアップ確認
   - 定期的なデータエクスポート

3. **監視**
   - 日次でヘルスチェック確認
   - エラーログの定期確認

4. **アップデート**
   - 依存関係の定期更新
   - セキュリティパッチの適用

---

✅ すべてのチェックが完了したら、本番環境でのサービス提供を開始できます。