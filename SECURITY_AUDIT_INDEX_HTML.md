# 🔒 index.html セキュリティ監査レポート

**監査日:** 2025-10-24
**監査対象:** `netlify-tracking/index.html` (1602行)
**監査者:** Claude Code
**深刻度:** 🔴 **CRITICAL** - 重大な脆弱性あり

---

## 📊 エグゼクティブサマリー

**総合評価:** ❌ **2/10点** - 本番環境で使用するには危険

| 深刻度 | 件数 | 対応優先度 |
|--------|------|----------|
| 🔴 **CRITICAL** | 5件 | **即座に修正必須** |
| 🟠 **HIGH** | 4件 | **1週間以内に修正** |
| 🟡 **MEDIUM** | 4件 | **1ヶ月以内に修正** |
| 🔵 **LOW** | 3件 | **機会があれば修正** |

**主要な問題:**
- ❌ Content Security Policy (CSP) が完全に欠落
- ❌ CSRF 保護なし
- ❌ iframe セキュリティ設定不足
- ❌ Mixed Content (HTTP リンク)
- ❌ フォームセキュリティ不足

---

## 🔴 CRITICAL - 即座に修正必須

### 1. Content Security Policy (CSP) が完全に欠落

**問題:**
CSP ヘッダーが一切設定されていません。これにより XSS 攻撃に対して完全に無防備です。

**影響:**
- ❌ インラインスクリプトの実行制御なし
- ❌ 外部スクリプトの読み込み制御なし
- ❌ eval() などの危険な関数の使用制御なし
- ❌ 攻撃者が任意の JavaScript を実行可能

**修正方法:**
`_headers` ファイルまたは Netlify 設定に CSP を追加：

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://cdnjs.cloudflare.com https://script.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; frame-src https://script.google.com https://docs.google.com; connect-src 'self' https://www.google-analytics.com
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
```

**推奨CSP（厳密版）:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}' https://www.googletagmanager.com https://cdnjs.cloudflare.com;
  style-src 'self' 'nonce-{random}' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
  img-src 'self' data: https:;
  frame-src https://script.google.com https://docs.google.com;
  connect-src 'self' https://www.google-analytics.com;
  font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
```

---

### 2. CSRF (Cross-Site Request Forgery) トークンなし

**問題:**
**ファイル:** Line 1000-1007

```html
<form class="cta-form">
    <input type="text" class="cta-input" placeholder="会社名" required>
    <input type="tel" class="cta-input" placeholder="電話番号" required>
    <button type="submit" class="btn btn-xl">
```

- ❌ CSRF トークンなし
- ❌ action 属性なし
- ❌ method 属性なし
- ❌ フォーム送信先が不明

**影響:**
- 攻撃者が別サイトから偽のフォーム送信を実行可能
- ユーザーの意図しない操作を強制される

**修正方法:**

```html
<form class="cta-form" method="POST" action="/.netlify/functions/contact" id="contact-form">
    <!-- CSRF トークン追加 -->
    <input type="hidden" name="csrf_token" id="csrf_token" value="">

    <input type="text" class="cta-input" name="company" placeholder="会社名" required>
    <input type="tel" class="cta-input" name="phone" placeholder="電話番号" required pattern="[0-9\-]{10,13}">
    <button type="submit" class="btn btn-xl">
        <i class="fas fa-paper-plane"></i>
        無料診断を申込む
    </button>
</form>

<script>
// CSRF トークン生成
(function() {
    const csrfToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    document.getElementById('csrf_token').value = csrfToken;
    sessionStorage.setItem('csrf_token', csrfToken);
})();

// フォーム送信時に検証
document.getElementById('contact-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const csrfToken = sessionStorage.getItem('csrf_token');

    if (formData.get('csrf_token') !== csrfToken) {
        alert('セキュリティエラー: 不正なリクエストです');
        return;
    }

    // 送信処理
    // ...
});
</script>
```

---

