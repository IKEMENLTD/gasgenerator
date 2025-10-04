# 📊 TaskMate 流入経路測定システム - 完全版

## 🚀 システム構成

### 1. **管理者ダッシュボード** (`/admin/`)
- **URL**: `https://taskmateai.net/admin/`
- **機能**: システム全体の管理
- **認証**: admin / TaskMate2024Admin!

### 2. **代理店ダッシュボード** (`/agency/`)
- **URL**: `https://taskmateai.net/agency/`
- **機能**: 代理店専用の管理画面
- **認証**: JWT認証（メール/パスワード）

### 3. **トラッキングリダイレクト**
- **URL形式**: `https://taskmateai.net/t/{tracking_code}`
- **LINE URL**: `https://lin.ee/4NLfSqH`

## 📁 ファイル構成

```
netlify-tracking/
├── admin/                      # システム管理者用
│   ├── index.html             # 管理画面UI（日本語・緑テーマ）
│   └── dashboard.js           # 管理機能
│
├── agency/                     # 代理店用
│   ├── index.html             # 代理店ダッシュボードUI
│   └── dashboard.js           # 代理店機能
│
├── netlify/
│   └── functions/             # サーバーレス関数
│       ├── validate-admin.js         # 管理者認証
│       ├── create-tracking-link.js   # リンク作成（管理者用）
│       ├── get-tracking-stats.js     # 統計取得（管理者用）
│       ├── track-redirect.js         # トラッキングリダイレクト
│       ├── stripe-webhook.js         # Stripe決済処理
│       ├── agency-auth.js            # 代理店認証
│       ├── agency-create-link.js     # リンク作成（代理店用）
│       ├── agency-stats.js           # 統計取得（代理店用）
│       └── agency-commission.js      # 手数料管理
│
├── database/
│   ├── schema.sql                    # 代理店システムスキーマ
│   └── migrations/                   # データベース移行
│
├── netlify.toml                      # Netlify設定
└── package.json                       # 依存関係

```

## 🔄 トラッキングフロー

```mermaid
graph TD
    A[代理店がリンク作成] -->|tracking_code生成| B[トラッキングURL]
    B -->|ユーザークリック| C[/t/ABC123]
    C -->|訪問記録| D[agency_tracking_visits]
    C -->|リダイレクト| E[LINE友達追加]
    E -->|友達追加完了| F[agency_conversions]
    F -->|Stripe決済| G[決済成果記録]
    G -->|手数料計算| H[agency_commissions]
```

## 📊 データベーステーブル

### 既存テーブル（管理者システム）
- `tracking_links` - 管理者用トラッキングリンク
- `tracking_sessions` - セッション管理
- `user_states` - ユーザー状態

### 新規テーブル（代理店システム）
- `agencies` - 代理店マスター
- `agency_users` - 代理店ユーザー
- `agency_tracking_links` - 代理店用リンク
- `agency_tracking_visits` - 訪問記録
- `agency_conversions` - コンバージョン
- `agency_commissions` - 手数料管理

## 🔑 環境変数設定（Netlify）

```bash
# Supabase
SUPABASE_URL=https://tshqyqklixwfzkkqhlix.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 管理者認証
ADMIN_USERNAME=admin
ADMIN_PASSWORD=TaskMate2024Admin!

# JWT
JWT_SECRET=your-secure-jwt-secret-key-here

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# LINE
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
```

## 🚀 デプロイ手順

### 1. GitHubにプッシュ
```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking
git init
git add .
git commit -m "Complete tracking system with agency management"
git remote add origin https://github.com/yourusername/taskmate-tracking.git
git push -u origin main
```

### 2. Netlifyでデプロイ
1. Netlifyにログイン
2. "Import an existing project"を選択
3. GitHubリポジトリを選択
4. 環境変数を設定
5. デプロイ

### 3. Supabaseでデータベース設定
```sql
-- 1. 管理者用テーブル作成
-- /database/migrations/001_create_tracking_tables.sql を実行

-- 2. 代理店用テーブル作成
-- /database/schema.sql を実行

-- 3. テスト代理店作成
INSERT INTO agencies (code, name, contact_email, commission_rate)
VALUES ('AGENCY001', 'テスト代理店', 'test@agency.com', 15.00);

-- 4. テストユーザー作成（パスワードは別途ハッシュ化）
INSERT INTO agency_users (agency_id, email, password_hash, name, role)
VALUES (
  (SELECT id FROM agencies WHERE code = 'AGENCY001'),
  'test@agency.com',
  '$2b$10$xxxxx', -- bcryptでハッシュ化したパスワード
  'テストユーザー',
  'owner'
);
```

## 📈 機能一覧

### 管理者機能
- ✅ トラッキングリンク作成・管理
- ✅ 全体統計の確認
- ✅ 訪問分析
- ✅ LINEユーザー管理
- ✅ 日本語UI
- ✅ グリーンテーマ

### 代理店機能
- ✅ 独自のトラッキングリンク作成
- ✅ クリック数・コンバージョン測定
- ✅ リアルタイム統計
- ✅ 手数料管理
- ✅ 振込先設定
- ✅ パフォーマンス分析

### トラッキング機能
- ✅ クリック測定
- ✅ デバイス・ブラウザ分析
- ✅ LINE友達追加追跡
- ✅ Stripe決済追跡
- ✅ セッション管理
- ✅ 手数料自動計算

## 🔒 セキュリティ

- JWT認証
- Supabase RLS（行レベルセキュリティ）
- Stripe Webhook署名検証
- 環境変数による認証情報管理
- サーバーサイド認証のみ（クライアント側認証なし）

## 📱 対応デバイス

- デスクトップ（Chrome, Safari, Firefox, Edge）
- モバイル（iOS Safari, Android Chrome）
- タブレット（iPad, Android Tablet）
- LINE内ブラウザ

## 🎯 特徴

1. **完全な属性追跡**: クリック → LINE友達追加 → Stripe決済まで
2. **マルチテナント対応**: 複数代理店の独立管理
3. **自動手数料計算**: 売上に応じた自動計算
4. **リアルタイム分析**: 即座に反映される統計
5. **日本語対応**: 完全日本語化されたUI

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. 環境変数が正しく設定されているか
2. データベーステーブルが作成されているか
3. Netlify Functionsが正常にデプロイされているか
4. Stripe Webhookが設定されているか