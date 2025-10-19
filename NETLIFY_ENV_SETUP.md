# Netlify 環境変数設定ガイド

## 🔐 環境変数の追加

LINE連携に必要な環境変数をNetlifyに設定します。

---

## 📋 設定する環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `LINE_CHANNEL_ID` | LINE Login Channel ID | 1234567890 |
| `LINE_CHANNEL_SECRET` | LINE Login Channel Secret | abcdef1234567890abcdef |
| `LINE_CALLBACK_URL` | LINE認証後のリダイレクトURL | https://taskmateai.net/agency/line-callback |

---

## 🌐 Netlify コンソールでの設定手順

### ステップ1: Netlifyにログイン

1. https://app.netlify.com/ にアクセス
2. ログイン

### ステップ2: サイトを選択

1. ダッシュボードから `gasgenerator` サイトを選択
2. "Site settings" をクリック

### ステップ3: 環境変数を追加

1. 左メニューから "Environment variables" をクリック
2. "Add a variable" → "Add a single variable" をクリック

### ステップ4: 以下の変数を1つずつ追加

#### 1. LINE_CHANNEL_ID
```
Key: LINE_CHANNEL_ID
Value: （LINE DevelopersからコピーしたChannel ID）
Scopes: All scopes
Deploy contexts: All deploy contexts
```
"Create variable" をクリック

#### 2. LINE_CHANNEL_SECRET
```
Key: LINE_CHANNEL_SECRET
Value: （LINE DevelopersからコピーしたChannel Secret）
Scopes: All scopes
Deploy contexts: All deploy contexts
```
"Create variable" をクリック

#### 3. LINE_CALLBACK_URL
```
Key: LINE_CALLBACK_URL
Value: https://taskmateai.net/agency/line-callback
Scopes: All scopes
Deploy contexts: Production
```
"Create variable" をクリック

---

## ✅ 確認

環境変数が正しく設定されたか確認：

```
Site settings → Environment variables

以下の3つが表示されているはず：
☑ LINE_CHANNEL_ID
☑ LINE_CHANNEL_SECRET
☑ LINE_CALLBACK_URL
```

---

## 🔄 再デプロイ

環境変数を追加したら、再デプロイが必要です：

### 方法1: Netlify UI から
```
1. "Deploys" タブをクリック
2. "Trigger deploy" → "Deploy site" をクリック
```

### 方法2: Git push から
```bash
git commit --allow-empty -m "Trigger redeploy for LINE env vars"
git push origin main
```

---

## 🧪 ローカル開発環境の設定（オプション）

ローカルでテストする場合は `.env` ファイルを作成：

```bash
# .env ファイル（プロジェクトルートに作成）

# LINE Login Configuration
LINE_CHANNEL_ID=あなたのChannel ID
LINE_CHANNEL_SECRET=あなたのChannel Secret
LINE_CALLBACK_URL=http://localhost:3000/agency/line-callback

# Supabase (既存)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**重要：** `.env` ファイルは `.gitignore` に追加してコミットしないこと！

---

## 🆘 トラブルシューティング

### 環境変数が反映されない
- 再デプロイしましたか？
- "Deploy contexts" が正しいですか？（All deploy contexts または Production）

### ローカルで動かない
- `.env` ファイルがプロジェクトルートにありますか？
- Netlify CLI を使っている場合は `netlify dev` コマンドを使用

### 本番環境でエラーが出る
- Netlify Functions のログを確認（"Functions" タブ → 関数名をクリック → "Logs"）
- 環境変数の値にスペースや改行が入っていないか確認

---

## 🚀 次のステップ

環境変数設定が完了したら：

1. ✅ LINE Developers設定完了
2. ✅ Netlify環境変数設定完了
3. ⏭️  データベースマイグレーション実行
4. ⏭️  バックエンドコード実装
5. ⏭️  フロントエンドUI実装
