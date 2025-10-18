# 4段階代理店制度 実装ガイド

## 実装完了した内容

### 1. データベーススキーマ拡張
✅ **ファイル**: `netlify-tracking/database/migration_002_referral_system.sql`

以下のカラムを `agencies` テーブルに追加:
- `parent_agency_id` - 親代理店のID
- `level` - 階層レベル (1〜4)
- `own_commission_rate` - 自己報酬率

新規テーブル:
- `agency_commission_distributions` - コミッション分配記録

### 2. コミッション計算ユーティリティ
✅ **ファイル**: `netlify-tracking/netlify/functions/utils/referral-commission.js`

主要関数:
- `calculateCommissions()` - コミッション計算と分配
- `getStandardCommissionRate()` - 階層に応じた標準報酬率取得
- `getAgencyHierarchy()` - 代理店階層チェーン取得

### 3. 擬似コードとドキュメント
✅ **ファイル**:
- `REFERRAL_SYSTEM_SPEC.md` - システム仕様書
- `REFERRAL_PSEUDOCODE.md` - 擬似コード実装
- `IMPLEMENTATION_GUIDE.md` - このファイル

---

## 今後の実装ステップ

### STEP 1: データベースマイグレーション実行

Supabase管理画面でマイグレーションSQLを実行:

```bash
# 1. Supabaseダッシュボードにログイン
# https://supabase.com/dashboard

# 2. プロジェクトを選択

# 3. SQL Editorを開く

# 4. migration_002_referral_system.sql の内容をコピー＆実行
```

**注意事項**:
- 既存の `agencies` テーブルにカラムを追加するため、既存データに影響があります
- バックアップを取ってから実行してください
- 既存の代理店は全て `level=1` として初期化されます

### STEP 2: 代理店登録処理の修正

**現在の問題**:
- 招待コードが `agency_tracking_links.tracking_code` を参照している
- これを `agencies.code` に変更する必要がある

**修正内容** (`agency-register.js`):

```javascript
// 現在のコード（行148-152）
const { data: invitationLink, error: invitationError } = await supabase
    .from('agency_tracking_links')
    .select('id, agency_id, is_active')
    .eq('tracking_code', invitation_code)
    .single();

// ↓ 以下に変更 ↓

// 親代理店を招待コードから検索
const { data: parentAgency, error: parentError } = await supabase
    .from('agencies')
    .select('id, code, name, level, own_commission_rate, status')
    .eq('code', invitation_code)
    .single();
```

**追加ロジック**:
1. 親代理店の `level` を取得
2. 新規代理店の `level = parent.level + 1` を設定
3. 最大階層（level 4）チェック
4. `own_commission_rate` を設定

### STEP 3: コミッション計算API の作成

新しいNetlify Function を作成:

**ファイル**: `netlify-tracking/netlify/functions/agency-calculate-commission.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const { calculateCommissions } = require('./utils/referral-commission');
const logger = require('./utils/logger');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    // ... CORSヘッダー、認証チェック ...

    const { conversion_id, deal_amount } = JSON.parse(event.body);

    // コンバージョン情報を取得して成約代理店IDを特定
    const { data: conversion } = await supabase
        .from('agency_conversions')
        .select('id, tracking_link_id, agency_id')
        .eq('id', conversion_id)
        .single();

    // コミッション計算
    const result = await calculateCommissions(
        supabase,
        deal_amount,
        conversion.agency_id,
        conversion_id
    );

    return {
        statusCode: 200,
        body: JSON.stringify(result)
    };
};
```

### STEP 4: フロントエンド実装

#### 4.1 ダッシュボードに階層情報を表示

**ファイル**: `netlify-tracking/agency/dashboard.js`

```javascript
// agencyInfo に階層情報を追加
agencyInfo: {
    id: '',
    code: '',
    name: '',
    level: 1,  // 追加
    own_commission_rate: 20.00,  // 追加
    parent_agency_id: null  // 追加
}
```

#### 4.2 招待コード表示UI

ダッシュボードに追加:

```html
<div class="bg-white p-6 rounded-lg shadow">
    <h3 class="text-lg font-semibold mb-4">あなたの招待コード</h3>
    <div class="flex items-center space-x-4">
        <code class="bg-gray-100 px-4 py-2 rounded font-mono text-lg">
            <span x-text="agencyInfo.code"></span>
        </code>
        <button @click="copyToClipboard(agencyInfo.code, $event)"
                class="bg-emerald-600 text-white px-4 py-2 rounded">
            <i class="fas fa-copy mr-2"></i>コピー
        </button>
    </div>
    <p class="text-sm text-gray-600 mt-2">
        このコードを新規代理店に共有して、あなたの下位代理店として招待できます
    </p>
</div>
```

#### 4.3 階層情報の表示

```html
<div class="bg-white p-6 rounded-lg shadow">
    <h3 class="text-lg font-semibold mb-4">あなたの階層情報</h3>
    <div class="grid grid-cols-2 gap-4">
        <div>
            <p class="text-sm text-gray-600">階層レベル</p>
            <p class="text-2xl font-bold text-emerald-600">
                <span x-text="agencyInfo.level"></span>次代理店
            </p>
        </div>
        <div>
            <p class="text-sm text-gray-600">自己報酬率</p>
            <p class="text-2xl font-bold text-emerald-600">
                <span x-text="agencyInfo.own_commission_rate"></span>%
            </p>
        </div>
    </div>
</div>
```

### STEP 5: テストとデバッグ

#### テストシナリオ

1. **1次代理店の登録**
   - 招待コード: なし（または特別な値）
   - 期待結果: level=1, rate=20%

2. **2次代理店の登録**
   - 招待コード: 1次代理店のcode
   - 期待結果: level=2, rate=18%, parent=1次代理店

3. **コミッション計算**
   - 4次代理店が¥100,000を成約
   - 期待結果:
     - 4次: ¥14,000
     - 3次: ¥2,000
     - 2次: ¥2,000
     - 1次: ¥2,000
     - 合計: ¥20,000

---

## 次のアクション

**優先順位順:**

1. ✅ マイグレーションSQL作成（完了）
2. ✅ コミッション計算ユーティリティ作成（完了）
3. ⏳ **次はこれ**: `agency-register.js` の修正
4. ⏳ `agency-calculate-commission.js` の作成
5. ⏳ フロントエンド実装
6. ⏳ テストデータ作成と動作確認

---

## よくある質問

### Q1: 既存の代理店はどうなりますか？
A: マイグレーション実行時に全て `level=1` として初期化されます。必要に応じて手動で調整できます。

### Q2: 5次代理店は作れますか？
A: システムは最大4階層に制限されています。4次代理店はさらに下位代理店を招待できません。

### Q3: 報酬率は変更できますか？
A: `own_commission_rate` カラムを直接変更することで、個別の代理店の報酬率をカスタマイズできます。

### Q4: リファラルコミッションは自動で支払われますか？
A: いいえ。`agency_commission_distributions` テーブルに記録されますが、実際の支払いは `payment_status` を管理者が手動で更新する必要があります。

---

## サポート

問題が発生した場合:
1. Netlify Functions のログを確認
2. Supabase のログを確認
3. ブラウザの開発者ツールでネットワークタブを確認
