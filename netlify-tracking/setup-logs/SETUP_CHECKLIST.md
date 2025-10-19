# LINE チャンネル統一 実装チェックリスト

**作業開始日時:** $(date)

## 📋 事前準備

### 現在の設定確認

#### LINEチャンネル情報
- [ ] LINE Login チャンネルID: `2008314222`
- [ ] Messaging API チャンネルID: `2008021453`

#### 統一方針
- ✅ **Messaging API チャンネル (2008021453)** に統一
- ✅ このチャンネルにLINE Login機能を追加

---

## STEP 1: LINE Developers Console での作業

### 1-1. LINE Developers Console にアクセス

- [ ] https://developers.line.biz/console/ にログイン
- [ ] Provider を選択
- [ ] **Messaging API チャンネル (2008021453)** を選択

**ログ記録:**
```
アクセス日時:
ログインアカウント:
選択したProvider:
```

---

### 1-2. LINE Login を有効化

- [ ] チャンネル設定ページで「LINE Login」タブをクリック
- [ ] 「LINE Login を有効にする」をクリック
- [ ] 有効化完了を確認

**ログ記録:**
```
有効化日時:
確認方法: 「LINE Login」タブが表示されることを確認
スクリーンショット保存場所:
```

**⚠️ バックアップ:**
有効化前の設定をスクリーンショット保存:
- Basic settings 全体
- Messaging API settings 全体

---

### 1-3. Callback URL を設定

- [ ] 「LINE Login設定」→「Callback URL」を開く
- [ ] 以下のURLを追加:
  - `https://taskmateai.net/agency/`
  - `http://localhost:8888/agency/` (開発用)

**ログ記録:**
```
設定日時:
追加したCallback URL:
  1. https://taskmateai.net/agency/
  2. http://localhost:8888/agency/
確認方法: Callback URL一覧に表示されることを確認
```

---

### 1-4. スコープを設定

- [ ] 「LINE Login設定」→「Scopes」を開く
- [ ] 以下のスコープを有効化:
  - ✅ `profile` (ユーザーID、表示名、プロフィール画像)
  - ✅ `openid` (OpenID Connect用)

**ログ記録:**
```
設定日時:
有効化したスコープ:
  - profile: ON
  - openid: ON
```

---

### 1-5. Channel ID と Channel Secret を取得

#### LINE Login の情報

- [ ] 「LINE Login」タブを開く
- [ ] Channel ID をコピー: `________________`
- [ ] Channel Secret をコピー: `________________`

**ログ記録:**
```
取得日時:
LINE_LOGIN_CHANNEL_ID: 2008021453 (Messaging APIと同じ)
LINE_LOGIN_CHANNEL_SECRET: [取得済み・安全な場所に保管]
```

**🔒 セキュリティ:**
- Channel Secretは絶対にGitにコミットしない
- パスワードマネージャーなど安全な場所に保存

#### Messaging API の情報

- [ ] 「Messaging API」タブを開く
- [ ] Channel Secret を確認: `________________`
- [ ] Channel Access Token を確認: `________________`

**ログ記録:**
```
確認日時:
LINE_CHANNEL_SECRET: [確認済み・安全な場所に保管]
LINE_CHANNEL_ACCESS_TOKEN: [確認済み・安全な場所に保管]
```

---

### 1-6. LINE公式アカウント友達追加URLを取得

