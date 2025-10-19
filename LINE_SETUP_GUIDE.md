# LINE Login 設定ガイド

## 📋 取得する情報リスト

LINE Developersコンソールで以下の情報を取得してください：

### ✅ 必須情報

| 項目 | 取得場所 | メモ |
|------|----------|------|
| **Channel ID** | Basic settings → Channel ID | 例: 1234567890 |
| **Channel Secret** | Basic settings → Channel secret | 例: abcdef1234567890 |

---

## 🔧 LINE Developersコンソール設定手順

### 1. Basic settings（基本設定）

#### Channel ID と Channel Secret を取得
```
1. LINE Developersコンソールにログイン
   https://developers.line.biz/console/

2. プロバイダー → チャネル を選択

3. "Basic settings" タブを開く

4. 以下をコピー：
   - Channel ID: __________________
   - Channel secret: __________________
```

---

### 2. LINE Login settings（LINEログイン設定）

#### Callback URL を設定

```
1. "LINE Login" タブを開く

2. "Callback URL" に以下を追加：

   【開発環境】
   http://localhost:3000/agency/line-callback

   【本番環境】
   https://taskmateai.net/agency/line-callback
   ※ Netlifyデプロイ後のURLに変更

3. "Update" をクリック
```

#### その他の設定

```
☑ Email address permission: ON
   （メールアドレス取得を許可）

☑ OpenID Connect: ON
   （プロフィール情報取得を許可）

☑ Bot link feature: OFF
   （Botとの連携は不要）
```

---

### 3. Scopes（スコープ設定）

以下のスコープが必要です：

```
☑ profile （必須）
   - ユーザーID
   - 表示名
   - プロフィール画像

☑ openid （必須）
   - OpenID Connect

☑ email （推奨）
   - メールアドレス取得
```

---

## 🌐 Callback URL の説明

### Callback URLとは？
LINE認証後にユーザーがリダイレクトされるURLです。

### 設定するURL

**開発環境（ローカルテスト用）:**
```
http://localhost:3000/agency/line-callback
```

**本番環境（Netlify）:**
```
https://taskmateai.net/agency/line-callback
```

**重要：**
- Netlifyにデプロイした後、本番URLを追加してください
- 複数のCallback URLを登録できます（開発環境と本番環境の両方）

---

## 🔐 環境変数の設定

取得した情報を `.env` ファイルに追加してください：

```bash
# LINE Login Configuration
LINE_CHANNEL_ID=あなたのChannel ID
LINE_CHANNEL_SECRET=あなたのChannel Secret
LINE_CALLBACK_URL=https://taskmateai.net/agency/line-callback

# 開発環境の場合
# LINE_CALLBACK_URL=http://localhost:3000/agency/line-callback
```

---

## ✅ 確認チェックリスト

設定完了後、以下を確認してください：

- [ ] Channel ID をコピーした
- [ ] Channel Secret をコピーした
- [ ] Callback URL を設定した（開発環境）
- [ ] Callback URL を設定した（本番環境）※本番デプロイ後
- [ ] Email address permission を ON にした
- [ ] OpenID Connect を ON にした
- [ ] `profile` スコープを有効化
- [ ] `openid` スコープを有効化
- [ ] `email` スコープを有効化
- [ ] 環境変数を `.env` に追加した

---

## 🚀 次のステップ

1. ✅ LINE Developers設定完了
2. ⏭️  環境変数をNetlifyに設定
3. ⏭️  データベースマイグレーション実行
4. ⏭️  バックエンドコード実装
5. ⏭️  フロントエンドUI実装

---

## 🆘 トラブルシューティング

### Channel Secretが表示されない場合
1. "Basic settings" タブ
2. "Channel secret" の横にある "Issue" ボタンをクリック
3. シークレットが生成されます

### Callback URLエラーが出る場合
- URLにポート番号が含まれている場合は削除
- `https://` で始まることを確認
- 末尾にスラッシュ `/` がないことを確認

### Email permission が取得できない場合
1. "LINE Login" タブ
2. "Email address permission" を ON にする
3. アプリの審査が必要な場合があります

---

## 📞 サポート

LINE Developers公式ドキュメント:
- LINE Login: https://developers.line.biz/en/docs/line-login/
- API Reference: https://developers.line.biz/en/reference/line-login/

問題が解決しない場合は、LINE Developers サポートにお問い合わせください。
