# 本番環境セットアップガイド

## TailwindCSSの本番設定

### 開発環境（現在）
現在はCDN版を使用しています。これは開発時には便利ですが、本番環境では推奨されません。

### 本番環境への移行手順

1. **依存関係のインストール**
```bash
npm install
```

2. **TailwindCSSのビルド**
```bash
npm run build
```

3. **HTMLファイルの更新**
以下のファイルのTailwindCDN参照を置き換えます：
- `/agency/index.html`
- `/admin/index.html`
- `/index.html`

**変更前：**
```html
<script src="https://cdn.tailwindcss.com"></script>
```

**変更後：**
```html
<link rel="stylesheet" href="/css/output.css">
```

4. **開発時のウォッチモード**
```bash
npm run build:watch
```

## 環境変数の本番設定

Netlify管理画面で以下の環境変数を設定：

1. **Site settings** → **Environment variables**
2. 以下を追加：
   - `NODE_ENV`: `production`
   - `SUPABASE_URL`: 本番用URL
   - `SUPABASE_SERVICE_ROLE_KEY`: 本番用キー
   - `JWT_SECRET`: 強力なランダム文字列（32文字以上）
   - その他必要な環境変数

## セキュリティチェック

- [ ] デバッグログを無効化
- [ ] テストアカウントを削除
- [ ] HTTPS強制を有効化
- [ ] CORS設定を特定ドメインに制限

## デプロイコマンド

```bash
# 本番デプロイ
npm run deploy

# または手動で
npm run build
netlify deploy --prod
```

## パフォーマンス最適化

1. **TailwindCSSのパージ設定**
   - `tailwind.config.js`の`content`配列が正しく設定されているか確認
   - 不要なCSSが削除されているか確認

2. **JavaScriptの最適化**
   - Alpine.jsのプロダクションビルドを使用
   - 不要なconsole.logを削除

3. **画像の最適化**
   - 適切なフォーマット（WebP推奨）
   - 適切なサイズ
   - 遅延読み込み設定

## 監視とログ

1. **Netlify Functions**のログ
   - Netlify管理画面 → Functions → Logs

2. **エラー監視**
   - Sentryやログ集約サービスの設定を検討

3. **パフォーマンス監視**
   - Google Lighthouseで定期的にチェック
   - Core Web Vitalsの監視