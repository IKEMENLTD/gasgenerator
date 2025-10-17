/**
 * 経験値・レベルシステム（ゲーミフィケーション）
 *
 * 🎮 目的: ユーザーのモチベーション維持
 * 📅 作成日: 2025-10-17
 */

import { supabaseAdmin } from '../supabase/client'
import { logger } from '../utils/logger'

export interface XPReward {
  amount: number
  reason: string
  badgesUnlocked: Badge[]
  levelUp: boolean
  newLevel?: number
}

export interface Badge {
  key: string
  name: string
  icon: string
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlockedAt: string
}

export interface UserStats {
  userId: string
  level: number
  totalXP: number
  xpToNextLevel: number
  codesGenerated: number
  errorsFixed: number
  autoFixesCount: number
  badges: Badge[]
  rank?: number
}

export class ExperienceSystem {
  /**
   * XPを付与
   */
  static async awardXP(
    userId: string,
    amount: number,
    reason: string,
    eventType?: 'code_generated' | 'error_fixed' | 'auto_fix' | 'badge_unlock'
  ): Promise<XPReward> {
    try {
      logger.info('Awarding XP', { userId, amount, reason, eventType })

      // ユーザー経験値レコードを取得または作成
      const { data: userXP, error: fetchError } = await supabaseAdmin
        .from('user_experience')
        .select('*')
        .eq('user_id', userId)
        .single()

      let currentXP = 0
      let currentLevel = 1
      let currentStats = {
        codes_generated: 0,
        errors_fixed: 0,
        auto_fixes_count: 0,
        badges: []
      }

      if (!fetchError && userXP) {
        currentXP = userXP.total_xp
        currentLevel = userXP.level
        currentStats = {
          codes_generated: userXP.codes_generated,
          errors_fixed: userXP.errors_fixed,
          auto_fixes_count: userXP.auto_fixes_count,
          badges: userXP.badges || []
        }
      }

      // 統計を更新
      const updates: any = {
        total_xp: currentXP + amount
      }

      if (eventType === 'code_generated') {
        updates.codes_generated = currentStats.codes_generated + 1
      } else if (eventType === 'error_fixed') {
        updates.errors_fixed = currentStats.errors_fixed + 1
      } else if (eventType === 'auto_fix') {
        updates.auto_fixes_count = currentStats.auto_fixes_count + 1
      }

      // レベルアップ判定
      const newLevel = this.calculateLevel(currentXP + amount)
      const levelUp = newLevel > currentLevel
      if (levelUp) {
        updates.level = newLevel
      }

      // データベースを更新（UPSERT）
      if (userXP) {
        await supabaseAdmin
          .from('user_experience')
          .update(updates)
          .eq('user_id', userId)
      } else {
        await supabaseAdmin
          .from('user_experience')
          .insert({
            user_id: userId,
            ...updates,
            level: newLevel,
            codes_generated: updates.codes_generated || 0,
            errors_fixed: updates.errors_fixed || 0,
            auto_fixes_count: updates.auto_fixes_count || 0
          })
      }

      // バッジ解除チェック
      const badgesUnlocked = await this.checkBadgeUnlocks(
        userId,
        {
          ...currentStats,
          ...updates
        }
      )

      // バッジ解除時のボーナスXPを追加
      if (badgesUnlocked.length > 0) {
        const bonusXP = badgesUnlocked.reduce((sum, badge) => sum + (badge.xpReward || 0), 0)
        if (bonusXP > 0) {
          await supabaseAdmin
            .from('user_experience')
            .update({ total_xp: currentXP + amount + bonusXP })
            .eq('user_id', userId)
        }
      }

      logger.info('XP awarded successfully', {
        userId,
        amount,
        newXP: currentXP + amount,
        levelUp,
        newLevel: levelUp ? newLevel : undefined,
        badgesUnlocked: badgesUnlocked.length
      })

      return {
        amount,
        reason,
        badgesUnlocked: badgesUnlocked.map(b => ({
          key: b.key,
          name: b.name,
          icon: b.icon,
          description: b.description,
          rarity: b.rarity,
          unlockedAt: new Date().toISOString()
        })),
        levelUp,
        newLevel: levelUp ? newLevel : undefined
      }

    } catch (error) {
      logger.error('Failed to award XP', {
        userId,
        amount,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        amount: 0,
        reason,
        badgesUnlocked: [],
        levelUp: false
      }
    }
  }

  /**
   * レベルを計算（XPから）
   */
  private static calculateLevel(xp: number): number {
    // 100XPごとに1レベル、指数関数的に必要XPが増加
    // Level 1: 0-100 XP
    // Level 2: 100-400 XP (+300)
    // Level 3: 400-900 XP (+500)
    // Level 4: 900-1600 XP (+700)
    return Math.floor(Math.sqrt(xp / 100)) + 1
  }

  /**
   * 次のレベルまでのXPを計算
   */
  private static calculateXPToNextLevel(currentXP: number, currentLevel: number): number {
    const nextLevelXP = Math.pow(currentLevel, 2) * 100
    return Math.max(0, nextLevelXP - currentXP)
  }

  /**
   * バッジ解除をチェック
   */
  private static async checkBadgeUnlocks(
    userId: string,
    stats: {
      codes_generated: number
      errors_fixed: number
      auto_fixes_count: number
      badges: any[]
    }
  ): Promise<any[]> {
    try {
      // 全バッジ定義を取得
      const { data: allBadges, error } = await supabaseAdmin
        .from('badge_definitions')
        .select('*')

      if (error || !allBadges) {
        return []
      }

      // 既に獲得済みのバッジキーを取得
      const ownedBadgeKeys = (stats.badges || []).map((b: any) => b.key || b)

      // 解除されたバッジを検出
      const unlockedBadges: any[] = []

      for (const badge of allBadges) {
        // 既に獲得済みならスキップ
        if (ownedBadgeKeys.includes(badge.badge_key)) {
          continue
        }

        // 条件をチェック
        const condition = badge.unlock_condition as any
        let unlocked = false

        if (condition.codes_generated && stats.codes_generated >= condition.codes_generated) {
          unlocked = true
        } else if (condition.errors_fixed && stats.errors_fixed >= condition.errors_fixed) {
          unlocked = true
        } else if (condition.auto_fixes_count && stats.auto_fixes_count >= condition.auto_fixes_count) {
          unlocked = true
        }

        if (unlocked) {
          unlockedBadges.push({
            key: badge.badge_key,
            name: badge.badge_name,
            icon: badge.badge_icon,
            description: badge.badge_description,
            rarity: badge.rarity,
            xpReward: badge.xp_reward
          })

          // バッジをユーザーに追加
          const newBadges = [...ownedBadgeKeys, badge.badge_key]
          await supabaseAdmin
            .from('user_experience')
            .update({ badges: newBadges })
            .eq('user_id', userId)
        }
      }

      return unlockedBadges

    } catch (error) {
      logger.warn('Failed to check badge unlocks', { userId, error })
      return []
    }
  }

  /**
   * ユーザーの統計を取得
   */
  static async getUserStats(userId: string): Promise<UserStats | null> {
    try {
      const { data: userXP, error } = await supabaseAdmin
        .from('user_experience')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !userXP) {
        // 新規ユーザー
        return {
          userId,
          level: 1,
          totalXP: 0,
          xpToNextLevel: 100,
          codesGenerated: 0,
          errorsFixed: 0,
          autoFixesCount: 0,
          badges: []
        }
      }

      // バッジ詳細を取得
      const badges: Badge[] = []
      if (userXP.badges && Array.isArray(userXP.badges)) {
        const { data: badgeDetails } = await supabaseAdmin
          .from('badge_definitions')
          .select('*')
          .in('badge_key', userXP.badges)

        if (badgeDetails) {
          badges.push(...badgeDetails.map(b => ({
            key: b.badge_key,
            name: b.badge_name,
            icon: b.badge_icon,
            description: b.badge_description,
            rarity: b.rarity,
            unlockedAt: userXP.updated_at
          })))
        }
      }

      // ランキングを取得
      const { data: ranking } = await supabaseAdmin
        .from('user_leaderboard')
        .select('rank')
        .eq('line_user_id', userId)
        .single()

      return {
        userId,
        level: userXP.level,
        totalXP: userXP.total_xp,
        xpToNextLevel: this.calculateXPToNextLevel(userXP.total_xp, userXP.level),
        codesGenerated: userXP.codes_generated,
        errorsFixed: userXP.errors_fixed,
        autoFixesCount: userXP.auto_fixes_count,
        badges,
        rank: ranking?.rank
      }

    } catch (error) {
      logger.error('Failed to get user stats', { userId, error })
      return null
    }
  }

