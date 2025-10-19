# LINE連携システム - セキュリティ監査レポート

## 🔴 重大な問題（即座に修正が必要）

### 1. **agency-complete-registration.js - CSRF保護なし**

**問題:**
- LINE連携完了エンドポイントにCSRF保護がない
- 攻撃者が任意のLINEコードとregistration_tokenを送信できる

**影響:**
- アカウント乗っ取りのリスク
- 不正なLINE連携の可能性

**修正方法:**
```javascript
// CSRF保護を追加
const { validateCsrfProtection, createCsrfErrorResponse } = require('./utils/csrf-protection');

const csrfValidation = validateCsrfProtection(event);
if (!csrfValidation.valid) {
    return createCsrfErrorResponse(csrfValidation.error);
}
```

**優先度:** 🔴 CRITICAL

---

### 2. **agency-complete-registration.js - redirect_uri検証なし**

**問題:**
- redirect_uriの検証がない
- オープンリダイレクト脆弱性の可能性

**影響:**
- フィッシング攻撃に悪用される可能性
- LINEアクセストークンが攻撃者のサイトに送信される可能性

**修正方法:**
```javascript
// 許可されたcallback URLのリスト
const ALLOWED_CALLBACK_URLS = [
    'https://taskmateai.net/agency/',
    'http://localhost:3000/agency/',  // 開発環境
    process.env.LINE_LOGIN_CALLBACK_URL
];

// redirect_uriを検証
if (!ALLOWED_CALLBACK_URLS.some(url => redirect_uri.startsWith(url))) {
    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
            error: '不正なリダイレクトURIです'
        })
    };
}
```

**優先度:** 🔴 CRITICAL

---

### 3. **agency-get-line-url.js - registration_token検証なし**

**問題:**
- registration_tokenがDBに存在するか検証していない
- 攻撃者がランダムなトークンでLINE URLを取得できる

**影響:**
- 無効なトークンでLINE連携フローを開始できる
- DoS攻撃の可能性

**修正方法:**
```javascript
// DBでregistration_tokenを検証
const { data: agency } = await supabase
    .from('agencies')
    .select('id')
    .eq('registration_token', registration_token)
    .eq('status', 'pending_line_verification')
    .single();

if (!agency) {
    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
            error: '無効な登録トークンです'
        })
    };
}
```

**優先度:** 🔴 CRITICAL

---

## 🟠 高優先度の問題

### 4. **レート制限なし**

**問題:**
- `agency-get-line-url.js` と `agency-complete-registration.js` にレート制限がない
- スパム攻撃やDoS攻撃に脆弱

**修正方法:**
```javascript
const { applyRateLimit, STRICT_RATE_LIMIT } = require('./utils/rate-limiter');

const rateLimitResponse = applyRateLimit(event, STRICT_RATE_LIMIT);
if (rateLimitResponse) {
    return rateLimitResponse;
}
```

**優先度:** 🟠 HIGH

---

### 5. **registration_tokenにタイムアウトなし**

**問題:**
- registration_tokenが無期限に有効
- 古いトークンが攻撃に悪用される可能性

**修正方法:**
```sql
-- migration: registration_tokenにタイムスタンプを追加
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS registration_token_expires_at TIMESTAMP;

-- 期限切れトークンを無効化するクリーンアップ関数
CREATE OR REPLACE FUNCTION cleanup_expired_registration_tokens()
RETURNS void AS $$
BEGIN
    UPDATE agencies
    SET registration_token = NULL,
        registration_token_expires_at = NULL
    WHERE registration_token IS NOT NULL
    AND registration_token_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

**バックエンド検証:**
```javascript
// トークン有効期限チェック（15分）
if (agency.registration_token_expires_at) {
    const expiresAt = new Date(agency.registration_token_expires_at);
    if (expiresAt < new Date()) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: '登録トークンの有効期限が切れています。最初から登録をやり直してください。'
            })
        };
    }
}
```

**優先度:** 🟠 HIGH

---

### 6. **LINEコード再利用攻撃対策なし**

**問題:**
- 同じLINE認証コードを複数回使用できる可能性
- Code Replay Attack に脆弱

**修正方法:**
LINE APIは通常、コードを1回しか使えないようにしていますが、念のため使用済みフラグを立てる:

```javascript
// LINEコード使用履歴を記録（オプション）
// すでにLINE User IDが設定されている場合はエラー
if (agency.line_user_id) {
    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
            error: 'この代理店は既にLINE連携済みです'
        })
    };
}
```

**優先度:** 🟠 HIGH

---

## 🟡 中優先度の問題

### 7. **トランザクション処理が不完全**

**問題:**
- 代理店更新とユーザー更新が別々のクエリ
- 片方が失敗した場合のロールバックがない

**修正方法:**
Supabaseのトランザクション機能を使用するか、エラー時に手動でロールバック:

```javascript
// 代理店を更新
const { error: updateError } = await supabase
    .from('agencies')
    .update({...})
    .eq('id', agency.id);

