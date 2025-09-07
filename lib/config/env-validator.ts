import { logger } from '@/lib/utils/logger'

interface EnvVariable {
  name: string
  required: boolean
  type: 'string' | 'number' | 'boolean' | 'url'
  defaultValue?: any
  validator?: (value: any) => boolean
  description?: string
}

export class EnvValidator {
  private static readonly ENV_SCHEMA: EnvVariable[] = [
    // Supabase
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      required: true,
      type: 'url',
      description: 'Supabase project URL'
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      required: true,
      type: 'string',
      description: 'Supabase anonymous key',
      validator: (v) => v.length > 30
    },
    
    // LINE
    {
      name: 'LINE_CHANNEL_ACCESS_TOKEN',
      required: true,
      type: 'string',
      description: 'LINE channel access token',
      validator: (v) => v.length > 20
    },
    {
      name: 'LINE_CHANNEL_SECRET',
      required: true,
      type: 'string',
      description: 'LINE channel secret',
      validator: (v) => v.length === 32
    },
    
    // Anthropic
    {
      name: 'ANTHROPIC_API_KEY',
      required: true,
      type: 'string',
      description: 'Anthropic API key',
      validator: (v) => v.startsWith('sk-ant-')
    },
    
    // Optional
    {
      name: 'NODE_ENV',
      required: false,
      type: 'string',
      defaultValue: 'development',
      validator: (v) => ['development', 'production', 'test'].includes(v)
    },
    {
      name: 'LOG_LEVEL',
      required: false,
      type: 'string',
      defaultValue: 'info',
      validator: (v) => ['debug', 'info', 'warn', 'error'].includes(v)
    },
    {
      name: 'MAX_QUEUE_SIZE',
      required: false,
      type: 'number',
      defaultValue: 100,
      validator: (v) => v > 0 && v <= 1000
    },
    {
      name: 'QUEUE_PROCESSING_INTERVAL',
      required: false,
      type: 'number',
      defaultValue: 60000,
      validator: (v) => v >= 1000 && v <= 600000
    }
  ]

  /**
   * 環境変数の検証
   */
  static validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    const config: Record<string, any> = {}

    for (const envVar of this.ENV_SCHEMA) {
      const value = process.env[envVar.name]

      // 必須チェック
      if (envVar.required && !value) {
        errors.push(`Missing required environment variable: ${envVar.name}`)
        continue
      }

      // デフォルト値の設定
      if (!value && envVar.defaultValue !== undefined) {
        process.env[envVar.name] = String(envVar.defaultValue)
        config[envVar.name] = envVar.defaultValue
        continue
      }

      if (!value) continue

      // 型チェック
      let parsedValue: any = value
      try {
        switch (envVar.type) {
          case 'number':
            parsedValue = Number(value)
            if (isNaN(parsedValue)) {
              errors.push(`${envVar.name} must be a number`)
              continue
            }
            break
          case 'boolean':
            parsedValue = value.toLowerCase() === 'true'
            break
          case 'url':
            new URL(value) // URLとして妥当かチェック
            break
        }
      } catch (error) {
        errors.push(`${envVar.name} has invalid format: ${error}`)
        continue
      }

      // カスタムバリデーション
      if (envVar.validator && !envVar.validator(parsedValue)) {
        errors.push(`${envVar.name} failed validation: ${envVar.description || 'invalid value'}`)
        continue
      }

      config[envVar.name] = parsedValue
    }

    // 追加の整合性チェック
    this.validateConsistency(config, errors, warnings)

    // 結果をログ出力
    if (errors.length > 0) {
      logger.error('Environment validation failed', { errors })
    } else if (warnings.length > 0) {
      logger.warn('Environment validation warnings', { warnings })
    } else {
      logger.info('Environment validation successful')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 環境変数間の整合性チェック
   */
  private static validateConsistency(
    config: Record<string, any>,
    errors: string[],
    warnings: string[]
  ): void {
    // 本番環境の警告
    if (config.NODE_ENV === 'production') {
      if (config.LOG_LEVEL === 'debug') {
        warnings.push('Debug logging is enabled in production')
      }
    }

    // Supabase URLの形式チェック
    if (config.NEXT_PUBLIC_SUPABASE_URL) {
      const url = config.NEXT_PUBLIC_SUPABASE_URL
      if (!url.includes('.supabase.co')) {
        warnings.push('Supabase URL does not match expected pattern')
      }
    }
  }

  /**
   * 起動時の環境チェック（致命的エラーで終了）
   */
  static validateOrExit(): void {
    const { valid, errors } = this.validate()
    
    if (!valid) {
      logger.critical('Environment validation failed:', { errors })
      
      if (process.env.NODE_ENV === 'production') {
        process.exit(1)
      }
    }
  }

  /**
   * 環境変数の一覧を取得（マスク付き）
   */
  static getConfig(): Record<string, any> {
    const config: Record<string, any> = {}
    
    for (const envVar of this.ENV_SCHEMA) {
      const value = process.env[envVar.name]
      if (value) {
        // センシティブな値はマスク
        if (envVar.name.includes('KEY') || envVar.name.includes('SECRET') || envVar.name.includes('TOKEN')) {
          config[envVar.name] = value.substring(0, 4) + '****'
        } else {
          config[envVar.name] = value
        }
      }
    }
    
    return config
  }
}