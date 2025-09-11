#!/usr/bin/env python3
"""
GitHubに直接コミットを作成するスクリプト
"""

import base64
import json
import os
import sys
import subprocess

def get_file_content(filepath):
    """ファイルの内容を取得"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def create_github_commit():
    """GitHub APIを使用して直接コミット"""
    
    # GitHubトークンの確認
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        print("❌ GITHUB_TOKEN環境変数が設定されていません")
        print("\n設定方法:")
        print("1. https://github.com/settings/tokens にアクセス")
        print("2. 'Generate new token (classic)' をクリック")
        print("3. 'repo' スコープを選択")
        print("4. トークンをコピー")
        print("5. export GITHUB_TOKEN=your_token_here")
        return False
    
    # リポジトリ情報
    owner = "IKEMENLTD"
    repo = "gasgenerator"
    branch = "main"
    
    # 修正するファイル
    files = [
        {
            "path": "lib/config/environment.ts",
            "content": get_file_content("lib/config/environment.ts"),
            "message": "Move ADMIN_API_TOKEN to optional environment variables"
        },
        {
            "path": "lib/auth/jwt-manager.ts", 
            "content": get_file_content("lib/auth/jwt-manager.ts"),
            "message": "Change ADMIN_API_TOKEN to optional with default value"
        }
    ]
    
    print("📝 GitHubへの直接コミットを準備中...")
    
    # curlコマンドを使用してGitHub APIを呼び出し
    for file_info in files:
        print(f"\n📦 {file_info['path']} を更新中...")
        
        # Base64エンコード
        content_base64 = base64.b64encode(file_info['content'].encode()).decode()
        
        # 現在のファイルのSHAを取得
        get_sha_cmd = f"""
        curl -s -H "Authorization: token {token}" \
             -H "Accept: application/vnd.github.v3+json" \
             https://api.github.com/repos/{owner}/{repo}/contents/{file_info['path']}?ref={branch}
        """
        
        try:
            result = subprocess.run(get_sha_cmd, shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                response = json.loads(result.stdout)
                current_sha = response.get('sha', '')
            else:
                print(f"⚠️  {file_info['path']} のSHA取得に失敗")
                current_sha = ''
        except:
            current_sha = ''
        
        # ファイルを更新
        update_data = {
            "message": f"Fix: {file_info['message']}",
            "content": content_base64,
            "branch": branch
        }
        
        if current_sha:
            update_data["sha"] = current_sha
        
        update_cmd = f"""
        curl -X PUT \
             -H "Authorization: token {token}" \
             -H "Accept: application/vnd.github.v3+json" \
             https://api.github.com/repos/{owner}/{repo}/contents/{file_info['path']} \
             -d '{json.dumps(update_data)}'
        """
        
        result = subprocess.run(update_cmd, shell=True, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ {file_info['path']} を更新しました")
        else:
            print(f"❌ {file_info['path']} の更新に失敗")
            print(f"エラー: {result.stderr}")
            return False
    
    print("\n✅ 全ファイルの更新が完了しました！")
    print("🚀 Renderで自動デプロイが開始されます")
    print(f"📊 確認: https://github.com/{owner}/{repo}/commits/{branch}")
    return True

if __name__ == "__main__":
    success = create_github_commit()
    sys.exit(0 if success else 1)