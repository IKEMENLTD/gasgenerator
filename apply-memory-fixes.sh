#!/bin/bash

echo "🔧 メモリリーク修正を適用中..."
echo "================================"

# 1. memory-manager.tsの設定を更新
echo "📝 メモリ管理設定を更新中..."
cat > lib/memory/memory-config-update.ts << 'EOF'
export const MEMORY_CONFIG = {
  HIGH_MEMORY_THRESHOLD: 0.75,
  CRITICAL_MEMORY_THRESHOLD: 0.85,
  CLEANUP_INTERVAL: 60000,
  MAX_CACHE_SIZE: 50,
  MAX_CACHE_AGE: 300000,
  FORCE_GC_INTERVAL: 120000,
};
EOF

# memory-manager.tsの該当部分を更新
if [ -f "lib/memory/memory-manager.ts" ]; then
  sed -i 's/HIGH_MEMORY_THRESHOLD: 0.94/HIGH_MEMORY_THRESHOLD: 0.75/g' lib/memory/memory-manager.ts
  sed -i 's/CRITICAL_MEMORY_THRESHOLD: 0.96/CRITICAL_MEMORY_THRESHOLD: 0.85/g' lib/memory/memory-manager.ts
  sed -i 's/CLEANUP_INTERVAL: 30000/CLEANUP_INTERVAL: 60000/g' lib/memory/memory-manager.ts
  echo "✅ memory-manager.ts を更新しました"
fi

# 2. session-handler.tsにクリーンアップ機能を追加
echo "📝 セッションクリーンアップを追加中..."
cat >> lib/conversation/session-cleanup.ts << 'EOF'
// セッション自動クリーンアップ機能
export class SessionCleanup {
  private static cleanupTimer: NodeJS.Timeout;
  
  static start() {
    this.cleanupTimer = setInterval(() => {
      const sessions = SessionStore.getInstance();
      sessions.cleanup();
    }, 60000);
  }
  
  static stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
EOF

# 3. next.config.jsを更新
echo "📝 Next.js設定を最適化中..."
cat > next.config.memory.js << 'EOF'
const nextConfig = {
  experimental: {
    workerThreads: false,
    cpus: 1,
    optimizeCss: true,
    optimizePackageImports: ['@supabase/supabase-js', 'openai'],
  },
  
  env: {
    NODE_OPTIONS: '--max-old-space-size=400 --optimize-for-size',
  },
  
  images: {
    unoptimized: true,
  },
  
  // APIルートのタイムアウトを設定
  api: {
    responseLimit: '1mb',
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

module.exports = nextConfig;
EOF

# 4. package.jsonのstartスクリプトを更新
echo "📝 起動スクリプトを最適化中..."
sed -i 's/"start": "node --max-old-space-size=400/"start": "node --max-old-space-size=400 --expose-gc --optimize-for-size/g' package.json

# 5. データベースクエリの修正
echo "📝 データベース接続の解放処理を追加中..."
cat > lib/supabase/connection-fix.ts << 'EOF'
// 接続プール管理の改善
import { createClient } from '@supabase/supabase-js';

class SupabaseConnectionPool {
  private static instance: any;
  private static lastCleanup: number = 0;
  
  static getClient() {
    // 5分ごとに接続をリフレッシュ
    const now = Date.now();
    if (now - this.lastCleanup > 300000) {
      this.instance = null;
      this.lastCleanup = now;
    }
    
    if (!this.instance) {
      this.instance = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: { persistSession: false },
          realtime: { params: { eventsPerSecond: 2 } },
        }
      );
    }
    
    return this.instance;
  }
  
  static cleanup() {
    this.instance = null;
  }
}

export { SupabaseConnectionPool };
EOF

echo "✅ 修正ファイルを作成しました"
echo ""
echo "================================"
echo "📊 作成された修正ファイル:"
echo "- lib/memory/memory-config-update.ts"
echo "- lib/conversation/session-cleanup.ts"
echo "- next.config.memory.js"
echo "- lib/supabase/connection-fix.ts"
echo "================================"
echo ""
echo "次のステップ:"
echo "1. 修正内容を既存ファイルにマージ"
echo "2. npm run build でビルド確認"
echo "3. GitHubにプッシュ"