# セットアップログ ディレクトリ

このディレクトリには、LINE チャンネル統一作業のログとガイドが含まれています。

## 📁 ファイル一覧

### ガイドドキュメント

| ファイル名 | 説明 | 使用タイミング |
|-----------|------|--------------|
| **STEP_BY_STEP_GUIDE.md** | 詳細な手順書（印刷推奨） | 作業開始時に読む |
| **SETUP_CHECKLIST.md** | チェックリスト形式の手順書 | 作業中の進捗管理 |
| **setup-helper.sh** | 環境変数設定自動化スクリプト | STEP 2-3 で実行 |

### ログファイル

| ファイル名 | 説明 | 自動生成 |
|-----------|------|----------|
| `env-backup-before.txt` | 設定前の環境変数 | ✅ |
| `env-backup-after.txt` | 設定後の環境変数 | ✅ |
| `setup-log-YYYYMMDD_HHMMSS.log` | セットアップ実行ログ | ✅ |

## 🚀 クイックスタート

### 方法1: ステップバイステップガイドを使う（推奨）

初めてセットアップする場合や、詳細な手順を確認したい場合

```bash
# 1. ガイドを開く
cat STEP_BY_STEP_GUIDE.md

# または、エディタで開く
code STEP_BY_STEP_GUIDE.md
```

**特徴:**
- ✅ 各ステップの詳細な説明
- ✅ スクリーンショット保存タイミングの指示
- ✅ トラブルシューティング手順
- ✅ 作業ログ記録欄

### 方法2: 自動スクリプトを使う

環境変数設定を自動化したい場合

```bash
# 1. プロジェクトディレクトリに移動
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking

# 2. Netlify にログイン＆リンク
netlify login
netlify link

# 3. セットアップスクリプトを実行
./setup-logs/setup-helper.sh
```

**特徴:**
- ✅ 環境変数設定の自動化
- ✅ 入力ミス防止
- ✅ 自動ログ記録
- ✅ 設定確認

### 方法3: チェックリストを印刷して使う

印刷して紙ベースで管理したい場合

```bash
# チェックリストをテキストファイルとして出力
cat SETUP_CHECKLIST.md > checklist-print.txt

# または、PDFに変換（pandocがインストールされている場合）
pandoc SETUP_CHECKLIST.md -o checklist.pdf
```

## 📋 作業の流れ

### PART 1: LINE Developers Console での作業

1. **LINE Developers Console にアクセス**
   - https://developers.line.biz/console/
   - Messaging API チャンネル (2008021453) を選択

2. **LINE Login を有効化**
   - LINE Login タブ → 「LINE Login を有効にする」

3. **Callback URL を設定**
   - `https://taskmateai.net/agency/` を追加

4. **スコープを設定**
   - `profile` と `openid` を有効化

5. **認証情報を取得**
   - LINE Login Channel Secret
   - Messaging API Channel Secret
   - Channel Access Token
   - LINE公式アカウント友達追加URL

### PART 2: Netlify 環境変数の設定

1. **Netlify にログイン＆リンク**
   ```bash
   netlify login
   netlify link
   ```

2. **現在の環境変数をバックアップ**
   ```bash
   netlify env:list > setup-logs/env-backup-before.txt
   ```

3. **環境変数を設定**
   - オプションA: `./setup-logs/setup-helper.sh` を実行
   - オプションB: 手動で `netlify env:set` コマンドを実行

4. **設定を確認**
   ```bash
   netlify env:list > setup-logs/env-backup-after.txt
   ```

### PART 3: デプロイとテスト

1. **サイトを再デプロイ**
   ```bash
   npm run deploy
   ```

2. **LINE Login のテスト**
   - https://taskmateai.net/agency/ にアクセス
   - テストアカウントで新規登録
   - LINE Login が成功することを確認

3. **友達追加のテスト**
   - 友達追加ページにリダイレクトされることを確認
   - LINE アプリで友達追加

4. **ウェルカムメッセージの確認**
   - LINE にメッセージが届くことを確認

5. **ログイン〜ダッシュボード表示のテスト**
   - ログインが成功することを確認
   - ダッシュボードが表示されることを確認

## 🔍 トラブルシューティング

