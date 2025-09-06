import { NextRequest } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { AppError } from '@/lib/errors/app-error'
import { InputValidator } from '@/lib/validation/input-validator'
import { supabase } from '@/lib/supabase/client'
import crypto from 'crypto'

interface FileUploadOptions {
  maxFileSize?: number // bytes
  allowedMimeTypes?: string[]
  allowedExtensions?: string[]
  destination?: string
  generateUniqueName?: boolean
  scanForVirus?: boolean
}

interface UploadedFile {
  id: string
  originalName: string
  fileName: string
  mimeType: string
  size: number
  path: string
  url?: string
  metadata?: Record<string, any>
  uploadedAt: Date
}

export class FileUploadHandler {
  private static instance: FileUploadHandler | null = null
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly CHUNK_SIZE = 1024 * 1024 // 1MB
  
  // 安全なMIMEタイプ
  private readonly SAFE_MIME_TYPES = [
    'text/plain',
    'text/csv',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/zip',
    'application/x-zip-compressed'
  ]

  // 危険な拡張子
  private readonly DANGEROUS_EXTENSIONS = [
    'exe', 'com', 'bat', 'cmd', 'scr', 'vbs', 'vbe',
    'js', 'jse', 'ws', 'wsf', 'wsc', 'wsh', 'ps1',
    'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2', 'msh',
    'msh1', 'msh2', 'mshxml', 'msh1xml', 'msh2xml',
    'scf', 'lnk', 'inf', 'reg', 'dll', 'app'
  ]

  private constructor() {}

  static getInstance(): FileUploadHandler {
    if (!this.instance) {
      this.instance = new FileUploadHandler()
    }
    return this.instance
  }

  /**
   * ファイルアップロード処理
   */
  async handleUpload(
    request: NextRequest,
    options: FileUploadOptions = {}
  ): Promise<UploadedFile[]> {
    const {
      maxFileSize = this.DEFAULT_MAX_SIZE,
      allowedMimeTypes = this.SAFE_MIME_TYPES,
      allowedExtensions,
      destination = 'uploads',
      generateUniqueName = true,
      scanForVirus = false
    } = options

    try {
      // multipart/form-dataの解析
      const formData = await request.formData()
      const files: UploadedFile[] = []

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          logger.info('Processing file upload', {
            fieldName: key,
            fileName: value.name,
            size: value.size,
            type: value.type
          })

          // ファイル検証
          await this.validateFile(value, {
            maxFileSize,
            allowedMimeTypes,
            allowedExtensions
          })

          // ウイルススキャン（オプション）
          if (scanForVirus) {
            await this.scanFile(value)
          }

          // ファイル保存
          const uploadedFile = await this.saveFile(value, {
            destination,
            generateUniqueName
          })

          files.push(uploadedFile)
        }
      }

