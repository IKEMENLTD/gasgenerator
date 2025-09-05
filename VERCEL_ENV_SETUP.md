# 🚀 Vercel環境変数設定ガイド

## デプロイURLが取得できました！
```
https://gas-generator-g70swfdqa-ikemens-projects.vercel.app
```

## 📝 次のステップ：環境変数の設定

### 1. Vercelダッシュボードにアクセス
1. https://vercel.com にアクセス
2. プロジェクト「gas-generator」を選択
3. 「Settings」タブをクリック
4. 左メニューから「Environment Variables」を選択

### 2. 以下の環境変数を追加

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `LINE_CHANNEL_SECRET` | LINE Channel Secret | LINE Developersコンソール → Basic settings |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Channel Access Token | LINE Developersコンソール → Messaging API |
| `CLAUDE_API_KEY` | Claude API Key | https://console.anthropic.com |
| `SUPABASE_URL` | Supabase URL | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_BASE_URL` | `https://gas-generator-g70swfdqa-ikemens-projects.vercel.app` | デプロイURL |
| `JWT_SECRET` | (自動生成された値を使用) | .env.localの値をコピー |
| `ENCRYPTION_KEY` | (自動生成された値を使用) | .env.localの値をコピー |

### 3. 環境変数追加方法
1. 「Add New」ボタンをクリック
2. 「Name」に変数名を入力
3. 「Value」に値を入力
4. 「Environment」は全て選択（Production, Preview, Development）
5. 「Save」をクリック

### 4. 再デプロイ
環境変数を設定後、再デプロイが必要です：

```bash
npx vercel --prod --force
```

または、Vercelダッシュボードで「Redeploy」ボタンをクリック

## 🔗 LINE Webhook URL設定

デプロイ成功後、LINE Developersコンソールで：

1. LINE Developersコンソール（https://developers.line.biz）にアクセス
2. プロバイダー → チャネルを選択
3. 「Messaging API」タブを開く
4. 「Webhook settings」セクションで：
   - Webhook URL: `https://gas-generator-g70swfdqa-ikemens-projects.vercel.app/api/webhook`
   - 「Use webhook」をONに設定
   - 「Verify」ボタンでテスト

## ✅ 動作確認

1. LINE公式アカウントを友だち追加
2. メッセージを送信してテスト
3. 「こんにちは」と送ると、カテゴリ選択メッセージが返ってくれば成功！

## 🛠 トラブルシューティング

### ビルドエラーが続く場合
1. Vercelダッシュボードの「Functions」タブでログを確認
2. 「Build Logs」でエラーの詳細を確認

### Webhook検証が失敗する場合
1. 環境変数が正しく設定されているか確認
2. LINE_CHANNEL_SECRETが正しいか確認
3. Vercelのログでエラーを確認

## 📊 監視とログ

Vercelダッシュボードで以下を確認できます：
- **Functions**: APIエンドポイントの実行ログ
- **Analytics**: アクセス数やレスポンスタイム
- **Logs**: リアルタイムログ

---

何か問題があれば、エラーメッセージと共にお知らせください！