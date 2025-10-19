# LINE連携システム - 実装完了レポート

## ✅ 実装完了

LINE連携による代理店登録システムの実装が完了しました。

---

## 📋 実装内容

### 1. データベース (migration_004_line_integration_FIXED.sql)

**追加カラム:**
```sql
- line_user_id (VARCHAR 255)        // LINE User ID
- line_display_name (VARCHAR 255)   // LINE表示名
- line_picture_url (TEXT)           // LINEプロフィール画像URL
- registration_token (VARCHAR 255)  // 登録完了用ワンタイムトークン
```

**status値の拡張:**
```sql
- 'pending'                      // 承認待ち（既存）
- 'pending_line_verification'    // LINE連携待ち（新規）
- 'active'                       // アクティブ（既存）
- 'inactive'                     // 無効（既存）
```

**実行済み:** ✅

---

### 2. バックエンド実装

#### A. agency-register.js（修正済み）
**役割:** 仮登録処理

**変更点:**
- status を 'active' → 'pending_line_verification' に変更
- registration_token を生成して保存
- レスポンスに `requires_line_verification: true` と `registration_token` を追加
- ユーザーの `is_active` を false に変更（LINE連携完了後にアクティブ化）

**ファイル:** `/netlify-tracking/netlify/functions/agency-register.js`

---

#### B. agency-complete-registration.js（新規作成）
**役割:** LINE連携完了処理

**機能:**
1. LINE認証コードをアクセストークンに交換
2. LINE User Profileを取得
3. 代理店レコードを更新（LINE情報を保存）
4. statusを 'active' に変更
5. ユーザーを `is_active: true` に変更
6. registration_tokenをクリア（ワンタイム使用）

**ファイル:** `/netlify-tracking/netlify/functions/agency-complete-registration.js`

---

#### C. agency-get-line-url.js（新規作成）
**役割:** LINE Login URLを生成

**機能:**
1. CSRF保護用のstateパラメータ生成
2. LINE Login認証URLを生成
3. stateとregistration_tokenをフロントエンドに返す

**ファイル:** `/netlify-tracking/netlify/functions/agency-get-line-url.js`

---

#### D. utils/line-client.js（新規作成）
**役割:** LINE API クライアントユーティリティ

**提供関数:**
- `generateLineLoginUrl()` - LINE Login URL生成
- `validateLineConfig()` - 環境変数検証
- `generateState()` - CSRF保護用state生成

**ファイル:** `/netlify-tracking/netlify/functions/utils/line-client.js`

---

### 3. フロントエンド実装

#### A. dashboard.js（修正済み）

**追加機能:**

1. **register() 関数の拡張**
   - LINE連携が必要な場合の分岐処理
   - LINE Login URLを取得
   - sessionStorageにstate/tokenを保存
   - LINE Loginページにリダイレクト

2. **handleLineCallback() 関数（新規）**
   - URLパラメータから code/state を取得
   - CSRF保護: stateパラメータ検証
   - registration_token の検証
   - バックエンド `agency-complete-registration` を呼び出し
   - 成功時: ログイン画面に移動
   - エラー時: エラーメッセージ表示

3. **init() 関数の拡張**
   - LINE callback URLパラメータ検出
   - 検出時は handleLineCallback() を実行

**ファイル:** `/netlify-tracking/agency/dashboard.js`

---

#### B. index.html（既存UIで対応）

現在のUIで完全に対応可能:
- 登録フォーム: 既存のまま
- 成功メッセージ: LINE連携完了後に表示される「登録が完了しました！」で対応
- エラーメッセージ: registerError で表示

**ファイル:** `/netlify-tracking/agency/index.html`

---

## 🔄 ユーザー登録フロー

### 従来のフロー（LINE連携なし）
```
1. 登録フォーム入力
2. 送信
3. 代理店 & ユーザー作成
4. ログイン画面へ
```

### 新しいフロー（LINE連携あり）
```
1. 登録フォーム入力
2. 送信
3. 仮登録（status: pending_line_verification, is_active: false）
4. LINE Loginにリダイレクト ←【新規】
5. ユーザーがLINEで認証
6. コールバックURLに戻る ←【新規】
7. LINE User Profile取得 ←【新規】
8. 代理店情報更新（LINE情報保存、status: active, is_active: true） ←【新規】
9. 成功メッセージ表示
10. ログイン画面へ
```

---

## 🛡️ セキュリティ対策

### 1. CSRF保護
- `state` パラメータによる検証
- sessionStorageに保存して検証

### 2. ワンタイムトークン
- `registration_token` は1回のみ使用可能
- 使用後は即座にクリア

### 3. LINE User ID重複チェック
- 同じLINEアカウントで複数登録を防止

### 4. Rate Limiting
- スパム登録攻撃を防止（既存機能）

---

## 🧪 テスト手順

### 事前準備

