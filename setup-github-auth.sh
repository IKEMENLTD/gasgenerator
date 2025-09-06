#!/bin/bash

echo "========================================="
echo "GitHub Authentication Setup"
echo "========================================="
echo ""
echo "このスクリプトでGitHub認証を設定します。"
echo ""
echo "必要なもの:"
echo "1. GitHub Personal Access Token (PAT)"
echo "   - https://github.com/settings/tokens/new から作成"
echo "   - 必要な権限: repo (full control of private repositories)"
echo ""
echo "2. GitHubユーザー名"
echo ""
echo "========================================="
echo ""

# ユーザー名の入力
read -p "GitHubユーザー名を入力してください (IKEMENLTD): " GITHUB_USER
GITHUB_USER=${GITHUB_USER:-IKEMENLTD}

# Personal Access Tokenの入力
echo ""
echo "Personal Access Tokenを入力してください:"
echo "(入力時は表示されません)"
read -s GITHUB_TOKEN
echo ""

# 入力確認
if [ -z "$GITHUB_TOKEN" ]; then
    echo "エラー: トークンが入力されていません"
    exit 1
fi

echo "設定を開始します..."

# Git設定
git config --global user.name "$GITHUB_USER"
git config --global user.email "${GITHUB_USER}@users.noreply.github.com"
git config --global credential.helper store

# 認証情報を保存
echo "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials

# リモートURLを更新
cd /mnt/c/Users/ooxmi/Downloads/gas-generator
git remote set-url origin "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/IKEMENLTD/gasgenerator.git"

echo ""
echo "✅ 設定が完了しました！"
echo ""
echo "設定内容:"
echo "- ユーザー名: $GITHUB_USER"
echo "- 認証方式: Personal Access Token"
echo "- リポジトリ: IKEMENLTD/gasgenerator"
echo ""
echo "次のコマンドでプッシュできます:"
echo "git push origin main"
echo ""