if (updateError) {
    throw updateError;
}

try {
    // ユーザーをアクティベーション
    const { error: userUpdateError } = await supabase
        .from('agency_users')
        .update({ is_active: true })
        .eq('agency_id', agency.id)
        .eq('role', 'owner');

    if (userUpdateError) {
        // ロールバック: 代理店を元に戻す
        await supabase
            .from('agencies')
            .update({
                status: 'pending_line_verification',
                line_user_id: null,
                line_display_name: null,
                line_picture_url: null,
                registration_token: agency.registration_token
            })
            .eq('id', agency.id);

        throw userUpdateError;
    }
} catch (error) {
    throw error;
}
```

**優先度:** 🟡 MEDIUM

---

### 8. **エラーメッセージの情報漏洩**

**問題:**
- 開発環境で詳細なエラーメッセージを返している
- 本番環境で `NODE_ENV` が正しく設定されていない場合、情報が漏洩する

**修正方法:**
```javascript
// 本番環境では絶対に詳細を返さない
return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
        error: errorMessage
        // details は絶対に含めない
    })
};
```

**優先度:** 🟡 MEDIUM

---

### 9. **CORS設定が緩すぎる**

**問題:**
- `Access-Control-Allow-Origin: *` はすべてのオリジンを許可
- より厳格な設定が望ましい

**修正方法:**
```javascript
// 許可されたオリジンのリスト
const ALLOWED_ORIGINS = [
    'https://taskmateai.net',
    'http://localhost:3000'
];

const origin = event.headers.origin || event.headers.Origin;
const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff'
};
```

**優先度:** 🟡 MEDIUM

---

## 🟢 低優先度の問題

### 10. **入力値のサニタイゼーション**

**問題:**
- LINE APIから返されたデータをそのままDBに保存
- XSS攻撃のリスクは低いが、念のため

**修正方法:**
```javascript
// HTMLエスケープ（表示時にフロントエンドで行うのが一般的）
const sanitizedDisplayName = profile.displayName.trim();
const sanitizedPictureUrl = profile.pictureUrl.trim();
```

**優先度:** 🟢 LOW

---

### 11. **ログに機密情報が含まれる**

**問題:**
- ログに registration_token や LINE User ID を出力
- Netlify Functionsのログは管理者が閲覧可能だが、注意が必要

**修正方法:**
```javascript
// トークンをマスク
logger.log('登録トークン:', registration_token.substring(0, 8) + '...');
logger.log('LINE User ID:', profile.userId.substring(0, 8) + '...');
```

**優先度:** 🟢 LOW

---

## ✅ 正しく実装されている点

### 良い点:

1. ✅ **パスワードのハッシュ化** - bcryptで適切にハッシュ化
2. ✅ **LINE User ID重複チェック** - 実装済み
3. ✅ **ワンタイムトークン** - registration_tokenをクリア
4. ✅ **HTTPSのみ** - 本番環境はHTTPSを使用
5. ✅ **環境変数の使用** - シークレットがハードコードされていない
6. ✅ **状態管理** - pending_line_verification → active の遷移
7. ✅ **詳細なログ** - デバッグしやすい

---

## 📋 修正優先順位

### 即座に修正（リリース前必須）
1. 🔴 CSRF保護の追加（agency-complete-registration.js）
2. 🔴 redirect_uri検証の追加（agency-complete-registration.js）
3. 🔴 registration_token検証の追加（agency-get-line-url.js）

### 早急に修正（リリース後1週間以内）
4. 🟠 レート制限の追加
5. 🟠 registration_tokenタイムアウトの実装
6. 🟠 LINEコード再利用対策

### 時間があれば修正
7. 🟡 トランザクション処理の改善
8. 🟡 CORS設定の厳格化
9. 🟡 エラーメッセージの見直し

---

## 🛠️ 修正コード例

以下のファイルを修正する必要があります:

### 修正が必要なファイル:
1. `agency-complete-registration.js` - CSRF保護、redirect_uri検証、レート制限
2. `agency-get-line-url.js` - CSRF保護、registration_token検証、レート制限
3. `migration_005_registration_token_timeout.sql` - タイムアウト機能追加（新規）
4. `agency-register.js` - registration_token有効期限を設定

---

## 📞 次のアクション

修正を実装しますか？

**オプション:**
- **A: 重大な問題のみ修正（🔴 3項目）** - 10分
- **B: 重大+高優先度を修正（🔴🟠 6項目）** - 30分
- **C: すべて修正（🔴🟠🟡 全項目）** - 60分

どれを選びますか？
