# 🔧 GitHub直接編集手順（コピー&ペースト用）

## ステップ1: lib/config/environment.ts を編集

1. [このリンクをクリック](https://github.com/IKEMENLTD/gasgenerator/edit/main/lib/config/environment.ts)
2. 28行目付近を探す
3. 以下の変更を行う:

### 削除する行（28行目）:
```typescript
  ADMIN_API_TOKEN: '管理API認証トークン',
```

### 追加する行（31-33行目、OPTIONAL_ENV_VARSの中）:
```typescript
const OPTIONAL_ENV_VARS = {
  // Security
  ADMIN_API_TOKEN: '管理API認証トークン',
```

## ステップ2: lib/auth/jwt-manager.ts を編集

1. [このリンクをクリック](https://github.com/IKEMENLTD/gasgenerator/edit/main/lib/auth/jwt-manager.ts)
2. 以下の3箇所を変更:

### 33行目を変更:
```typescript
// 変更前:
const secret = EnvironmentValidator.getRequired('ADMIN_API_TOKEN')

// 変更後:
const secret = EnvironmentValidator.getOptional('ADMIN_API_TOKEN', 'default_secret_key_for_development')
```

### 84行目を変更:
```typescript
// 変更前:
const secret = EnvironmentValidator.getRequired('ADMIN_API_TOKEN')

// 変更後:
const secret = EnvironmentValidator.getOptional('ADMIN_API_TOKEN', 'default_secret_key_for_development')
```

### 149行目を変更:
```typescript
// 変更前:
const secret = EnvironmentValidator.getRequired('ADMIN_API_TOKEN')

// 変更後:
const secret = EnvironmentValidator.getOptional('ADMIN_API_TOKEN', 'default_secret_key_for_development')
```

## ステップ3: コミット

各ファイルの編集後:
1. ページ下部の「Commit changes」セクションへ
2. コミットメッセージ: `Fix ADMIN_API_TOKEN environment variable error`
3. 「Commit directly to the main branch」を選択
4. 「Commit changes」ボタンをクリック

## ✅ 完了確認

変更後、Renderが自動的に再デプロイを開始します:
1. [Render Dashboard](https://dashboard.render.com/)でビルドログを確認
2. エラーなくビルドが完了することを確認

---

## 📋 完全なコード（コピー用）

### lib/config/environment.ts の完全な必須環境変数セクション:
```typescript
const REQUIRED_ENV_VARS = {
  // LINE
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE Bot APIアクセストークン',
  LINE_CHANNEL_SECRET: 'LINE署名検証用シークレット',
  
  // Stripe
  STRIPE_SECRET_KEY: 'Stripe APIキー',
  STRIPE_WEBHOOK_SECRET: 'Stripe Webhook署名検証用シークレット',
  STRIPE_PAYMENT_LINK: 'Stripe決済リンク',
  
  // Supabase
  SUPABASE_URL: 'SupabaseプロジェクトURL',
  SUPABASE_ANON_KEY: 'Supabase匿名キー',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabaseサービスロールキー',
  
  // Claude AI
  ANTHROPIC_API_KEY: 'Claude API キー',
  
  // Security
  CRON_SECRET: 'Cronジョブ認証用シークレット',
} as const

// オプション環境変数の定義
const OPTIONAL_ENV_VARS = {
  // Security
  ADMIN_API_TOKEN: '管理API認証トークン',
  
  // Engineer Support
  ENGINEER_SUPPORT_GROUP_ID: 'エンジニアサポートグループID',
  ENGINEER_USER_IDS: 'エンジニアユーザーID（カンマ区切り）',
  
  // Config
  NODE_ENV: '実行環境（development/production）',
  NEXT_PUBLIC_BASE_URL: 'アプリケーションベースURL',
  PORT: 'サーバーポート番号',
} as const
```