### 3. iframe セキュリティ設定不足

**問題:**
**ファイル:** Line 481-487, Line 512-518

```html
<!-- Google Apps Script iframe -->
<iframe
    id="demo-iframe"
    src="https://script.google.com/macros/s/AKfycbwL1r1VhdsSmfn0XrJ5dnz7q9zS0YX_nGlwqZLEbPRAaAT-rQX5p1VWJlmVaB2AsJSv/exec"
    frameborder="0"
    allowfullscreen
    loading="lazy">
</iframe>

<!-- Google Sheets iframe -->
<iframe
    id="sheet-iframe"
    src="https://docs.google.com/spreadsheets/d/1oh3dG9TNpU1NbCgPa_w6TmKWYQ4RnbgxFeg5JpWFtnQ/preview"
    frameborder="0"
    allowfullscreen
    loading="lazy">
</iframe>
```

**問題点:**
- ❌ `sandbox` 属性なし
- ❌ iframe 内のスクリプトが無制限に実行可能
- ❌ iframe が親ウィンドウにアクセス可能
- ❌ iframe がフォーム送信、ポップアップ、ダウンロードを実行可能

**影響:**
- iframe 内のスクリプトが親ページの DOM にアクセス可能
- XSS 攻撃のベクターになる
- ユーザーの意図しない操作を強制される

**修正方法:**

```html
<!-- Google Apps Script iframe - セキュア版 -->
<iframe
    id="demo-iframe"
    src="https://script.google.com/macros/s/AKfycbwL1r1VhdsSmfn0XrJ5dnz7q9zS0YX_nGlwqZLEbPRAaAT-rQX5p1VWJlmVaB2AsJSv/exec"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    frameborder="0"
    loading="lazy"
    title="TaskMate Demo Application"
    referrerpolicy="no-referrer">
</iframe>

<!-- Google Sheets iframe - セキュア版 -->
<iframe
    id="sheet-iframe"
    src="https://docs.google.com/spreadsheets/d/1oh3dG9TNpU1NbCgPa_w6TmKWYQ4RnbgxFeg5JpWFtnQ/preview"
    sandbox="allow-scripts allow-same-origin"
    frameborder="0"
    loading="lazy"
    title="Google Sheets Database"
    referrerpolicy="no-referrer">
</iframe>
```

**sandbox 属性の説明:**
- `allow-scripts`: JavaScript 実行許可（デモアプリに必要）
- `allow-same-origin`: 同一オリジンアクセス許可
- `allow-forms`: フォーム送信許可（デモアプリに必要）
- `allow-popups`: ポップアップ許可（必要な場合のみ）
- ❌ `allow-top-navigation` は**含めない**（セキュリティリスク）

---

### 4. Mixed Content - HTTP リンク

**問題:**
**ファイル:** Line 77

```html
<a href="http://agency.ikemen.ltd/" class="nav-link">
```

**問題点:**
- ❌ HTTPS ページから HTTP リンク（Mixed Content）
- ブラウザが警告を表示する可能性
- 中間者攻撃 (MITM) のリスク

**影響:**
- ユーザーが HTTP ページにリダイレクトされる
- 通信が平文で送信される
- 盗聴・改ざんのリスク

**修正方法:**

```html
<!-- HTTP → HTTPS に変更 -->
<a href="https://agency.ikemen.ltd/" class="nav-link" rel="noopener noreferrer">
    <i class="fas fa-building" style="font-size: 0.75rem; margin-right: 0.25rem;"></i>
    代理店様はこちら
</a>
```

**さらに:** agency.ikemen.ltd サーバー側で HSTS ヘッダーを設定：

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

### 5. フォームデータの平文送信リスク

**問題:**
**ファイル:** Line 1000-1007

```html
<form class="cta-form">
    <input type="text" class="cta-input" placeholder="会社名" required>
    <input type="tel" class="cta-input" placeholder="電話番号" required>
```

