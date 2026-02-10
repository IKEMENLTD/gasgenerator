# 🔧 GitHubプッシュ修正コマンド

# .env.production.clean をGit追跡から削除
git rm --cached .env.production.clean

# .gitignore の変更をステージング
git add .gitignore

# 修正をコミット
git commit --amend --no-edit

# 強制プッシュ
git push origin main --force