1. **LINE Developers設定確認**
   ```
   ✅ Channel ID: 2008314222
   ✅ Channel Secret: 設定済み
   ✅ Callback URL: https://taskmateai.net/agency/ 設定済み
   ```

2. **Netlify環境変数確認**
   ```
   ✅ LINE_LOGIN_CHANNEL_ID
   ✅ LINE_LOGIN_CHANNEL_SECRET
   ✅ LINE_LOGIN_CALLBACK_URL
   ```

3. **データベース確認**
   ```sql
   -- migration_004が適用されているか確認
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'agencies'
   AND column_name IN ('line_user_id', 'line_display_name', 'registration_token');
   ```

---

### テストケース1: 正常登録フロー

**手順:**
1. https://taskmateai.net/agency/ にアクセス
2. 「新規登録」をクリック
3. 登録フォームに入力:
   ```
   会社名: テスト株式会社
   代理店名: テスト代理店
   住所: 東京都渋谷区
   担当者名: 山田太郎
   メールアドレス: test@example.com
   電話番号: 03-1234-5678
   パスワード: Test1234!@
   パスワード確認: Test1234!@
   招待コード: [既存の有効な代理店コード]
   ✓ 利用規約に同意
   ```
4. 「登録する」をクリック
5. **LINE Loginページにリダイレクトされることを確認**
6. LINEアカウントでログイン
7. **代理店ダッシュボードに戻ることを確認**
8. **「登録が完了しました！ログイン画面に移動します...」メッセージ表示を確認**
9. 3秒後にログイン画面に移動することを確認
10. 登録したメールアドレスとパスワードでログイン
11. ダッシュボードが表示されることを確認

**期待結果:**
- ✅ LINEログイン画面が表示される
- ✅ LINE認証後、正常に戻る
- ✅ 登録完了メッセージが表示される
- ✅ ログイン成功
- ✅ データベースにLINE情報が保存される

**データベース確認:**
```sql
SELECT
    id, name, status,
    line_user_id, line_display_name,
    registration_token
FROM agencies
WHERE contact_email = 'test@example.com';

-- 期待値:
-- status = 'active'
-- line_user_id = 'U1234567890abcdef...' (LINE User ID)
-- line_display_name = 'ユーザー名'
-- registration_token = NULL (クリア済み)
```

---

### テストケース2: CSRF攻撃検知

**手順:**
1. 通常の登録フローを開始
2. LINE Loginページで認証
3. コールバックURLの `state` パラメータを手動で変更
4. ページを読み込む

**期待結果:**
- ❌ 「セキュリティエラー: 不正なリクエストです。最初から登録をやり直してください。」
- ✅ 登録は完了しない

---

### テストケース3: LINE User ID重複チェック

**手順:**
1. 既にLINE連携済みのアカウントで登録
2. 別のメールアドレスで新規登録
3. 同じLINEアカウントで認証

**期待結果:**
- ❌ 「このLINEアカウントは既に他の代理店で使用されています。」
- ✅ 登録は完了しない

---

### テストケース4: トークン有効期限

**手順:**
1. 通常の登録フローを開始
2. LINE Loginページで認証せず放置
3. 別のブラウザタブで同じメールアドレスで再度登録
4. 最初のタブでLINE認証を完了

**期待結果:**
- ❌ 「登録トークンが無効です。最初から登録をやり直してください。」
- ✅ 古いトークンは無効

---

## 🔍 デバッグ方法

### ブラウザコンソールログ

登録処理中、以下のログが出力されます:

```javascript
// 登録開始
"🚀 Agency Dashboard init() started"

// LINE callback検出
"📞 LINE callback detected"
"🔗 Handling LINE callback..."
"LINE callback params: {code: 'present', state: '...'}"
"Saved state: ..."
"Registration token: present"

// 成功時
"✅ Registration completed successfully"

// エラー時
"❌ State mismatch! CSRF attack detected"
"❌ Registration token not found"
"❌ Registration completion failed: ..."
```

---

### Netlify Functions ログ

Netlifyダッシュボード → Functions → ログで確認:

**agency-register.js:**
```
=== 登録リクエスト受信 ===
✅ レート制限チェック通過
✅ CSRF保護チェック通過
=== STEP 0: 必須項目チェック ===
✅ 必須項目チェック通過
...
=== ✅✅✅ 仮登録処理完了 ✅✅✅ ===
次のステップ: LINE連携が必要です
```

**agency-complete-registration.js:**
```
=== LINE連携完了処理開始 ===
=== STEP 1: 登録トークン検証 ===
✅ 代理店レコード発見
=== STEP 2: LINEアクセストークン取得 ===
✅ アクセストークン取得成功
=== STEP 3: LINEプロフィール取得 ===
✅ LINEプロフィール取得成功
...
=== ✅✅✅ LINE連携完了 ✅✅✅ ===
```

---

