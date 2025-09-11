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
