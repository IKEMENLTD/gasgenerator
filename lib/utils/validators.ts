import { z } from 'zod'

// LINE Webhook Event validation
export const LineWebhookEventSchema = z.object({
  destination: z.string(),
  events: z.array(z.union([
    // メッセージイベント（テキスト）
    z.object({
      type: z.literal('message'),
      message: z.object({
        type: z.literal('text'),
        text: z.string().min(1).max(2000)
      }),
      source: z.object({
        userId: z.string().regex(/^U[0-9a-fA-F]{32}$/, 'Invalid LINE User ID format')
      }),
      replyToken: z.string(),
      timestamp: z.number()
    }),
    // メッセージイベント（画像）
    z.object({
      type: z.literal('message'),
      message: z.object({
        type: z.literal('image'),
        id: z.string()
      }),
      source: z.object({
        userId: z.string().regex(/^U[0-9a-fA-F]{32}$/, 'Invalid LINE User ID format')
      }),
      replyToken: z.string(),
      timestamp: z.number()
    }),
    // メッセージイベント（ファイル）
    z.object({
      type: z.literal('message'),
      message: z.object({
        type: z.literal('file'),
        id: z.string(),
        fileName: z.string().optional()
      }),
      source: z.object({
        userId: z.string().regex(/^U[0-9a-fA-F]{32}$/, 'Invalid LINE User ID format')
      }),
      replyToken: z.string(),
      timestamp: z.number()
    }),
    // フォローイベント
    z.object({
      type: z.literal('follow'),
      source: z.object({
        userId: z.string().regex(/^U[0-9a-fA-F]{32}$/, 'Invalid LINE User ID format')
      }),
      replyToken: z.string(),
      timestamp: z.number()
    }),
    // アンフォローイベント
    z.object({
      type: z.literal('unfollow'),
      source: z.object({
        userId: z.string().regex(/^U[0-9a-fA-F]{32}$/, 'Invalid LINE User ID format')
      }),
      timestamp: z.number()
    }),
    // その他のイベント（無視する）
    z.object({
      type: z.string(),
      source: z.object({
        userId: z.string().optional()
      }).optional(),
      timestamp: z.number().optional()
    })
  ]))
})

// セッション更新リクエスト
export const SessionUpdateSchema = z.object({
  currentStep: z.number().int().min(1).max(3),
  requirements: z.record(z.any()),
  status: z.enum(['active', 'ready_for_generation', 'completed'] as any)
})

// コード生成要求
export const CodeGenerationRequestSchema = z.object({
  userId: z.string().uuid(),
  lineUserId: z.string(),
  sessionId: z.string().uuid(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  requirements: z.object({
    details: z.string().min(10).max(1000, 'Details must be between 10-1000 characters')
  }).and(z.record(z.any()))
})

// 環境変数検証
export const EnvironmentSchema = z.object({
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(8),
  NODE_ENV: z.enum(['development', 'production', 'test'] as any).default('development')
})

// Claude API レスポンス検証
export const ClaudeResponseSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  })),
  model: z.string(),
  stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence'] as any),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number()
  })
})

// 生成されたコードの検証
export const GeneratedCodeSchema = z.object({
  code: z.string().min(10, 'Code must be at least 10 characters'),
  explanation: z.string().min(10).max(500, 'Explanation must be 10-500 characters'),
  steps: z.array(z.string()).min(1).max(10, 'Steps must be 1-10 items')
})

// ユーザー入力テキストのサニタイゼーション
export function sanitizeUserInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // HTMLタグを除去
    .replace(/javascript:/gi, '') // JavaScriptプロトコル除去
    .substring(0, 2000) // 長さ制限
}

// LINE User ID形式検証
export function isValidLineUserId(userId: string): boolean {
  return /^U[0-9a-fA-F]{32}$/.test(userId)
}

// カテゴリ名検証
export function isValidCategory(category: string): boolean {
  const validCategories = ['spreadsheet', 'gmail', 'calendar', 'api', 'custom']
  return validCategories.includes(category)
}

// 環境変数検証関数
export function validateEnvironment(): void {
  try {
    EnvironmentSchema.parse(process.env)
  } catch (error) {
    console.error('Environment validation failed:', error)
    throw new Error('Invalid environment configuration')
  }
}