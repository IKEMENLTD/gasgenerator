# 🚨 今すぐ実行してください

## 手順1: GitHub Personal Access Tokenを作成

1. このリンクを開く: https://github.com/settings/tokens
2. **"Generate new token (classic)"** をクリック
3. Note: `Render Deploy Fix`
4. Expiration: `7 days`
5. Scopes: **☑ repo** （repoにチェック）
6. **"Generate token"** をクリック
7. トークンをコピー（`ghp_` で始まる文字列）

## 手順2: 以下のコマンドを実行

```bash
# 1. トークンを設定（your_token_hereを実際のトークンに置き換える）
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxx

# 2. スクリプトを実行
./auto-github-push.sh
```

## 代替手段: 対話型スクリプト

トークンを環境変数に設定したくない場合:

```bash
./github-api-update.sh
# プロンプトが出たらトークンを入力
```

## ✅ 成功の確認

スクリプト実行後:
1. `✅ 全ファイルの更新が完了しました！` が表示される
2. https://github.com/IKEMENLTD/gasgenerator/commits/main で変更を確認
3. https://dashboard.render.com/ でビルドが開始されることを確認

## 🆘 もしエラーが出た場合

### "401 Unauthorized"エラー
- トークンが正しくコピーされているか確認
- トークンに`repo`権限があるか確認

### "422 Unprocessable Entity"エラー
- ファイルが既に更新されている可能性があります
- Renderダッシュボードを確認してください

## 📝 更新される内容

### 1. lib/config/environment.ts
- `ADMIN_API_TOKEN`を必須からオプションに移動

### 2. lib/auth/jwt-manager.ts  
- 3箇所の`getRequired`を`getOptional`に変更
- デフォルト値を設定

これでRenderのビルドエラーが解決します！