### データベース確認クエリ

**仮登録状態の確認:**
```sql
SELECT id, name, status, registration_token, line_user_id
FROM agencies
WHERE status = 'pending_line_verification';
```

**LINE連携完了の確認:**
```sql
SELECT
    a.id, a.name, a.status,
    a.line_user_id, a.line_display_name,
    u.is_active
FROM agencies a
JOIN agency_users u ON u.agency_id = a.id
WHERE a.line_user_id IS NOT NULL
ORDER BY a.created_at DESC
LIMIT 10;
```

---

## 🚨 トラブルシューティング

### エラー1: LINE Loginページにリダイレクトされない

**原因:**
- Netlify環境変数が設定されていない
- `agency-get-line-url.js` がエラーを返している

**解決策:**
```bash
# Netlify環境変数を確認
Netlify Dashboard → Site Settings → Environment Variables

# 必要な変数:
LINE_LOGIN_CHANNEL_ID
LINE_LOGIN_CHANNEL_SECRET
LINE_LOGIN_CALLBACK_URL
```

---

### エラー2: 「登録トークンが無効です」

**原因:**
- registration_tokenが見つからない
- 既に使用済み
- DBの status が 'pending_line_verification' 以外

**解決策:**
```sql
-- 該当レコードを確認
SELECT id, name, status, registration_token
FROM agencies
WHERE registration_token = '[トークン]';

-- 必要に応じて削除して再登録
DELETE FROM agencies WHERE id = [ID];
```

---

### エラー3: 「このLINEアカウントは既に使用されています」

**原因:**
- 同じLINE User IDが既に登録されている

**解決策:**
```sql
-- 既存のLINE User IDを確認
SELECT id, name, line_user_id, line_display_name
FROM agencies
WHERE line_user_id = '[LINE User ID]';

-- 必要に応じて削除
DELETE FROM agencies WHERE line_user_id = '[LINE User ID]';
```

---

### エラー4: CSRF検証エラー

**原因:**
- sessionStorageのstateが消えた
- URLのstateパラメータが改ざんされた

**解決策:**
- ブラウザでシークレットモードを使用していないか確認
- sessionStorageが有効か確認
- 最初から登録をやり直す

---

## 📁 ファイル一覧

### 新規作成
```
✅ /netlify-tracking/netlify/functions/agency-complete-registration.js
✅ /netlify-tracking/netlify/functions/agency-get-line-url.js
✅ /netlify-tracking/netlify/functions/utils/line-client.js
✅ /netlify-tracking/database/migration_004_line_integration_FIXED.sql
```

### 修正済み
```
✅ /netlify-tracking/netlify/functions/agency-register.js
   - generateRegistrationToken() 追加
   - status: 'pending_line_verification'
   - registration_token 生成・保存
   - is_active: false
   - レスポンス変更

✅ /netlify-tracking/agency/dashboard.js
   - register() 拡張（LINE連携分岐）
   - handleLineCallback() 追加
   - init() 拡張（callback検出）
```

### 既存維持
```
✅ /netlify-tracking/agency/index.html
   - 変更なし（既存UIで対応）
```

---

## ✅ チェックリスト

### 環境設定
- [x] LINE Developers Channel作成
- [x] Channel ID取得 (2008314222)
- [x] Channel Secret取得
- [x] Callback URL設定 (https://taskmateai.net/agency/)
- [x] Netlify環境変数設定
- [x] データベースマイグレーション実行

### コード実装
- [x] agency-register.js 修正
- [x] agency-complete-registration.js 作成
- [x] agency-get-line-url.js 作成
- [x] utils/line-client.js 作成
- [x] dashboard.js 修正
- [x] index.html 確認（変更不要）

### テスト
- [ ] 正常登録フロー
- [ ] LINE認証フロー
- [ ] CSRF保護
- [ ] トークン検証
- [ ] 重複チェック
- [ ] エラーハンドリング

### デプロイ
- [ ] コードをGitにプッシュ
- [ ] Netlifyで自動デプロイ確認
- [ ] 本番環境でテスト

---

## 🎯 次のステップ

1. **テスト実行**
   ```
   - 開発環境でテスト
   - 本番環境でテスト
   - エラーケースのテスト
   ```

2. **モニタリング設定**
   ```
   - Netlify Functions ログ監視
   - データベースクエリ監視
   - エラーレート監視
   ```

3. **ドキュメント整備**
   ```
   - ユーザー向けマニュアル作成
   - 管理者向け運用ガイド作成
   ```

---

## 📞 サポート

問題が発生した場合:
1. ブラウザコンソールログを確認
2. Netlify Functions ログを確認
3. データベースの状態を確認
4. このドキュメントのトラブルシューティングを参照

---

**実装完了日:** 2025-10-19
**バージョン:** 1.0.0
**ステータス:** ✅ 実装完了、テスト待ち
