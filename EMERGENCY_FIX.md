# 🚨 緊急対応手順

## デプロイタイムアウト問題

### 1. Render環境変数追加（緊急）
```
NODE_OPTIONS=--max-old-space-size=400
```

### 2. @line/bot-sdk を削除（メモリ削減）
```bash
npm uninstall @line/bot-sdk
```

### 3. 不要な依存関係削除
```bash
npm prune --production
```

## Renderダッシュボードで設定変更

1. **Settings → Health Check Path**
   - `/api/health` に設定

2. **Settings → Deploy Hook**
   - Clear build cacheをON

3. **Manual Deploy**
   - "Clear build cache & deploy" を選択

## それでもダメなら

### オプション1: インスタンスタイプ変更
- Free → Starter ($7/月)
- RAM: 512MB → 2GB

### オプション2: Vercelへ移行
```bash
npx vercel deploy
```

## 最小限の起動設定

```javascript
// next.config.js に追加
module.exports = {
  experimental: {
    serverMinification: true,
    optimizeCss: true,
  },
  compress: true,
  poweredByHeader: false,
}
```