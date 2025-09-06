# GitHub Personal Access Token 設定ガイド

## 1. Personal Access Token の作成

1. GitHubにログイン
2. 以下のURLにアクセス:
   https://github.com/settings/tokens/new

3. 以下の設定を行う:
   - **Note**: `gas-generator-deployment` (任意の名前)
   - **Expiration**: 90 days (お好みで)
   - **Select scopes**: 
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows) ※必要に応じて

4. ページ下部の「Generate token」をクリック

5. **重要**: 生成されたトークンをコピーして安全な場所に保存
   （このトークンは二度と表示されません！）

## 2. トークンを使用してプッシュ

### 方法1: Windowsの場合（バッチファイル使用）
```cmd
cd C:\Users\ooxmi\Downloads\gas-generator
github-push.bat
```
トークンを入力してEnter

### 方法2: WSL/Linuxの場合（シェルスクリプト使用）
```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator
./github-push.sh
```
トークンを入力してEnter

### 方法3: 直接コマンド実行
```bash
# トークンを環境変数に設定
export GITHUB_TOKEN="your_token_here"

# プッシュ実行
git push https://IKEMENLTD:${GITHUB_TOKEN}@github.com/IKEMENLTD/gasgenerator.git main
```

## 3. 永続的な設定（オプション）

認証情報を保存したい場合:
```bash
./setup-github-auth.sh
```

## トラブルシューティング

### エラー: 403 Forbidden
- トークンに`repo`権限があることを確認
- トークンが有効期限切れでないことを確認
- ユーザー名が正しいことを確認（IKEMENLTD）

### エラー: Authentication failed
- トークンが正しくコピーされているか確認
- トークンの前後に空白が入っていないか確認

### エラー: Repository not found
- リポジトリURL確認: https://github.com/IKEMENLTD/gasgenerator
- リポジトリへのアクセス権限確認

## セキュリティ注意事項

- Personal Access Tokenは**パスワードと同じ**扱いです
- 他人と共有しない
- コードにハードコーディングしない
- 定期的に更新する（90日ごと推奨）

## 現在の状況

修正済みファイル:
- `lib/supabase/queries.ts` - 重複クラス定義を修正
- `render.yaml` - Render設定ファイルを追加

これらの変更をGitHubにプッシュすると、Renderが自動的に再ビルドを開始します。