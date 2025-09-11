// メモリリーク修正パッチ

// 1. lib/memory/memory-manager.ts の修正
export const MEMORY_CONFIG = {
  // 閾値を下げて早めにクリーンアップ
  HIGH_MEMORY_THRESHOLD: 0.75, // 94% → 75%
  CRITICAL_MEMORY_THRESHOLD: 0.85, // 96% → 85%
  
  // クリーンアップ間隔を長くする
  CLEANUP_INTERVAL: 60000, // 30秒 → 60秒
  
  // キャッシュサイズを制限
  MAX_CACHE_SIZE: 50, // 100 → 50
  MAX_CACHE_AGE: 300000, // 5分でキャッシュクリア
};

// 2. lib/conversation/session-handler.ts の修正
// セッションの自動クリーンアップ
class SessionHandler {
  private static sessions = new Map();
  private static cleanupTimer: NodeJS.Timeout;

  static startCleanup() {
    // 古いセッションを定期的に削除
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, session] of this.sessions) {
        if (now - session.lastAccess > 600000) { // 10分経過
          this.sessions.delete(key);
        }
      }
    }, 60000); // 1分ごとにチェック
  }

  static destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.sessions.clear();
  }
}

// 3. app/api/webhook/route.ts の修正
// リクエストごとにメモリ解放
export async function POST(request: Request) {
  try {
    // 処理...
    const result = await processWebhook(request);
    
    // 明示的にガベージコレクションのヒント
    if (global.gc) {
      global.gc();
    }
    
    return result;
  } finally {
    // リクエスト終了時にクリーンアップ
    await cleanupResources();
  }
}

// 4. lib/supabase/queries.ts の修正
// データベース接続の適切な解放
export class DatabaseQueries {
  static async executeQuery(query: () => Promise<any>) {
    let client;
    try {
      client = await getClient();
      return await query();
    } finally {
      // 接続を必ず解放
      if (client?.release) {
        client.release();
      }
    }
  }
}

// 5. next.config.js の修正
module.exports = {
  experimental: {
    // メモリ最適化オプション
    workerThreads: false,
    cpus: 1,
    optimizeCss: true,
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  
  // メモリ制限の設定
  env: {
    NODE_OPTIONS: '--max-old-space-size=400 --optimize-for-size',
  },
  
  // 不要な機能を無効化
  images: {
    unoptimized: true, // 画像最適化を無効化してメモリ節約
  },
};

// 6. ユーザー作成エラーの修正
// lib/supabase/queries.ts
static async createUser(lineUserId: string) {
  // line_user_idがnullにならないように修正
  const userData = {
    id: crypto.randomUUID(),
    line_user_id: lineUserId || 'unknown', // nullを防ぐ
    display_name: null,
    skill_level: 'beginner',
    total_requests: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
    settings: null,
    subscription_status: 'free',
    subscription_end_date: null,
    stripe_customer_id: null,
    lifetime_requests: 0,
    daily_date: new Date().toISOString().split('T')[0],
  };
  
  return await supabase
    .from('users')
    .insert(userData)
    .single();
}