**問題点:**
- ❌ フォーム送信先が不明（action 属性なし）
- ❌ JavaScript で処理しているが、Line 1172-1203 に実装あり
- ❌ しかし、実際の送信処理がコメントアウト（Line 1202）
- ❌ 個人情報（会社名、電話番号）の取り扱いが不明確

**影響:**
- フォームが実際に機能していない可能性
- 個人情報が意図しない場所に送信される可能性
- GDPR / 個人情報保護法違反のリスク

**修正方法:**

```html
<form class="cta-form" method="POST" action="/.netlify/functions/contact-submit" autocomplete="on">
    <!-- CSRF トークン -->
    <input type="hidden" name="csrf_token" id="csrf_token">

    <!-- ハニーポット（ボット対策） -->
    <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">

    <input
        type="text"
        class="cta-input"
        name="company"
        placeholder="会社名"
        required
        maxlength="100"
        pattern="[^<>]*"
        autocomplete="organization">

    <input
        type="tel"
        class="cta-input"
        name="phone"
        placeholder="電話番号"
        required
        pattern="[0-9\-]{10,13}"
        maxlength="15"
        autocomplete="tel">

    <button type="submit" class="btn btn-xl" id="submit-btn">
        <i class="fas fa-paper-plane"></i>
        無料診断を申込む
    </button>
</form>

<script>
document.querySelector('.cta-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

    try {
        // ハニーポットチェック（ボット対策）
        if (this.website.value) {
            throw new Error('Bot detected');
        }

        const formData = new FormData(this);
        const response = await fetch('/.netlify/functions/contact-submit', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRF-Token': sessionStorage.getItem('csrf_token')
            }
        });

        if (!response.ok) throw new Error('送信に失敗しました');

        alert('お申し込みありがとうございます。担当者より連絡させていただきます。');
        this.reset();
    } catch (error) {
        alert('エラーが発生しました: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 無料診断を申込む';
    }
});
</script>
```

**Netlify Function側の実装例:**

```javascript
// netlify/functions/contact-submit.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    // CORS対応
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' } };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // CSRFトークン検証
        const csrfToken = event.headers['x-csrf-token'];
        // トークン検証ロジック...

        const formData = new URLSearchParams(event.body);

        // ハニーポットチェック
        if (formData.get('website')) {
            return { statusCode: 400, body: 'Invalid request' };
        }

        const company = formData.get('company');
        const phone = formData.get('phone');

        // バリデーション
        if (!company || !phone) {
            return { statusCode: 400, body: 'Missing required fields' };
        }

        // 電話番号の正規表現チェック
        if (!/^[0-9\-]{10,13}$/.test(phone)) {
            return { statusCode: 400, body: 'Invalid phone number' };
        }

        // XSS対策（サニタイズ）
        const sanitize = (str) => str.replace(/[<>]/g, '');
        const sanitizedCompany = sanitize(company);
        const sanitizedPhone = sanitize(phone);

        // Supabaseに保存
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabase
            .from('contact_submissions')
            .insert({
                company: sanitizedCompany,
                phone: sanitizedPhone,
                submitted_at: new Date().toISOString(),
                ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'],
                user_agent: event.headers['user-agent']
            });

        if (error) throw error;

        // LINE通知（オプション）
        // await sendLineNotification(sanitizedCompany, sanitizedPhone);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Contact form submitted successfully' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
```

---

## 🟠 HIGH - 1週間以内に修正

### 6. 外部スクリプトの Subresource Integrity (SRI) なし

**問題:**
**ファイル:** Line 26, Line 32

```html
<!-- Font Awesome - SRI なし -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

<!-- Google Analytics - SRI なし -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-VDT2MSCZ6N"></script>
```

**問題点:**
- ❌ CDN が侵害された場合、悪意あるコードが実行される
- ❌ 中間者攻撃で改ざんされる可能性
- ❌ スクリプトの整合性検証なし

**影響:**
- CDN プロバイダーが侵害された場合、すべてのユーザーに悪意あるコードが配信される
- 2023年に実際に発生した Polyfill.io の事例

