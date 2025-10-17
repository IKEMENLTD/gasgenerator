# 🔍 ダッシュボード白画面デバッグ - 診断完了

## 📅 作成日: 2025-10-17

## 🎯 問題の概要

代理店ダッシュボードページ (`/agency/index.html`) を開くと、JavaScriptは読み込まれるが画面が白いまま表示される問題。

コンソールには以下のメッセージが表示される:
```
dashboard.js:807 TaskMate AI Agency Dashboard loaded
```

しかし、画面は白いまま（`x-cloak`によってコンテンツが隠されたまま）。

## 🔧 実施した診断機能

### 1. Alpine.js読み込み診断

**変更ファイル:** `agency/index.html`

- ✅ Alpine.jsのSRIハッシュを一時的に削除（読み込みエラーの可能性を排除）
- ✅ Alpine.js読み込み状態を2秒後にチェック
- ✅ Alpine.jsが読み込まれなかった場合、画面に詳細なエラーメッセージを表示

**表示されるエラー情報:**
- Alpine.jsのCDN URL
- 読み込み状態
- 考えられる原因
- 解決方法のリスト

### 2. dashboard.js読み込み診断

**変更ファイル:** `agency/dashboard.js`

**追加したログ:**
```javascript
// ファイル読み込み開始
console.log('📦 dashboard.js loading...');

// agencyDashboard()関数が呼ばれた時
console.log('🎯 agencyDashboard() function called');

// グローバル登録完了
console.log('✅ dashboard.js loaded, agencyDashboard registered globally');

// DOMContentLoaded時のチェック
console.log('✅ TaskMate AI Agency Dashboard loaded');
console.log('🔍 Checking if agencyDashboard is defined:', typeof window.agencyDashboard);
console.log('🔍 Checking if Alpine is loaded:', typeof window.Alpine);
```

**重要な変更:**
- `window.agencyDashboard = agencyDashboard;` でグローバルスコープに明示的に登録
- Alpine.jsが関数を見つけられるようにする

### 3. 初期化フロー詳細ログ

**変更箇所:** `dashboard.js` の `init()`, `loadDashboardData()`, `loadStats()`, `loadTrackingLinks()`

各関数に詳細なログを追加:
- 🚀 関数開始
- ✅ 成功
- ❌ エラー
- 📊 データ受信状況

### 4. グローバルエラーハンドラ（既存）

**場所:** `agency/index.html` 1015-1086行目

- JavaScriptエラーを画面に表示
- Promise拒否エラーを画面に表示
- Alpine.jsの初期化イベントを監視

### 5. 最終診断チェック（新規）

**場所:** `agency/index.html` 1092-1146行目

全スクリプト読み込み後の状態確認:
```javascript
console.log('🏁 All inline scripts loaded');
console.log('📊 Current state:', {
    agencyDashboard: typeof window.agencyDashboard,
    Alpine: typeof window.Alpine,
    XSSProtection: typeof window.XSSProtection
});
```

## 📋 デバッグ手順

### ステップ 1: ページを開いてコンソールを確認

1. ブラウザで `https://your-site.netlify.app/agency/` を開く
2. F12キーを押して開発者ツールを開く
3. Consoleタブを選択
4. ページをリロード (Ctrl+Shift+R / Cmd+Shift+R)

### ステップ 2: ログメッセージを確認

**期待されるログの順序:**

```
📦 Scripts loading...                          ← グローバルエラーハンドラ
📦 dashboard.js loading...                     ← dashboard.js読み込み開始
✅ dashboard.js loaded, agencyDashboard registered globally  ← 関数登録完了
🏁 All inline scripts loaded                   ← 全スクリプト読み込み完了
📊 Current state: {agencyDashboard: "function", Alpine: "undefined", ...}
📄 DOM Content Loaded                          ← DOM準備完了
✅ TaskMate AI Agency Dashboard loaded         ← DOMContentLoaded
🔍 Checking if agencyDashboard is defined: function
🔍 Checking if Alpine is loaded: undefined or object
🔄 Alpine.js initializing...                   ← Alpine.js初期化開始
🎉 Alpine.js initialized successfully!         ← Alpine.js初期化完了
🎯 agencyDashboard() function called           ← Alpine.jsがagencyDashboard()を呼び出し
🚀 Agency Dashboard init() started             ← ダッシュボード初期化開始
🍪 Cookie auth check: true/false               ← 認証チェック
```

### ステップ 3: エラーパターンの特定

#### パターン A: Alpine.jsが読み込まれない

**症状:**
```
⏰ After 2 seconds: {Alpine: "undefined", AlpineReady: "no"}
❌❌❌ Alpine.js is NOT loaded after 2 seconds! ❌❌❌
```

**原因:**
- ネットワークエラー（CDNに接続できない）
- ブラウザ拡張機能がCDNをブロック
- Content Security Policyの制限
- 広告ブロッカーがスクリプトをブロック

**解決方法:**
1. ブラウザの拡張機能を無効化
2. 広告ブロッカーを一時的に無効化
3. ネットワーク接続を確認
4. 別のブラウザで試す
5. Alpine.jsをローカルにダウンロードして使用

#### パターン B: agencyDashboard()が見つからない

**症状:**
```
🔍 Checking if agencyDashboard is defined: undefined
```

**原因:**
- dashboard.jsの読み込み失敗
- JavaScriptの構文エラー
- ファイルパスが間違っている

