# GitHubへのプッシュ手順

## 🚨 重要な修正が完了しています！

以下の修正が完了し、プッシュ待ちです：
- AI会話のJSON解析エラー修正（致命的なバグ）
- 画像・ファイル処理機能の追加
- follow/unfollowイベントの対応

## プッシュ方法

### 方法1: GitHub Personal Access Token を使用（推奨）

1. GitHubにログイン
2. https://github.com/settings/tokens にアクセス
3. "Generate new token (classic)" をクリック
4. 以下の権限を選択：
   - `repo` (Full control of private repositories)
5. トークンをコピー

6. コマンドプロンプトで実行：
```bash
cd C:\Users\ooxmi\Downloads\gas-generator
git push https://IKEMENLTD:YOUR_TOKEN_HERE@github.com/IKEMENLTD/gasgenerator.git main
```

### 方法2: push.batを使用

```bash
cd C:\Users\ooxmi\Downloads\gas-generator
push.bat
```
プロンプトが表示されたらトークンを入力

## なぜ権限がないのか？

- GitHubはパスワード認証を廃止
- Personal Access Token（PAT）が必要
- Claudeは直接トークンにアクセスできない（セキュリティのため）

## 緊急度：高

LINEボットが現在動作していません。早急にプッシュしてデプロイしてください。