  /**
   * リーダーボードを取得
   */
  static async getLeaderboard(limit: number = 10): Promise<UserStats[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_leaderboard')
        .select('*')
        .limit(limit)

      if (error || !data) {
        return []
      }

      return data.map(user => ({
        userId: user.line_user_id,
        level: user.level,
        totalXP: user.total_xp,
        xpToNextLevel: this.calculateXPToNextLevel(user.total_xp, user.level),
        codesGenerated: user.codes_generated,
        errorsFixed: user.errors_fixed,
        autoFixesCount: user.auto_fixes_count,
        badges: [],
        rank: user.rank
      }))

    } catch (error) {
      logger.error('Failed to get leaderboard', { error })
      return []
    }
  }

  /**
   * XP報酬の定数
   */
  static readonly XP_REWARDS = {
    CODE_GENERATED: 50,         // コード生成
    ERROR_FIXED_MANUAL: 100,    // 手動でエラー修正
    ERROR_FIXED_AUTO: 200,      // 自動修正成功
    FIRST_CODE: 100,            // 初めてのコード
    FIRST_ERROR_FIX: 200,       // 初めてのエラー修正
    CONSECUTIVE_SUCCESS: 150,   // 連続成功ボーナス
    DAILY_BONUS: 50             // 毎日ログイン
  }
}
