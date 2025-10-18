# 🚀 自動プッシュスクリプト使用ガイド

このスクリプトを使えば、`git add` → `git commit` → `git push` を**1コマンド**で実行できます！

## 📋 使い方

### Windowsの場合

#### 方法1: エクスプローラーからダブルクリック
1. `auto-push.bat` をダブルクリック
2. デフォルトメッセージ "Auto commit and push" でコミット・プッシュされます

#### 方法2: カスタムメッセージを指定
1. コマンドプロンプトを開く
2. プロジェクトフォルダに移動
```cmd
cd C:\Users\ooxmi\Downloads\gas-generator
```
3. メッセージを指定して実行
```cmd
auto-push.bat "Fix link details modal"
```

### Linux/WSLの場合

```bash
# プロジェクトフォルダに移動
cd /mnt/c/Users/ooxmi/Downloads/gas-generator

# デフォルトメッセージで実行
./auto-push.sh

# カスタムメッセージで実行
./auto-push.sh "Fix link details modal"
```

## ✨ スクリプトが自動で行うこと

1. **ステージング**: `git add .` - 全ての変更をステージング
2. **コミット**: `git commit -m "メッセージ"` - 変更をコミット
3. **プッシュ**: `git push origin main` - GitHubにプッシュ

## 🌐 Netlifyへの自動デプロイ

**プッシュが成功すると、Netlifyが自動的にデプロイを開始します！**

- ⏱️ デプロイ時間: 通常2-5分
- 🔗 デプロイ状況: https://app.netlify.com/sites/gasgenerator/deploys
- 🌍 本番URL: https://taskmateai.net

## 💡 ヒント

### より簡単に使う方法

#### Windows: 右クリックメニューに追加
1. `send-to-auto-push.bat` を作成（エクスプローラーで右クリック → 送る → に追加）
2. ファイルを選択 → 右クリック → 送る → auto-push で実行

#### VSCode: タスクとして登録
`.vscode/tasks.json` に追加:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Auto Push to GitHub",
      "type": "shell",
      "command": "./auto-push.sh",
      "args": ["${input:commitMessage}"],
      "problemMatcher": []
    }
  ],
  "inputs": [
    {
      "id": "commitMessage",
      "type": "promptString",
      "description": "コミットメッセージを入力",
      "default": "Auto commit"
    }
  ]
}
```

## ⚠️ トラブルシューティング

### プッシュが失敗する場合

1. **認証エラー**
   - GitHub認証情報を確認
   - 必要に応じて再認証: `git config --global credential.helper manager`

2. **ネットワークエラー**
   - インターネット接続を確認
   - VPNを使用している場合は一時的に無効化

3. **コミット対象がない**
   - `⚠️ 変更がないか、コミットに失敗しました` と表示されますが、プッシュは続行されます
   - 既存のコミットがある場合はそれがプッシュされます

## 📝 従来の方法との比較

### 従来の方法（3コマンド）
```bash
git add .
git commit -m "メッセージ"
git push origin main
```

### 新しい方法（1コマンド）
```bash
./auto-push.sh "メッセージ"
```

または

```cmd
auto-push.bat "メッセージ"
```

**60%以上の時間短縮！** 🎉