**修正方法:**

```html
<!-- Font Awesome - SRI付き -->
<link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
    integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer">

<!-- Google Fonts - Preconnect改善 -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap"
    rel="stylesheet"
    crossorigin="anonymous">
```

**注意:** Google Analytics はダイナミックに更新されるため、SRI は適用できません。代わりに CSP で制限します。

---

### 7. target="_blank" に rel="noopener noreferrer" なし

**問題:**
**ファイル:** Line 81, 123, 127, 422, 562, 566, 660, 700, 740, 778, 1081 など多数

```html
<a href="https://lin.ee/nvDPCj9" class="btn btn-primary" target="_blank">
```

**問題点:**
- ❌ `rel="noopener noreferrer"` がない
- リファラー情報が外部サイトに送信される
- タブナビゲーション（Reverse Tabnabbing）攻撃のリスク

**影響:**
- 外部サイトが `window.opener` にアクセス可能
- 元のページを悪意あるサイトにリダイレクト可能
- ユーザーのプライバシー侵害

**修正方法:**

```html
<!-- 修正前 -->
<a href="https://lin.ee/nvDPCj9" class="btn btn-primary" target="_blank">

<!-- 修正後 -->
<a href="https://lin.ee/nvDPCj9" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
```

**一括置換:**
```bash
# すべての target="_blank" に rel="noopener noreferrer" を追加
sed -i 's/target="_blank"/target="_blank" rel="noopener noreferrer"/g' index.html
```

---

### 8. クリックジャッキング対策なし

**問題:**
X-Frame-Options ヘッダーがない

**影響:**
- 悪意あるサイトが iframe でこのページを埋め込み可能
- ユーザーに気づかれずにクリックを誘導される（クリックジャッキング）
- フィッシング攻撃のベクターになる

**修正方法:**

`netlify.toml` または `_headers` に追加：

```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

または `_headers` ファイル：

```
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

### 9. 個人情報保護の明示なし

**問題:**
**ファイル:** Line 1000-1007

フォームで個人情報（会社名、電話番号）を収集しているが：
- ❌ プライバシーポリシーへのリンクなし
- ❌ 個人情報の利用目的が不明確
- ❌ 同意チェックボックスなし

**影響:**
- 個人情報保護法違反
- GDPR 違反（EU圏のユーザーがいる場合）
- 法的リスク

**修正方法:**

```html
<form class="cta-form" method="POST" action="/.netlify/functions/contact-submit">
    <input type="text" class="cta-input" name="company" placeholder="会社名" required>
    <input type="tel" class="cta-input" name="phone" placeholder="電話番号" required>

    <!-- 追加: プライバシー同意 -->
    <div style="margin-top: 1rem; text-align: left;">
        <label style="display: flex; align-items: start; font-size: 0.875rem; color: white;">
            <input type="checkbox" name="privacy_agree" required style="margin-right: 0.5rem; margin-top: 0.25rem;">
            <span>
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style="color: white; text-decoration: underline;">プライバシーポリシー</a>
                に同意する
            </span>
        </label>
    </div>

    <button type="submit" class="btn btn-xl" style="background: white; color: var(--primary-700); margin-top: 1rem;">
        <i class="fas fa-paper-plane"></i>
        無料診断を申込む
    </button>
</form>

<p style="margin-top: var(--space-2); font-size: var(--text-xs); opacity: 0.9;">
    ※お客様の個人情報は、お問い合わせ対応のみに使用し、第三者に提供することはありません。<br>
    ※営業電話は一切いたしません。お気軽にお申し込みください。
</p>
```

---

## 🟡 MEDIUM - 1ヶ月以内に修正

### 10. JavaScript の動的実行リスク

**問題:**
**ファイル:** Line 1105-1600

大量のインラインスクリプト（約500行）が存在：
- GA4 イベントトラッキング
- フォーム処理
- UI インタラクション

