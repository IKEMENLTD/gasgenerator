# メモリ最適化ガイド

## 現在のメモリ使用状況（Render無料プラン: 512MB）

```
Next.js本体: 300MB (60%)
アプリケーション: 150MB (30%)
バッファ: 50MB (10%)
-------------------
合計: 500MB (97%)  ← 危険！
```

## メモリを減らす具体策

### 1. 不要なインポートを削除
```javascript
// ❌ 悪い例
import * as everything from 'large-library'

// ✅ 良い例
import { specificFunction } from 'large-library'
```

### 2. グローバル変数を最小化
```javascript
// ❌ 悪い例
const cache = new Map() // 永続的に保持

// ✅ 良い例
function getCache() {
  // リクエストごとに作成・破棄
  return new Map()
}
```

### 3. 文字列連結を避ける
```javascript
// ❌ 悪い例（メモリ大量消費）
let result = ""
for (let i = 0; i < 10000; i++) {
  result += data[i]  // 毎回新しい文字列作成
}

// ✅ 良い例
const parts = []
for (let i = 0; i < 10000; i++) {
  parts.push(data[i])
}
const result = parts.join('')
```

### 4. ストリーミング処理
```javascript
// ❌ 悪い例（全データをメモリに）
const allData = await fetchAllData()
process(allData)

// ✅ 良い例（チャンクごとに処理）
for await (const chunk of fetchDataStream()) {
  process(chunk)
}
```

### 5. 不要なデータを削除
```javascript
// セッション管理の改善
class SessionStore {
  cleanup() {
    // 古いセッションを削除
    this.sessions.forEach((session, key) => {
      if (isExpired(session)) {
        this.sessions.delete(key)
      }
    })
  }
}
```

## 即効性のある対策

### 1. **package.jsonの最適化**
```json
{
  "scripts": {
    "start": "node --max-old-space-size=400 node_modules/.bin/next start"
  }
}
```

### 2. **環境変数追加**
```bash
NODE_OPTIONS="--max-old-space-size=400"
```

### 3. **不要な依存関係削除**
```bash
npm prune --production  # 開発用パッケージ削除
```

## 根本的な解決策

### オプション1: Serverless化（Vercel）
- メリット: リクエストごとにリセット
- デメリット: コールドスタート

### オプション2: 有料プラン（Render）
- $7/月: 2GB RAM
- $25/月: 4GB RAM

### オプション3: 軽量フレームワーク
- Express.js（50MB）
- Fastify（30MB）
- Hono（10MB）

## 緊急時の対処法

```javascript
// メモリ使用量90%超えたら強制リセット
if (memoryUsage > 0.9) {
  // キャッシュクリア
  cache.clear()
  sessionStore.clear()
  
  // 強制GC
  if (global.gc) global.gc()
  
  // 最悪の場合、プロセス再起動
  // process.exit(1)
}
```