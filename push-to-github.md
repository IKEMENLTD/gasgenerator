# GitHubへのプッシュ方法

## Option 1: Personal Access Token を使用

1. GitHubにログイン
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token" をクリック
4. 権限: `repo` にチェック
5. トークンをコピー

コマンド:
```bash
git push https://YOUR_TOKEN@github.com/IKEMENLTD/gasgenerator.git main
```

## Option 2: GitHub CLIを使用

```bash
# GitHub CLIをインストール
winget install --id GitHub.cli

# ログイン
gh auth login

# プッシュ
git push origin main
```

## Option 3: SSHキーを設定

```bash
# SSHキー生成
ssh-keygen -t ed25519 -C "your-email@example.com"

# 公開鍵をコピー
cat ~/.ssh/id_ed25519.pub

# GitHubのSettings → SSH and GPG keys → New SSH keyに追加

# リモートURLをSSHに変更
git remote set-url origin git@github.com:IKEMENLTD/gasgenerator.git

# プッシュ
git push origin main
```