import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import fs from 'fs/promises'
import path from 'path'

interface Migration {
  version: string
  name: string
  sql: string
  checksum: string
  appliedAt?: Date
}

interface MigrationHistory {
  id: string
  version: string
  name: string
  checksum: string
  applied_at: string
  execution_time: number
  success: boolean
  error?: string
}

export class MigrationManager {
  private static instance: MigrationManager | null = null
  private readonly migrationsPath = path.join(process.cwd(), 'supabase/migrations')
  private readonly migrationsTable = 'schema_migrations'

  private constructor() {}

  static getInstance(): MigrationManager {
    if (!this.instance) {
      this.instance = new MigrationManager()
    }
    return this.instance
  }

  /**
   * マイグレーションの実行
   */
  async migrate(): Promise<void> {
    logger.info('Starting database migration')

    try {
      // マイグレーションテーブルの作成
      await this.ensureMigrationsTable()

      // 実行済みマイグレーションの取得
      const appliedMigrations = await this.getAppliedMigrations()
      
      // 未実行マイグレーションの取得
      const pendingMigrations = await this.getPendingMigrations(appliedMigrations)

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations')
        return
      }

      logger.info('Found pending migrations', { count: pendingMigrations.length })

      // マイグレーションを順次実行
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration)
      }

      logger.info('Migration completed successfully')
    } catch (error) {
      logger.error('Migration failed', { error })
      throw error
    }
  }

  /**
   * マイグレーションテーブルの作成
   */
  private async ensureMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        execution_time INTEGER NOT NULL,
        success BOOLEAN DEFAULT true,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_version 
      ON ${this.migrationsTable}(version);
      
      CREATE INDEX IF NOT EXISTS idx_migrations_applied_at 
      ON ${this.migrationsTable}(applied_at);
    `

    const { error } = await (supabase as any).rpc('exec_sql', { sql })
    
    if (error) {
      throw new Error(`Failed to create migrations table: ${error.message}`)
    }
  }

  /**
   * 実行済みマイグレーションの取得
   */
  private async getAppliedMigrations(): Promise<Set<string>> {
    const { data, error } = await supabase
      .from(this.migrationsTable)
      .select('version')
      .eq('success', true)
      .order('version', { ascending: true })

    if (error) {
      throw new Error(`Failed to get applied migrations: ${error.message}`)
    }

    return new Set(data?.map((m: any) => m.version) || [])
  }

  /**
   * 未実行マイグレーションの取得
   */
  private async getPendingMigrations(
    appliedMigrations: Set<string>
  ): Promise<Migration[]> {
    // Node.js環境でのみファイルシステムアクセス可能
    if (typeof window !== 'undefined') {
      logger.warn('Cannot access file system in browser environment')
      return []
    }

    try {
      const files = await fs.readdir(this.migrationsPath)
      const sqlFiles = files
        .filter(f => f.endsWith('.sql'))
        .sort()

      const migrations: Migration[] = []

      for (const file of sqlFiles) {
        const version = this.extractVersion(file)
        
        if (!appliedMigrations.has(version)) {
          const filePath = path.join(this.migrationsPath, file)
          const sql = await fs.readFile(filePath, 'utf-8')
          const checksum = await this.calculateChecksum(sql)

          migrations.push({
            version,
            name: file,
            sql,
            checksum
          })
        }
      }

      return migrations
    } catch (error) {
      logger.error('Failed to read migration files', { error })
      return []
    }
  }

  /**
   * バージョン番号の抽出
   */
  private extractVersion(filename: string): string {
    // Format: YYYYMMDD_description.sql
    const match = filename.match(/^(\d{8})/);
    return match ? match[1] : filename.replace('.sql', '')
  }

  /**
   * チェックサムの計算
   */
  private async calculateChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * マイグレーションの実行
   */
  private async executeMigration(migration: Migration): Promise<void> {
    const startTime = Date.now()
    
    logger.info('Executing migration', {
      version: migration.version,
      name: migration.name
    })

    try {
      // トランザクション内で実行
      const { error } = await (supabase as any).rpc('exec_sql', { 
        sql: migration.sql 
      })

      if (error) {
        throw error
      }

      const executionTime = Date.now() - startTime

      // 履歴に記録
      await this.recordMigration(migration, executionTime, true)

      logger.info('Migration executed successfully', {
        version: migration.version,
        executionTime
      })
    } catch (error) {
      const executionTime = Date.now() - startTime
      
      // エラーを記録
      await this.recordMigration(
        migration,
        executionTime,
        false,
        error instanceof Error ? error.message : String(error)
      )

      logger.error('Migration failed', {
        version: migration.version,
        error
      })

      throw error
    }
  }

  /**
   * マイグレーション履歴の記録
   */
  private async recordMigration(
    migration: Migration,
    executionTime: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    const { error: insertError } = await (supabase as any)
      .from(this.migrationsTable)
      .insert({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        execution_time: executionTime,
        success,
        error
      })

    if (insertError) {
      logger.error('Failed to record migration', {
        version: migration.version,
        error: insertError
      })
    }
  }

  /**
   * ロールバック
   */
  async rollback(version?: string): Promise<void> {
    logger.info('Starting rollback', { targetVersion: version })

    const { data: migrations, error } = await supabase
      .from(this.migrationsTable)
      .select('*')
      .eq('success', true)
      .order('version', { ascending: false })

    if (error) {
      throw new Error(`Failed to get migration history: ${error.message}`)
    }

    if (!migrations || migrations.length === 0) {
      logger.info('No migrations to rollback')
      return
    }

    // ロールバック対象の決定
    const targetMigrations = version
      ? migrations.filter((m: any) => m.version > version)
      : [migrations[0]]

    for (const migration of targetMigrations) {
      await this.rollbackMigration(migration)
    }

    logger.info('Rollback completed')
  }

  /**
   * 個別マイグレーションのロールバック
   */
  private async rollbackMigration(migration: MigrationHistory): Promise<void> {
    logger.info('Rolling back migration', {
      version: migration.version,
      name: migration.name
    })

    // ロールバックSQLファイルの読み込み
    const rollbackFile = migration.name.replace('.sql', '.down.sql')
    const rollbackPath = path.join(this.migrationsPath, rollbackFile)

    try {
      const rollbackSql = await fs.readFile(rollbackPath, 'utf-8')
      
      const { error } = await (supabase as any).rpc('exec_sql', { 
        sql: rollbackSql 
      })

      if (error) {
        throw error
      }

      // 履歴から削除
      await supabase
        .from(this.migrationsTable)
        .delete()
        .eq('version', migration.version)

      logger.info('Migration rolled back successfully', {
        version: migration.version
      })
    } catch (error) {
      logger.error('Rollback failed', {
        version: migration.version,
        error
      })
      throw error
    }
  }

  /**
   * マイグレーション状態の取得
   */
  async getStatus(): Promise<{
    current: string | null
    applied: MigrationHistory[]
    pending: string[]
  }> {
    const appliedSet = await this.getAppliedMigrations()
    const applied = await this.getAppliedMigrationDetails()
    const pending = await this.getPendingMigrations(appliedSet)

    return {
      current: applied.length > 0 ? applied[applied.length - 1].version : null,
      applied,
      pending: pending.map(m => m.version)
    }
  }

  /**
   * 実行済みマイグレーションの詳細取得
   */
  private async getAppliedMigrationDetails(): Promise<MigrationHistory[]> {
    const { data, error } = await supabase
      .from(this.migrationsTable)
      .select('*')
      .eq('success', true)
      .order('version', { ascending: true })

    if (error) {
      throw new Error(`Failed to get migration details: ${error.message}`)
    }

    return data || []
  }

  /**
   * データベースのバックアップ
   */
  async backup(name?: string): Promise<string> {
    const backupName = name || `backup_${Date.now()}`
    
    logger.info('Creating database backup', { name: backupName })

    // Supabaseのバックアップ機能を使用
    // 注: これは擬似コードで、実際のSupabase APIに応じて実装が必要
    const { data, error } = await (supabase as any).rpc('create_backup', {
      name: backupName
    })

    if (error) {
      throw new Error(`Backup failed: ${error.message}`)
    }

    logger.info('Backup created successfully', { 
      name: backupName,
      url: data?.url 
    })

    return data?.url || backupName
  }

  /**
   * データベースのリストア
   */
  async restore(backupId: string): Promise<void> {
    logger.info('Restoring database from backup', { backupId })

    // Supabaseのリストア機能を使用
    const { error } = await (supabase as any).rpc('restore_backup', {
      backup_id: backupId
    })

    if (error) {
      throw new Error(`Restore failed: ${error.message}`)
    }

    logger.info('Database restored successfully', { backupId })
  }
}

export const migrationManager = MigrationManager.getInstance()