**解決方法:**
1. Networkタブでdashboard.jsが404でないか確認
2. dashboard.jsの構文エラーをチェック
3. ファイルパスを確認

#### パターン C: 認証APIエラー

**症状:**
```
🚀 Agency Dashboard init() started
🍪 Cookie auth check: false
💾 LocalStorage auth check: {hasToken: false, hasAgencyId: false}
📊 loadDashboardData() started
📈 loadStats() started
❌ Stats response not OK: 401 Unauthorized
```

**原因:**
- 認証トークンが無効または期限切れ
- APIエンドポイントが正しく動作していない
- CORS設定の問題

**解決方法:**
1. ログアウトして再ログイン
2. ブラウザのCookieとLocalStorageをクリア
3. Netlify Functionsのログを確認

#### パターン D: データ読み込みエラー

**症状:**
```
📈 loadStats() started
📈 Stats response status: 500
❌ Error loading stats: Error: Stats API returned 500
```

**原因:**
- バックエンドAPIのエラー
- データベース接続エラー
- 環境変数の設定ミス

**解決方法:**
1. Netlify Function logsを確認
2. Supabase接続を確認
3. 環境変数が正しく設定されているか確認

## 🔍 追加の診断方法

### Networkタブで確認

1. 開発者ツールのNetworkタブを開く
2. ページをリロード
3. 以下のファイルの読み込み状態を確認:
   - `alpinejs@3.13.3/dist/cdn.min.js` → 200 OK
   - `xss-protection.js` → 200 OK
   - `dashboard.js` → 200 OK
   - `agency-stats` (Function) → 200 OK
   - `agency-links` (Function) → 200 OK

### ブラウザコンソールで手動確認

```javascript
// Alpine.jsが読み込まれているか
console.log('Alpine:', window.Alpine);

// agencyDashboard関数が定義されているか
console.log('agencyDashboard:', window.agencyDashboard);

// agencyDashboard関数を手動で呼び出してみる
console.log('Test call:', window.agencyDashboard());

// Cookieを確認
console.log('Cookies:', document.cookie);

// LocalStorageを確認
console.log('LocalStorage:', {
    token: localStorage.getItem('agencyAuthToken'),
    agencyId: localStorage.getItem('agencyId')
});
```

## 🚀 次のステップ

1. **ページをリロードしてコンソールログを確認**
   - すべてのログメッセージをコピーしてください

2. **Alpine.jsが読み込まれない場合**
   - 画面に表示されるエラーメッセージを確認
   - Networkタブでalpinejs CDNへのリクエストを確認

3. **Alpine.jsは読み込まれるがデータ読み込みエラーの場合**
   - Netlify Functionsのログを確認
   - `/.netlify/functions/agency-stats`にブラウザで直接アクセスしてみる

4. **その他のエラーの場合**
   - コンソールログをすべてコピー
   - Networkタブのスクリーンショットを撮る
   - 報告してください

## 📝 デバッグ後の復旧

問題が解決したら、以下の変更を元に戻すことを推奨:

1. **Alpine.js SRIハッシュの復元**

   `agency/index.html` 12-21行目のコメントを解除:
   ```html
   <script src="https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js"
           integrity="sha384-xw/ARJaqXKsFgDt0AhxLQ65mGvCjEjWEReZ6OqiLWJUlIi8y+4zOjsJgYY6YGDX0"
           crossorigin="anonymous"
           defer></script>
   ```

2. **詳細ログの削除（オプション）**

   本番環境では以下のログを削除しても良い:
   - `dashboard.js` 1-2行目: `console.log('📦 dashboard.js loading...');`
   - `dashboard.js` 4行目: `console.log('🎯 agencyDashboard() function called');`
   - その他のデバッグ用console.log

3. **診断スクリプトの削除（オプション）**

   `agency/index.html` 1092-1146行目の最終診断チェックを削除

## ✅ 期待される結果

すべてが正常に動作する場合のログ:

```
📦 Scripts loading...
📦 dashboard.js loading...
✅ dashboard.js loaded, agencyDashboard registered globally
🏁 All inline scripts loaded
📊 Current state: {agencyDashboard: "function", Alpine: "undefined", XSSProtection: "object"}
📄 DOM Content Loaded
✅ TaskMate AI Agency Dashboard loaded
🔍 Checking if agencyDashboard is defined: function
🔍 Checking if Alpine is loaded: object
🎉 Alpine.js initialized successfully!
🎯 agencyDashboard() function called
🚀 Agency Dashboard init() started
🍪 Cookie auth check: true
📋 All cookies: agencyId=xxx; agencyToken=xxx
💾 LocalStorage auth check: {hasToken: true, hasAgencyId: true}
✅ User is authenticated, loading dashboard...
📊 loadDashboardData() started
📥 Loading stats and tracking links in parallel...
📈 loadStats() started
🔗 loadTrackingLinks() started
📈 Stats response status: 200
📈 Stats data received: {totalLinks: 5, totalClicks: 120, ...}
✅ loadStats() completed
🔗 Links response status: 200
🔗 Links data received: {links: [...]}
✅ loadTrackingLinks() completed, loaded 5 links
✅ loadDashboardData() completed successfully
✅ Billing stats auto-refresh started
✅ Inactivity timer started
✅ Agency Dashboard init() completed
⏰ After 2 seconds: {Alpine: "object", AlpineReady: "yes"}
✅ Alpine.js loaded successfully!
```

---

**作成日:** 2025-10-17
**バージョン:** 1.0
**関連ファイル:** agency/index.html, agency/dashboard.js