- [ ] LINE Official Account Manager (https://manager.line.biz/) にアクセス
- [ ] 該当のアカウントを選択
- [ ] 「設定」→「アカウント設定」→「基本設定」
- [ ] 「友だち追加URL」をコピー

**ログ記録:**
```
取得日時:
LINE_OFFICIAL_URL: https://line.me/R/ti/p/@___________
形式確認: https://line.me/R/ti/p/@ で始まることを確認
```

---

## STEP 2: Netlify 環境変数の設定

### 2-1. 現在の環境変数をバックアップ

```bash
# Netlify CLI で現在の環境変数をエクスポート
netlify env:list > setup-logs/env-backup-$(date +%Y%m%d_%H%M%S).txt
```

- [ ] バックアップファイルを作成
- [ ] ファイル内容を確認

**ログ記録:**
```
バックアップ日時:
バックアップファイル: setup-logs/env-backup-YYYYMMDD_HHMMSS.txt
ファイルサイズ:
```

---

### 2-2. 環境変数を設定 (Netlify CLI)

#### 必須環境変数リスト

**LINE関連（統一チャンネル）:**

```bash
# 1. LINE Login Channel ID (Messaging APIチャンネルID)
netlify env:set LINE_LOGIN_CHANNEL_ID "2008021453"

# 2. LINE Login Channel Secret (LINE Loginタブで取得)
netlify env:set LINE_LOGIN_CHANNEL_SECRET "ここにLINE Login用のSecretを入力"

# 3. LINE Login Callback URL
netlify env:set LINE_LOGIN_CALLBACK_URL "https://taskmateai.net/agency/"

# 4. Messaging API Channel Secret
netlify env:set LINE_CHANNEL_SECRET "ここにMessaging API用のSecretを入力"

# 5. Messaging API Channel Access Token
netlify env:set LINE_CHANNEL_ACCESS_TOKEN "ここにChannel Access Tokenを入力"

# 6. LINE公式アカウント友達追加URL
netlify env:set LINE_OFFICIAL_URL "https://line.me/R/ti/p/@xxxxxxxxx"
```

**チェックリスト:**
- [ ] `LINE_LOGIN_CHANNEL_ID` 設定完了
- [ ] `LINE_LOGIN_CHANNEL_SECRET` 設定完了
- [ ] `LINE_LOGIN_CALLBACK_URL` 設定完了
- [ ] `LINE_CHANNEL_SECRET` 設定完了
- [ ] `LINE_CHANNEL_ACCESS_TOKEN` 設定完了
- [ ] `LINE_OFFICIAL_URL` 設定完了

**ログ記録:**
```
設定日時:
設定完了した環境変数数: /6
確認コマンド実行: netlify env:list
```

---

### 2-3. 環境変数の確認

```bash
# すべての環境変数を確認
netlify env:list

# 個別に値を確認
netlify env:get LINE_LOGIN_CHANNEL_ID
netlify env:get LINE_LOGIN_CHANNEL_SECRET
netlify env:get LINE_LOGIN_CALLBACK_URL
netlify env:get LINE_CHANNEL_SECRET
netlify env:get LINE_CHANNEL_ACCESS_TOKEN
netlify env:get LINE_OFFICIAL_URL
```

- [ ] すべての環境変数が正しく設定されていることを確認

**ログ記録:**
```
確認日時:
確認結果:
  LINE_LOGIN_CHANNEL_ID: OK (2008021453)
  LINE_LOGIN_CHANNEL_SECRET: OK (設定済み)
  LINE_LOGIN_CALLBACK_URL: OK (https://taskmateai.net/agency/)
  LINE_CHANNEL_SECRET: OK (設定済み)
  LINE_CHANNEL_ACCESS_TOKEN: OK (設定済み)
  LINE_OFFICIAL_URL: OK (https://line.me/R/ti/p/@...)
```

---

## STEP 3: Netlify デプロイ

### 3-1. サイトを再デプロイ

```bash
cd netlify-tracking
npm run deploy
```

- [ ] デプロイコマンド実行
- [ ] デプロイ成功を確認
- [ ] デプロイURLを記録

**ログ記録:**
```
デプロイ開始日時:
デプロイ完了日時:
デプロイURL: https://taskmateai.net
デプロイID:
ステータス: SUCCESS/FAILED
```

**⚠️ エラーが発生した場合:**
```
エラー内容:
エラーログ:
対処方法:
```

---

## STEP 4: テスト

### 4-1. LINE Login のテスト

- [ ] https://taskmateai.net/agency/ にアクセス
- [ ] 「新規登録」をクリック
- [ ] 代理店情報を入力（テストデータ）:
  ```
  会社名: テスト株式会社
  代理店名: テスト代理店
  住所: 東京都渋谷区
  担当者名: テスト太郎
  メールアドレス: test@example.com
  電話番号: 03-1234-5678
  パスワード: Test1234!@#$
  招待コード: (空白またはテストコード)
  ```
- [ ] 「利用規約に同意」にチェック
- [ ] 「登録する」をクリック
- [ ] LINE Login 画面が表示されることを確認
- [ ] LINE アカウントでログイン

**ログ記録:**
```
テスト日時:
テストメールアドレス: test@example.com
LINE Login画面表示: OK/NG
ログイン成功: OK/NG
エラーメッセージ: (あれば記録)
```

**期待される動作:**
- ✅ LINE Login が成功する
- ✅ `agency-complete-registration` 関数が呼ばれる
- ✅ レスポンスに `requires_friend_add: true` が含まれる
- ✅ LINE 友達追加ページにリダイレクトされる

---

### 4-2. 友達追加のテスト

- [ ] 友達追加ページが表示される
- [ ] 「追加」ボタンをタップ
- [ ] LINE アプリで友達追加を完了

**ログ記録:**
```
友達追加日時:
友達追加完了: OK/NG
```

**期待される動作:**
- ✅ Webhook で `follow` イベントが検知される
- ✅ 代理店が自動的に `active` ステータスに変更される
- ✅ ユーザーが自動的に `is_active: true` に変更される
- ✅ LINE にウェルカムメッセージが届く

---

### 4-3. ウェルカムメッセージの確認

- [ ] LINE アプリを開く
- [ ] TaskMate AI からメッセージが届いているか確認
- [ ] メッセージ内容を確認:
  - 代理店名が表示されている
  - 代理店コードが表示されている
  - 次のステップガイドが表示されている
  - ダッシュボードボタンが表示されている

**ログ記録:**
```
メッセージ受信日時:
メッセージ内容確認: OK/NG
代理店名表示: OK/NG
代理店コード表示: OK/NG
```

---

### 4-4. Netlify Functions ログの確認

```bash
# Webhook ログを確認
netlify functions:log line-webhook

# 登録完了ログを確認
netlify functions:log agency-complete-registration
```

- [ ] ログを確認してエラーがないか確認

**期待されるログ (line-webhook):**
```
✅ 代理店登録の友達追加を検知: テスト代理店
✅ 代理店をアクティベート
✅ ユーザーをアクティベート
✅ LINEウェルカムメッセージ送信成功
```

**ログ記録:**
```
ログ確認日時:
line-webhook ログ: 正常/エラー
エラー内容: (あれば記録)
```

---

### 4-5. ログイン〜ダッシュボード表示のテスト

- [ ] https://taskmateai.net/agency/ に戻る
- [ ] テストアカウントでログイン:
  - メールアドレス: test@example.com
  - パスワード: Test1234!@#$
- [ ] ダッシュボードが表示されることを確認
- [ ] 代理店情報が正しく表示されることを確認:
  - 代理店コード
  - 階層レベル
  - 自己報酬率
  - 招待コード

**ログ記録:**
```
ログインテスト日時:
ログイン成功: OK/NG
ダッシュボード表示: OK/NG
代理店コード表示: OK/NG
階層レベル表示: OK/NG
```

---

## STEP 5: 本番データでの最終テスト

### 5-1. 実際の代理店登録でテスト

⚠️ **注意:** テストデータは必ず削除してから本番利用開始

- [ ] テストアカウントをSupabaseから削除
- [ ] 実際の代理店情報で登録テスト
- [ ] すべてのフローが正常に動作することを確認

**ログ記録:**
```
本番テスト日時:
登録成功: OK/NG
友達追加成功: OK/NG
メッセージ受信成功: OK/NG
ログイン成功: OK/NG
```

---

## STEP 6: クリーンアップとドキュメント更新

### 6-1. 古いLINE Loginチャンネルの無効化

- [ ] LINE Developers Console で古いLINE Loginチャンネル (2008314222) を確認
- [ ] 使用されていないことを確認
- [ ] 必要に応じて削除または無効化

**ログ記録:**
```
無効化日時:
旧チャンネルID: 2008314222
処理内容: 削除/無効化/保留
```

---

### 6-2. ドキュメント更新

- [ ] README.md に統一後のチャンネルIDを記載
- [ ] 環境変数一覧を更新
- [ ] セットアップ手順を更新

---

## 完了チェックリスト

すべての項目にチェックが入ったら統一作業は完了です:

**LINE Developers Console:**
- [ ] Messaging API チャンネルで LINE Login が有効化された
- [ ] Callback URL が設定された
- [ ] スコープ (profile, openid) が設定された

**Netlify 環境変数:**
- [ ] LINE_LOGIN_CHANNEL_ID = 2008021453
- [ ] LINE_LOGIN_CHANNEL_SECRET (設定済み)
- [ ] LINE_LOGIN_CALLBACK_URL = https://taskmateai.net/agency/
- [ ] LINE_CHANNEL_SECRET (設定済み)
- [ ] LINE_CHANNEL_ACCESS_TOKEN (設定済み)
- [ ] LINE_OFFICIAL_URL (設定済み)

**テスト:**
- [ ] LINE Login のテスト成功
- [ ] 友達追加のテスト成功
- [ ] ウェルカムメッセージ受信成功
- [ ] ログイン〜ダッシュボード表示成功

**本番運用:**
- [ ] 本番データでの最終テスト成功
- [ ] 旧チャンネルの無効化完了
- [ ] ドキュメント更新完了

---

## トラブルシューティング記録

問題が発生した場合はここに記録:

### 問題1:
```
発生日時:
問題内容:
エラーメッセージ:
対処方法:
解決日時:
```

### 問題2:
```
発生日時:
問題内容:
エラーメッセージ:
対処方法:
解決日時:
```

---

## バックアップ情報

### 環境変数バックアップ
- ファイル: `setup-logs/env-backup-YYYYMMDD_HHMMSS.txt`
- 作成日時:

### スクリーンショット
- LINE Developers Console (Before):
- LINE Developers Console (After):
- Netlify Dashboard (Before):
- Netlify Dashboard (After):

---

**作業完了日時:**
**作業担当者:**
**最終確認者:**
