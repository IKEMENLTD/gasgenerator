# 環境変数設定ガイド

## 1. Supabase の設定値を取得

Supabase Dashboard (https://app.supabase.com) から：

1. **Settings → API** を開く
2. 以下をコピー：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` に設定
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定
   - `service_role (secret)` → `SUPABASE_SERVICE_ROLE_KEY` に設定

## 2. .env.local ファイルを更新

```bash
# .env.local ファイルを編集
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=実際のanon_keyをここに貼り付け
SUPABASE_SERVICE_ROLE_KEY=実際のservice_role_keyをここに貼り付け

# 他の環境変数も実際の値に更新
LINE_CHANNEL_ACCESS_TOKEN=実際の値
LINE_CHANNEL_SECRET=実際の値
ANTHROPIC_API_KEY=実際の値
```

## 3. Render.com の環境変数も更新

1. https://dashboard.render.com にログイン
2. あなたのサービスを選択
3. Environment → Environment Variables
4. 以下を追加/更新：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. 「Save Changes」をクリック

サービスが自動的に再デプロイされます。