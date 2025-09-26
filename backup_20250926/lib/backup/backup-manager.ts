import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import { AppError } from '@/lib/errors/app-error'
import fs from 'fs/promises'
import path from 'path'
import { SecureRandom } from '@/lib/utils/secure-random'
import { createWriteStream, createReadStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import zlib from 'zlib'

interface BackupMetadata {
  id: string
  name: string
  type: 'full' | 'incremental' | 'differential'
  timestamp: string
  size: number
  checksum: string
  tables: string[]
  recordCount: number
  compressed: boolean
  encrypted: boolean
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
}

interface RestoreOptions {
  targetDatabase?: string
  tables?: string[]
  overwrite?: boolean
  validateChecksum?: boolean
}

export class BackupManager {
  private static instance: BackupManager | null = null
  private readonly backupPath = path.join(process.cwd(), 'backups')
  private readonly maxBackups = 30
  private isBackupInProgress = false

  private constructor() {
    this.ensureBackupDirectory()
  }

  static getInstance(): BackupManager {
    if (!this.instance) {
      this.instance = new BackupManager()
    }
    return this.instance
  }

  /**
   * バックアップディレクトリの確保
   */
  private async ensureBackupDirectory(): Promise<void> {
    if (typeof window !== 'undefined') return // ブラウザ環境では実行しない

    try {
      await fs.mkdir(this.backupPath, { recursive: true })
    } catch (error) {
      logger.error('Failed to create backup directory', { error })
    }
  }

  /**
   * フルバックアップの作成
   */
  async createFullBackup(name?: string): Promise<BackupMetadata> {
    if (this.isBackupInProgress) {
      throw AppError.conflict('Backup already in progress')
    }

    this.isBackupInProgress = true
    const backupId = this.generateBackupId()
    const backupName = name || `backup_${Date.now()}`
    
    logger.info('Starting full backup', { backupId, name: backupName })

    const metadata: BackupMetadata = {
      id: backupId,
      name: backupName,
      type: 'full',
      timestamp: new Date().toISOString(),
      size: 0,
      checksum: '',
      tables: [],
      recordCount: 0,
      compressed: true,
      encrypted: false,
      status: 'in_progress'
    }

    try {
      // バックアップメタデータを保存
      await this.saveMetadata(metadata)

      // テーブル一覧の取得
      const tables = await this.getTables()
      metadata.tables = tables

      // 各テーブルのデータをエクスポート
      const backupData: Record<string, any[]> = {}
      let totalRecords = 0

      for (const table of tables) {
        const data = await this.exportTable(table)
        backupData[table] = data
        totalRecords += data.length
        
        logger.debug('Table exported', { 
          table, 
          records: data.length 
        })
      }

      metadata.recordCount = totalRecords

      // データの保存
      const filePath = await this.saveBackupData(backupId, backupData)
      
      // ファイルサイズとチェックサムの計算
      const stats = await fs.stat(filePath)
      metadata.size = stats.size
      metadata.checksum = await this.calculateChecksum(filePath)
      metadata.status = 'completed'

      // メタデータの更新
      await this.saveMetadata(metadata)

      // 古いバックアップのクリーンアップ
      await this.cleanupOldBackups()

      logger.info('Full backup completed', {
        backupId,
        size: metadata.size,
        records: metadata.recordCount
      })

      return metadata
    } catch (error) {
      metadata.status = 'failed'
      metadata.error = error instanceof Error ? error.message : String(error)
      await this.saveMetadata(metadata)
      
      logger.error('Backup failed', { backupId, error })
      throw AppError.internal('Backup failed')
    } finally {
      this.isBackupInProgress = false
    }
  }

  /**
   * 増分バックアップの作成
   */
  async createIncrementalBackup(
    lastBackupId: string,
    name?: string
  ): Promise<BackupMetadata> {
    const lastBackup = await this.getBackupMetadata(lastBackupId)
    if (!lastBackup) {
      throw AppError.notFound('Last backup not found')
    }

    const backupId = this.generateBackupId()
    const backupName = name || `incremental_${Date.now()}`
    
    logger.info('Starting incremental backup', { 
      backupId, 
      lastBackupId 
    })

    const metadata: BackupMetadata = {
      id: backupId,
      name: backupName,
      type: 'incremental',
      timestamp: new Date().toISOString(),
      size: 0,
      checksum: '',
      tables: lastBackup.tables,
      recordCount: 0,
      compressed: true,
      encrypted: false,
      status: 'in_progress'
    }

    try {
      const backupData: Record<string, any[]> = {}
      let totalRecords = 0

      // 最後のバックアップ以降の変更を取得
      for (const table of metadata.tables) {
        const changes = await this.getTableChanges(
          table,
          new Date(lastBackup.timestamp)
        )
        
        if (changes.length > 0) {
          backupData[table] = changes
          totalRecords += changes.length
        }
      }

      metadata.recordCount = totalRecords

      // データの保存
      const filePath = await this.saveBackupData(backupId, backupData)
      
      const stats = await fs.stat(filePath)
      metadata.size = stats.size
      metadata.checksum = await this.calculateChecksum(filePath)
      metadata.status = 'completed'

      await this.saveMetadata(metadata)

      logger.info('Incremental backup completed', {
        backupId,
        changes: totalRecords
      })

      return metadata
    } catch (error) {
      metadata.status = 'failed'
      metadata.error = error instanceof Error ? error.message : String(error)
      await this.saveMetadata(metadata)
      throw error
    }
  }

  /**
   * バックアップからのリストア
   */
  async restore(
    backupId: string,
    options: RestoreOptions = {}
  ): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId)
    if (!metadata) {
      throw AppError.notFound('Backup not found')
    }

    logger.info('Starting restore', { 
      backupId, 
      options 
    })

    try {
      // チェックサムの検証
      if (options.validateChecksum !== false) {
        await this.validateBackup(backupId)
      }

      // バックアップデータの読み込み
      const backupData = await this.loadBackupData(backupId)

      // リストア対象テーブルの決定
      const tablesToRestore = options.tables || metadata.tables

      // 各テーブルのリストア
      for (const table of tablesToRestore) {
        if (!backupData[table]) continue

        if (options.overwrite) {
          // 既存データを削除
          await this.truncateTable(table)
        }

        // データのインポート
        await this.importTable(table, backupData[table])
        
        logger.debug('Table restored', { 
          table, 
          records: backupData[table].length 
        })
      }

      logger.info('Restore completed', { backupId })
    } catch (error) {
      logger.error('Restore failed', { backupId, error })
      throw AppError.internal('Restore failed')
    }
  }

  /**
   * テーブル一覧の取得
   */
  private async getTables(): Promise<string[]> {
    const { data, error } = await (supabase as any).rpc('get_tables')
    
    if (error) {
      throw new Error(`Failed to get tables: ${error.message}`)
    }

    return data || []
  }

  /**
   * テーブルデータのエクスポート
   */
  private async exportTable(table: string): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from(table)
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to export table ${table}: ${error.message}`)
    }

    return data || []
  }

  /**
   * テーブルの変更データ取得
   */
  private async getTableChanges(
    table: string,
    since: Date
  ): Promise<any[]> {
    const { data, error } = await (supabase as any)
      .from(table)
      .select('*')
      .gte('updated_at', since.toISOString())
      .order('updated_at', { ascending: true })

    if (error) {
      logger.warn('Failed to get table changes', { table, error })
      return []
    }

    return data || []
  }

  /**
   * テーブルデータのインポート
   */
  private async importTable(table: string, data: any[]): Promise<void> {
    if (data.length === 0) return

    // バッチ処理
    const batchSize = 100
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      
      const { error } = await (supabase as any)
        .from(table)
        .upsert(batch, { onConflict: 'id' })

      if (error) {
        throw new Error(`Failed to import table ${table}: ${error.message}`)
      }
    }
  }

  /**
   * テーブルのトランケート
   */
  private async truncateTable(table: string): Promise<void> {
    const { error } = await (supabase as any).rpc('truncate_table', { 
      table_name: table 
    })
    
    if (error) {
      throw new Error(`Failed to truncate table ${table}: ${error.message}`)
    }
  }

  /**
   * バックアップデータの保存
   */
  private async saveBackupData(
    backupId: string,
    data: Record<string, any[]>
  ): Promise<string> {
    const filename = `${backupId}.json.gz`
    const filePath = path.join(this.backupPath, filename)
    
    // JSONに変換
    const jsonData = JSON.stringify(data, null, 2)
    
    // 圧縮して保存
    const gzip = zlib.createGzip()
    const writeStream = createWriteStream(filePath)
    
    // Buffer -> Gzip -> File
    const readable = Readable.from([jsonData])
    await pipeline(
      readable,
      gzip,
      writeStream
    )

    return filePath
  }

  /**
   * バックアップデータの読み込み
   */
  private async loadBackupData(
    backupId: string
  ): Promise<Record<string, any[]>> {
    const filename = `${backupId}.json.gz`
    const filePath = path.join(this.backupPath, filename)
    
    // 圧縮ファイルを読み込み
    const gunzip = zlib.createGunzip()
    const chunks: Buffer[] = []
    
    await pipeline(
      createReadStream(filePath),
      gunzip,
      async function* (source) {
        for await (const chunk of source) {
          chunks.push(chunk)
        }
      }
    )
    
    const jsonData = Buffer.concat(chunks as any[]).toString()
    return JSON.parse(jsonData)
  }

  /**
   * メタデータの保存
   */
  private async saveMetadata(metadata: BackupMetadata): Promise<void> {
    const filename = `${metadata.id}.meta.json`
    const filePath = path.join(this.backupPath, filename)
    
    await fs.writeFile(
      filePath,
      JSON.stringify(metadata, null, 2)
    )
  }

  /**
   * バックアップメタデータの取得
   */
  private async getBackupMetadata(
    backupId: string
  ): Promise<BackupMetadata | null> {
    try {
      const filename = `${backupId}.meta.json`
      const filePath = path.join(this.backupPath, filename)
      
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return null
    }
  }

  /**
   * バックアップの検証
   */
  private async validateBackup(backupId: string): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId)
    if (!metadata) {
      throw new Error('Backup metadata not found')
    }

    const filename = `${backupId}.json.gz`
    const filePath = path.join(this.backupPath, filename)
    
    const checksum = await this.calculateChecksum(filePath)
    
    if (checksum !== metadata.checksum) {
      throw new Error('Backup checksum validation failed')
    }
  }

  /**
   * チェックサムの計算
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath)
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer as any)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * バックアップIDの生成
   */
  private generateBackupId(): string {
    const timestamp = Date.now().toString(36)
    const random = SecureRandom.generateString(9)
    return `backup_${timestamp}_${random}`
  }

  /**
   * 古いバックアップのクリーンアップ
   */
  private async cleanupOldBackups(): Promise<void> {
    const files = await fs.readdir(this.backupPath)
    const metaFiles = files.filter(f => f.endsWith('.meta.json'))
    
    if (metaFiles.length <= this.maxBackups) return

    // メタデータを読み込んでソート
    const backups: BackupMetadata[] = []
    for (const file of metaFiles) {
      const content = await fs.readFile(
        path.join(this.backupPath, file),
        'utf-8'
      )
      backups.push(JSON.parse(content))
    }

    backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // 古いバックアップを削除
    const toDelete = backups.slice(this.maxBackups)
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id)
    }

    logger.info('Old backups cleaned up', { 
      deleted: toDelete.length 
    })
  }

  /**
   * バックアップの削除
   */
  private async deleteBackup(backupId: string): Promise<void> {
    const files = [
      `${backupId}.json.gz`,
      `${backupId}.meta.json`
    ]

    for (const file of files) {
      try {
        await fs.unlink(path.join(this.backupPath, file))
      } catch (error) {
        // ファイルが存在しない場合は無視
      }
    }
  }

  /**
   * バックアップ一覧の取得
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const files = await fs.readdir(this.backupPath)
    const metaFiles = files.filter(f => f.endsWith('.meta.json'))
    
    const backups: BackupMetadata[] = []
    for (const file of metaFiles) {
      const content = await fs.readFile(
        path.join(this.backupPath, file),
        'utf-8'
      )
      backups.push(JSON.parse(content))
    }

    return backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }
}

export const backupManager = BackupManager.getInstance()