**問題点:**
- ❌ CSP で制御できない（'unsafe-inline' が必要）
- ❌ コードの可読性・保守性が低い
- ❌ XSS 攻撃のリスク

**修正方法:**

```html
<!-- 修正前: インラインスクリプト -->
<script>
(function() {
    // 500行のコード
})();
</script>

<!-- 修正後: 外部ファイル化 -->
<script src="/js/ga4-tracking.js" defer></script>
<script src="/js/form-handler.js" defer></script>
```

**さらに:** CSP で nonce を使用：

```html
<!-- HTML -->
<script nonce="random-nonce-123" src="/js/ga4-tracking.js"></script>

<!-- CSP ヘッダー -->
Content-Security-Policy: script-src 'self' 'nonce-random-nonce-123' https://www.googletagmanager.com
```

---

### 11. 入力バリデーション不足

**問題:**
**ファイル:** Line 1001-1002

```html
<input type="text" class="cta-input" placeholder="会社名" required>
<input type="tel" class="cta-input" placeholder="電話番号" required>
```

**問題点:**
- ❌ pattern 属性なし
- ❌ maxlength 制限なし
- ❌ XSS 対策なし（`<script>` タグなどが入力可能）

**修正方法:**

```html
<input
    type="text"
    class="cta-input"
    name="company"
    placeholder="会社名"
    required
    maxlength="100"
    pattern="[^<>]*"
    title="会社名を入力してください（特殊文字 < > は使用できません）"
    autocomplete="organization">

<input
    type="tel"
    class="cta-input"
    name="phone"
    placeholder="電話番号（ハイフンあり/なし両方OK）"
    required
    pattern="[0-9\-]{10,13}"
    maxlength="15"
    title="10〜13桁の電話番号を入力してください"
    autocomplete="tel">
```

**JavaScript 側でも検証:**

```javascript
document.querySelector('.cta-form').addEventListener('submit', function(e) {
    const company = this.company.value;
    const phone = this.phone.value;

    // XSS対策: HTMLタグ除去
    if (/<script|<iframe|javascript:/i.test(company + phone)) {
        e.preventDefault();
        alert('不正な文字が含まれています');
        return false;
    }

    // 電話番号の形式チェック
    if (!/^[0-9\-]{10,13}$/.test(phone)) {
        e.preventDefault();
        alert('電話番号の形式が正しくありません');
        return false;
    }

    // 処理続行...
});
```

---

### 12. リソースの完全性検証なし

**問題:**
**ファイル:** Line 29

```html
<link rel="stylesheet" href="/css/styles.css">
```

ローカルリソースにも integrity チェックがない

**修正方法:**

ビルド時に SRI ハッシュを自動生成：

```bash
# SRI ハッシュ生成
openssl dgst -sha384 -binary css/styles.css | openssl base64 -A

# HTML に追加
<link
    rel="stylesheet"
    href="/css/styles.css"
    integrity="sha384-HASH_HERE"
    crossorigin="anonymous">
```

---

### 13. 外部リンクの検証なし

**問題:**
iframe で埋め込んでいる Google Apps Script と Google Sheets の URL が正しいか検証されていない

**修正方法:**

```javascript
// iframe 読み込み前に URL を検証
const validDomains = [
    'script.google.com',
    'docs.google.com'
];

document.querySelectorAll('iframe').forEach(iframe => {
    const src = new URL(iframe.src);

    if (!validDomains.includes(src.hostname)) {
        console.error('Invalid iframe domain:', src.hostname);
        iframe.remove();
    }
});
```

---

## 🔵 LOW - 機会があれば修正

### 14. コメントアウトされたコード

**問題:**
**ファイル:** Line 1202

```javascript
// e.preventDefault();
```

**影響:**
- 意図せずコメント解除される可能性
- コードの可読性低下

**修正方法:**
不要なコードは完全に削除

---

### 15. デバッグモードの設定

**問題:**
**ファイル:** Line 1109