### よくある問題

#### 1. LINE Login で "Invalid client_id" エラー

**原因:** `LINE_LOGIN_CHANNEL_ID` が間違っている

**解決方法:**
```bash
netlify env:set LINE_LOGIN_CHANNEL_ID "2008021453"
netlify deploy --prod
```

#### 2. 友達追加してもメッセージが届かない

**原因:** `LINE_CHANNEL_ACCESS_TOKEN` が間違っている、または Webhook URL が間違っている

**解決方法:**
1. LINE Developers Console で新しいトークンを発行
2. Webhook URL を確認: `https://taskmateai.net/.netlify/functions/line-webhook`
3. 環境変数を更新してデプロイ

#### 3. ログが表示されない

**確認方法:**
```bash
# Netlify Functions ログを確認
netlify functions:log line-webhook
netlify functions:log agency-complete-registration
```

詳細は **STEP_BY_STEP_GUIDE.md の PART 4** を参照してください。

## 📝 作業ログの記録方法

### 自動ログ

セットアップヘルパースクリプト (`setup-helper.sh`) を使用すると、自動的にログファイルが生成されます。

**ログファイル:**
- `setup-logs/setup-log-YYYYMMDD_HHMMSS.log`

### 手動ログ

手動で作業する場合は、以下の情報を記録してください:

**必須情報:**
- 作業日時
- 作業者名
- 各ステップの完了時刻
- エラーが発生した場合のエラーメッセージ
- スクリーンショットの保存場所

**推奨ツール:**
- テキストエディタ（VS Code、Notepad++ など）
- スクリーンショットツール（Snipping Tool、ShareX など）

## 🔐 セキュリティ上の注意

### 絶対にGitにコミットしないこと

以下の情報は**絶対に**Gitにコミットしないでください:

- ❌ LINE_LOGIN_CHANNEL_SECRET
- ❌ LINE_CHANNEL_SECRET
- ❌ LINE_CHANNEL_ACCESS_TOKEN
- ❌ `env-backup-*.txt` ファイル（実際の値が含まれている場合）

### 安全な保管場所

認証情報は以下の場所に保管してください:

- ✅ パスワードマネージャー（1Password、LastPass など）
- ✅ 暗号化されたファイル
- ✅ Netlify Environment Variables（既に設定済み）

### .gitignore の確認

```bash
# .gitignore に以下が含まれていることを確認
cat ../.gitignore | grep -E "setup-logs|\.env|\.log"
```

**推奨設定:**
```
setup-logs/*.txt
setup-logs/*.log
.env
.env.local
```

## 📊 進捗管理

### チェックリスト

- [ ] PART 1: LINE Developers Console での作業完了
- [ ] PART 2: Netlify 環境変数の設定完了
- [ ] PART 3: デプロイとテスト完了
- [ ] PART 4: トラブルシューティング（必要な場合）
- [ ] PART 5: クリーンアップ完了

### 作業時間の目安

- **LINE Developers Console**: 15-20分
- **Netlify 環境変数設定**: 10-15分
- **デプロイとテスト**: 20-30分
- **合計**: 約45-65分

## 🆘 サポート

### ドキュメント

- [DOCS_LINE_CHANNEL_UNIFICATION.md](../DOCS_LINE_CHANNEL_UNIFICATION.md) - チャンネル統一ガイド
- [DOCS_ENVIRONMENT_VARIABLES.md](../DOCS_ENVIRONMENT_VARIABLES.md) - 環境変数ガイド

### 外部リンク

- [LINE Developers Console](https://developers.line.biz/console/)
- [LINE Official Account Manager](https://manager.line.biz/)
- [Netlify Dashboard](https://app.netlify.com/)
- [Netlify CLI Documentation](https://docs.netlify.com/cli/get-started/)

## 📅 作業履歴

| 日時 | 作業者 | 作業内容 | ステータス |
|------|--------|---------|----------|
| 2025-10-19 | _________ | セットアップガイド作成 | ✅ 完了 |
| _________ | _________ | LINE チャンネル統一実施 | ⏳ 予定 |
| _________ | _________ | テスト実施 | ⏳ 予定 |

---

**最終更新日:** 2025-10-19
