import { ConversationSessionStore } from './session-store'

// セッション自動クリーンアップ機能
export class SessionCleanup {
  private static cleanupTimer: NodeJS.Timeout;
  
  static start() {
    this.cleanupTimer = setInterval(() => {
      const sessions = ConversationSessionStore.getInstance();
      sessions.cleanup();
    }, 60000);
  }
  
  static stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
