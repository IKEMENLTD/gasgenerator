# 🔴 重要な修正が必要

## 発見した問題

### 1. SessionManagerを作ったのに使っていない箇所が多数
- `supabaseStore`の直接呼び出しが **20箇所以上**
- `sessionStore`の直接呼び出しも **15箇所以上**
- これらは全て`SessionManager`経由にすべき

### 2. 競合の可能性
- 3つのストア（sessionStore、supabaseStore、sessionManager）が混在
- 同期が取れない可能性あり
- キャッシュの不整合リスク

## 修正すべき箇所

### supabaseStore直接呼び出し（全て sessionManager に置換必要）

| 行番号 | 現在のコード | 修正後 |
|--------|------------|--------|
| 238 | `await supabaseStore.updateContext(userId, {...})` | `await sessionManager.saveContext(userId, {...})` |
| 312 | `await supabaseStore.getFullConversation(userId)` | `await sessionManager.getContext(userId)` |
| 344 | `await supabaseStore.updateContext(userId, {...})` | `await sessionManager.saveContext(userId, {...})` |
| 368 | `await supabaseStore.deleteSession(userId)` | `await sessionManager.deleteSession(userId)` |
| 376 | `await supabaseStore.getRecentMessages(userId, 5)` | 新しいメソッド必要 |
| 388 | `await supabaseStore.saveMessage(...)` | `await sessionManager.saveMessage(...)` |
| 490 | `await supabaseStore.createNewSession(...)` | `await sessionManager.createSession(...)` |
| 499 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 528 | `await supabaseStore.deleteSession(userId)` | `await sessionManager.deleteSession(userId)` |
| 558 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 572 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 602 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 634 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 672 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 699 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 703 | `await supabaseStore.saveMessage(...)` | `await sessionManager.saveMessage(...)` |
| 920 | `await supabaseStore.getFullConversation(...)` | `await sessionManager.getContext(...)` |
| 934 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 946 | `await supabaseStore.createNewSession(...)` | `await sessionManager.createSession(...)` |
| 955 | `await supabaseStore.saveMessage(...)` | `await sessionManager.saveMessage(...)` |
| 979 | `await supabaseStore.updateContext(...)` | `await sessionManager.saveContext(...)` |
| 1020 | `await supabaseStore.getFullConversation(...)` | `await sessionManager.getContext(...)` |
| 1023 | `await supabaseStore.createNewSession(...)` | `await sessionManager.createSession(...)` |
| 1031 | `await supabaseStore.saveMessage(...)` | `await sessionManager.saveMessage(...)` |

### sessionStore直接呼び出し（削除または sessionManager に置換）

| 行番号 | 現在のコード | 修正後 |
|--------|------------|--------|
| 245 | `sessionStore.set(userId, {...})` | 削除（sessionManagerが処理） |
| 350 | `sessionStore.set(userId, context)` | 削除 |
| 369 | `sessionStore.delete(userId)` | 削除（sessionManagerが処理） |
| 493 | `sessionStore.set(userId, context)` | 削除 |
| 502 | `sessionStore.set(userId, result.updatedContext)` | 削除 |
| 529 | `sessionStore.delete(userId)` | 削除 |
| 563 | `sessionStore.set(userId, context)` | 削除 |
| 576 | `sessionStore.set(userId, context)` | 削除 |
| 608 | `sessionStore.set(userId, context)` | 削除 |
| 639 | `sessionStore.set(userId, context)` | 削除 |
| 645 | `sessionStore.set(userId, context)` | 削除 |
| 678 | `sessionStore.set(userId, context)` | 削除 |
| 711 | `sessionStore.set(userId, result.updatedContext)` | 削除 |
| 900 | `sessionStore.delete(userId)` | `await sessionManager.deleteSession(userId)` |
| 923 | `context = sessionStore.get(userId)` | `context = await sessionManager.getContext(userId)` |
| 938 | `sessionStore.set(userId, context)` | 削除 |
| 985 | `sessionStore.set(userId, context)` | 削除 |
| 1046 | `sessionStore.set(userId, context)` | 削除 |

## 追加で必要な修正

### SessionManagerに不足しているメソッド

```typescript
// lib/conversation/session-manager.ts に追加必要

async getRecentMessages(userId: string, limit: number = 30): Promise<Message[]> {
  try {
    return await this.supabaseStore.getRecentMessages(userId, limit)
  } catch (error) {
    logger.warn('Failed to get recent messages', { userId, error })
    return []
  }
}
```

## リスク評価

### 現状のリスク
- 🔴 **高**: データ不整合の可能性
- 🔴 **高**: キャッシュとDBの同期ずれ
- 🟡 **中**: パフォーマンス劣化（重複処理）
- 🟡 **中**: デバッグ困難（3つのストアが混在）

### 修正後の効果
- ✅ 単一の入口（SessionManager）で管理
- ✅ 自動的なフォールバック
- ✅ キャッシュ戦略の一元化
- ✅ エラーハンドリングの統一

## 実装優先度

1. **最優先**: supabaseStore直接呼び出しの置換（24箇所）
2. **高**: sessionStore.set/deleteの削除（18箇所）
3. **中**: SessionManagerへのメソッド追加
4. **低**: テストの更新

## 結論

**現状では SessionManager を作ったものの、ほとんど使われていない状態**。
これでは作った意味がなく、むしろ複雑性が増しているだけ。

早急に全ての呼び出しを SessionManager 経由に統一すべき。