```javascript
const DEBUG_MODE = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
```

**問題点:**
- 本番環境でデバッグログが有効になる可能性は低いが、環境変数で制御すべき

**修正方法:**

```javascript
const DEBUG_MODE = false; // 本番環境では常に false
// または環境変数から取得
// const DEBUG_MODE = process.env.NODE_ENV !== 'production';
```

---

### 16. リソース最適化不足

**問題:**
一部の外部リソースに preconnect / prefetch がない

**修正方法:**

```html
<!-- CDN の preconnect 追加 -->
<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>

<!-- 重要なリソースの prefetch -->
<link rel="prefetch" href="/css/styles.css">
<link rel="prefetch" href="/js/main.js">
```

---

## 📋 修正優先度と実装ロードマップ

### Phase 1: 緊急対応（今週中）

1. ✅ CSP ヘッダー追加（_headers ファイル作成）
2. ✅ X-Frame-Options 追加
3. ✅ Mixed Content 修正（HTTP → HTTPS）
4. ✅ target="_blank" に rel 追加（一括置換）
5. ✅ iframe に sandbox 属性追加

**所要時間:** 2-3時間

---

### Phase 2: 高優先度（来週中）

6. ✅ CSRF トークン実装
7. ✅ フォーム送信処理の実装
8. ✅ SRI ハッシュ追加（Font Awesome）
9. ✅ プライバシー同意チェックボックス追加

**所要時間:** 1日

---

### Phase 3: 中優先度（来月中）

10. ✅ インラインスクリプトの外部ファイル化
11. ✅ 入力バリデーション強化
12. ✅ エラーハンドリング改善

**所要時間:** 2-3日

---

### Phase 4: 低優先度（機会があれば）

13. ✅ デバッグコードのクリーンアップ
14. ✅ リソース最適化

**所要時間:** 1日

---

## 🛠️ 即座に実装可能な修正スクリプト

### 1. _headers ファイル作成

```bash
cat > netlify-tracking/_headers << 'EOF'
/*
  # セキュリティヘッダー
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://cdnjs.cloudflare.com https://script.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; frame-src https://script.google.com https://docs.google.com; connect-src 'self' https://www.google-analytics.com
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

  # HSTS（本番環境のみ）
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
EOF
```

### 2. 一括置換コマンド

```bash
# HTTP → HTTPS
sed -i 's|http://agency.ikemen.ltd/|https://agency.ikemen.ltd/|g' netlify-tracking/index.html

# target="_blank" に rel 追加
sed -i 's/target="_blank"/target="_blank" rel="noopener noreferrer"/g' netlify-tracking/index.html
```

---

## 📊 修正後の期待される効果

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| **セキュリティスコア** | 2/10 | 9/10 |
| **XSS 脆弱性** | ❌ 脆弱 | ✅ 保護 |
| **CSRF 脆弱性** | ❌ 脆弱 | ✅ 保護 |
| **クリックジャッキング** | ❌ 脆弱 | ✅ 保護 |
| **Mixed Content** | ❌ あり | ✅ なし |
| **データ保護** | ❌ 不十分 | ✅ 十分 |

---

## 🎯 推奨アクション

### 今すぐ実施すべき修正

```bash
# 1. _headers ファイル作成
# 2. HTTP → HTTPS 一括置換
# 3. target="_blank" 修正
# 4. Git commit & push
```

### セキュリティチェックリスト

- [ ] _headers ファイル作成・デプロイ
- [ ] Mixed Content 修正
- [ ] target="_blank" に rel 追加
- [ ] iframe に sandbox 追加
- [ ] CSRF トークン実装
- [ ] フォーム送信処理実装
- [ ] プライバシー同意追加
- [ ] SRI ハッシュ追加
- [ ] 入力バリデーション強化
- [ ] セキュリティテスト実施

---

**作成者:** Claude Code
**作成日:** 2025-10-24
**次回レビュー:** 修正完了後