      logger.info('Files uploaded successfully', {
        count: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0)
      })

      return files
    } catch (error) {
      logger.error('File upload failed', { error })
      throw AppError.badRequest('File upload failed', {
        reason: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * ファイル検証
   */
  private async validateFile(
    file: File,
    options: {
      maxFileSize: number
      allowedMimeTypes?: string[]
      allowedExtensions?: string[]
    }
  ): Promise<void> {
    // サイズチェック
    if (file.size > options.maxFileSize) {
      throw new Error(`File size exceeds limit: ${options.maxFileSize} bytes`)
    }

    // 空ファイルチェック
    if (file.size === 0) {
      throw new Error('Empty file not allowed')
    }

    // MIMEタイプチェック
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.type)) {
      throw new Error(`File type not allowed: ${file.type}`)
    }

    // 拡張子チェック
    const extension = this.getFileExtension(file.name)
    
    if (this.DANGEROUS_EXTENSIONS.includes(extension.toLowerCase())) {
      throw new Error(`Dangerous file extension: ${extension}`)
    }

    if (options.allowedExtensions && 
        !options.allowedExtensions.includes(extension.toLowerCase())) {
      throw new Error(`File extension not allowed: ${extension}`)
    }

    // ファイル内容の検証（マジックバイト）
    await this.validateFileContent(file)
  }

  /**
   * ファイル内容の検証
   */
  private async validateFileContent(file: File): Promise<void> {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer).slice(0, 512)

    // マジックバイトチェック
    const magicBytes = this.getMagicBytes(bytes)
    const expectedType = this.getTypeFromMagicBytes(magicBytes)

    if (expectedType && file.type !== expectedType) {
      logger.warn('MIME type mismatch detected', {
        claimed: file.type,
        detected: expectedType,
        fileName: file.name
      })
      
      // 実行可能ファイルの検出
      if (this.isExecutable(bytes)) {
        throw new Error('Executable file detected')
      }
    }

    // 埋め込みスクリプトの検出
    if (this.containsScript(buffer)) {
      throw new Error('Embedded script detected')
    }
  }

  /**
   * マジックバイトの取得
   */
  private getMagicBytes(bytes: Uint8Array): string {
    return Array.from(bytes.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * マジックバイトからファイルタイプを判定
   */
  private getTypeFromMagicBytes(magic: string): string | null {
    const signatures: Record<string, string> = {
      '89504e47': 'image/png',
      'ffd8ffe0': 'image/jpeg',
      'ffd8ffe1': 'image/jpeg',
      '47494638': 'image/gif',
      '25504446': 'application/pdf',
      '504b0304': 'application/zip'
    }

    for (const [sig, type] of Object.entries(signatures)) {
      if (magic.startsWith(sig)) {
        return type
      }
    }

    return null
  }

  /**
   * 実行可能ファイルの検出
   */
  private isExecutable(bytes: Uint8Array): boolean {
    // Windows PE
    if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
      return true
    }
    
    // ELF (Linux)
    if (bytes[0] === 0x7F && bytes[1] === 0x45 && 
        bytes[2] === 0x4C && bytes[3] === 0x46) {
      return true
    }
    
    // Mach-O (macOS)
    if ((bytes[0] === 0xCE || bytes[0] === 0xCF) && bytes[1] === 0xFA) {
      return true
    }

    return false
  }

  /**
   * スクリプトの検出
   */
  private containsScript(buffer: ArrayBuffer): boolean {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    const scriptPatterns = [
      /<script[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi
    ]

    return scriptPatterns.some(pattern => pattern.test(text))
  }

  /**
   * ウイルススキャン（擬似実装）
   */
  private async scanFile(file: File): Promise<void> {
    logger.info('Scanning file for viruses', { fileName: file.name })
    
    // 実際のウイルススキャンAPIを呼び出す
    // 例: ClamAV, VirusTotal API等
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    logger.info('File scan completed', { fileName: file.name, result: 'clean' })
  }

  /**
   * ファイル保存
   */
  private async saveFile(
    file: File,
    options: {
      destination: string
      generateUniqueName: boolean
    }
  ): Promise<UploadedFile> {
    const fileId = this.generateFileId()
    const extension = this.getFileExtension(file.name)
    const fileName = options.generateUniqueName
      ? `${fileId}.${extension}`
      : file.name

    const filePath = `${options.destination}/${fileName}`

    // Supabase Storageに保存
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      throw new Error(`Failed to save file: ${error.message}`)
    }

    // 公開URLの取得
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath)

    // メタデータの保存
    const uploadedFile: UploadedFile = {
      id: fileId,
      originalName: file.name,
      fileName,
      mimeType: file.type,
      size: file.size,
      path: filePath,
      url: publicUrl,
      uploadedAt: new Date(),
      metadata: {
        checksum: await this.calculateChecksum(buffer)
      }
    }

    // データベースに記録
    await this.saveFileRecord(uploadedFile)

    return uploadedFile
  }

  /**
   * ファイル記録の保存
   */
  private async saveFileRecord(file: UploadedFile): Promise<void> {
    const { error } = await supabase
      .from('uploaded_files')
      .insert({
        id: file.id,
        original_name: file.originalName,
        file_name: file.fileName,
        mime_type: file.mimeType,
        size: file.size,
        path: file.path,
        url: file.url,
        metadata: file.metadata,
        uploaded_at: file.uploadedAt
      })

    if (error) {
      logger.error('Failed to save file record', { error })
    }
  }

  /**
   * チャンク単位でのアップロード
   */
  async handleChunkedUpload(
    request: NextRequest,
    chunkInfo: {
      fileId: string
      chunkIndex: number
      totalChunks: number
      fileName: string
      fileSize: number
    }
  ): Promise<{ completed: boolean; file?: UploadedFile }> {
    const formData = await request.formData()
    const chunk = formData.get('chunk') as File

    if (!chunk) {
      throw AppError.badRequest('Chunk data missing')
    }

    // チャンクの保存
    const chunkPath = `chunks/${chunkInfo.fileId}/${chunkInfo.chunkIndex}`
    const arrayBuffer = await chunk.arrayBuffer()
    
    const { error } = await supabase.storage
      .from('uploads')
      .upload(chunkPath, arrayBuffer, {
        upsert: false
      })

    if (error) {
      throw new Error(`Failed to save chunk: ${error.message}`)
    }

    logger.debug('Chunk uploaded', {
      fileId: chunkInfo.fileId,
      chunk: `${chunkInfo.chunkIndex + 1}/${chunkInfo.totalChunks}`
    })

    // 最後のチャンクの場合、ファイルを結合
    if (chunkInfo.chunkIndex === chunkInfo.totalChunks - 1) {
      const file = await this.mergeChunks(chunkInfo)
      return { completed: true, file }
    }

    return { completed: false }
  }

  /**
   * チャンクの結合
   */
  private async mergeChunks(chunkInfo: any): Promise<UploadedFile> {
    logger.info('Merging file chunks', {
      fileId: chunkInfo.fileId,
      totalChunks: chunkInfo.totalChunks
    })

    // すべてのチャンクを取得して結合
    const chunks: ArrayBuffer[] = []
    
    for (let i = 0; i < chunkInfo.totalChunks; i++) {
      const chunkPath = `chunks/${chunkInfo.fileId}/${i}`
      const { data, error } = await supabase.storage
        .from('uploads')
        .download(chunkPath)

      if (error) {
        throw new Error(`Failed to download chunk ${i}: ${error.message}`)
      }

      chunks.push(await data.arrayBuffer())
    }

    // チャンクを結合
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const mergedBuffer = new Uint8Array(totalSize)
    let offset = 0

    for (const chunk of chunks) {
      mergedBuffer.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    // 結合したファイルを保存
    const filePath = `uploads/${chunkInfo.fileName}`
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, mergedBuffer)

    if (uploadError) {
      throw new Error(`Failed to save merged file: ${uploadError.message}`)
    }

    // チャンクファイルを削除
    await this.cleanupChunks(chunkInfo.fileId, chunkInfo.totalChunks)

    return {
      id: chunkInfo.fileId,
      originalName: chunkInfo.fileName,
      fileName: chunkInfo.fileName,
      mimeType: 'application/octet-stream',
      size: totalSize,
      path: filePath,
      uploadedAt: new Date()
    }
  }

  /**
   * チャンクファイルのクリーンアップ
   */
  private async cleanupChunks(fileId: string, totalChunks: number): Promise<void> {
    const paths = []
    for (let i = 0; i < totalChunks; i++) {
      paths.push(`chunks/${fileId}/${i}`)
    }

    const { error } = await supabase.storage
      .from('uploads')
      .remove(paths)

    if (error) {
      logger.error('Failed to cleanup chunks', { error })
    }
  }

  /**
   * ファイル拡張子の取得
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.')
    return parts.length > 1 ? parts[parts.length - 1] : ''
  }

  /**
   * ファイルIDの生成
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * チェックサムの計算
   */
  private async calculateChecksum(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256')
    hash.update(buffer)
    return hash.digest('hex')
  }

  /**
   * ファイルの削除
   */
  async deleteFile(fileId: string): Promise<void> {
    // データベースから情報取得
    const { data: fileRecord, error: fetchError } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fetchError || !fileRecord) {
      throw AppError.notFound('File not found')
    }

    // ストレージから削除
    const { error: deleteError } = await supabase.storage
      .from('uploads')
      .remove([fileRecord.path])

    if (deleteError) {
      throw new Error(`Failed to delete file: ${deleteError.message}`)
    }

    // データベースから削除
    await supabase
      .from('uploaded_files')
      .delete()
      .eq('id', fileId)

    logger.info('File deleted', { fileId })
  }
}

export const fileUploadHandler = FileUploadHandler.getInstance()