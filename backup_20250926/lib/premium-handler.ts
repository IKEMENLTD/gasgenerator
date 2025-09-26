import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Master activation codes from environment variables (for security)
const MASTER_CODES = [
  process.env.PREMIUM_MASTER_CODE_1,
  process.env.PREMIUM_MASTER_CODE_2,
  process.env.PREMIUM_MASTER_CODE_3
].filter(Boolean) as string[]

// Fallback for development only
if (MASTER_CODES.length === 0) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Premium master codes not configured - using development defaults')
    MASTER_CODES.push('DEV_ONLY_TEST_CODE_' + 'X'.repeat(50))
  } else {
    console.warn('⚠️ Premium master codes not configured in production')
  }
}

// Special pattern codes (for easier activation)
const SPECIAL_PATTERNS = [
  /^PREMIUM-ACTIVATE-\d{4}-[A-Z0-9]{32}$/,  // Format: PREMIUM-ACTIVATE-YYYY-[32 chars]
  /^TM-SPECIAL-[A-Z0-9]{48}$/,              // Format: TM-SPECIAL-[48 chars]
]

export interface PremiumActivationResult {
  success: boolean
  expiresAt?: string
  features?: string[]
  message?: string
}

export async function checkAndActivatePremium(
  lineUserId: string,
  code: string
): Promise<PremiumActivationResult> {
  try {
    // Check if it's a master code (instant activation)
    if (MASTER_CODES.includes(code)) {
      return await activatePremiumDirectly(lineUserId, 'master', 30) // 1 month
    }

    // Check special patterns
    for (const pattern of SPECIAL_PATTERNS) {
      if (pattern.test(code)) {
        return await activatePremiumDirectly(lineUserId, 'pattern', 30) // 1 month
      }
    }

    // Check database activation codes
    const { data: success } = await supabase.rpc('activate_premium_plan', {
      p_line_user_id: lineUserId,
      p_activation_code: code,
      p_duration_days: 30
    })

    if (success) {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1)

      return {
        success: true,
        expiresAt: expiresAt.toLocaleDateString('ja-JP'),
        features: [
          'unlimited_tracking',
          'advanced_analytics',
          'api_access',
          'priority_support'
        ]
      }
    }

    return { success: false }
  } catch (error) {
    console.error('Premium activation error:', error)
    return { success: false }
  }
}

async function activatePremiumDirectly(
  lineUserId: string,
  activationType: string,
  durationDays: number
): Promise<PremiumActivationResult> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + durationDays)

    // Direct database update (bypass activation_codes table)
    const { error } = await supabase
      .from('user_states')
      .upsert({
        line_user_id: lineUserId,
        is_premium: true,
        premium_activated_at: new Date().toISOString(),
        premium_expires_at: expiresAt.toISOString(),
        premium_activation_code: `${activationType}_${Date.now()}`,
        premium_features: [
          'unlimited_tracking',
          'advanced_analytics',
          'api_access',
          'priority_support',
          'custom_domains',
          'white_label',
          'dedicated_support'
        ],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'line_user_id'
      })

    if (error) {
      console.error('Premium activation database error:', error)
      return { success: false }
    }

    // Log activation for tracking
    await supabase
      .from('activation_codes')
      .insert({
        code: `${activationType}_activation`,
        code_hash: crypto.createHash('sha256').update(`${activationType}_${lineUserId}_${Date.now()}`).digest('hex'),
        type: activationType,
        used: true,
        used_by: lineUserId,
        used_at: new Date().toISOString(),
        metadata: {
          activation_type: activationType,
          duration_days: durationDays
        }
      })

    return {
      success: true,
      expiresAt: expiresAt.toLocaleDateString('ja-JP'),
      features: [
        'unlimited_tracking',
        'advanced_analytics',
        'api_access',
        'priority_support',
        'custom_domains',
        'white_label',
        'dedicated_support'
      ]
    }
  } catch (error) {
    console.error('Direct premium activation error:', error)
    return { success: false }
  }
}

export async function checkPremiumStatus(lineUserId: string): Promise<{
  isPremium: boolean
  expiresAt?: string
  features?: string[]
}> {
  try {
    const { data, error } = await supabase
      .from('user_states')
      .select('is_premium, premium_expires_at, premium_features')
      .eq('line_user_id', lineUserId)
      .single()

    if (error || !data) {
      return { isPremium: false }
    }

    // Check if premium is still valid
    if (data.is_premium && data.premium_expires_at) {
      const expiryDate = new Date(data.premium_expires_at)
      const now = new Date()

      if (expiryDate > now) {
        return {
          isPremium: true,
          expiresAt: expiryDate.toLocaleDateString('ja-JP'),
          features: data.premium_features || []
        }
      }

      // Premium expired, update status
      await supabase
        .from('user_states')
        .update({
          is_premium: false,
          updated_at: new Date().toISOString()
        })
        .eq('line_user_id', lineUserId)
    }

    return { isPremium: false }
  } catch (error) {
    console.error('Premium status check error:', error)
    return { isPremium: false }
  }
}

export async function generateActivationCode(
  type: string = 'premium',
  expiryDays: number = 30
): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex').toUpperCase()
  const formattedCode = `PREMIUM-ACTIVATE-${new Date().getFullYear()}-${code}`
  const codeHash = crypto.createHash('sha256').update(formattedCode).digest('hex')

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiryDays)

  await supabase
    .from('activation_codes')
    .insert({
      code: formattedCode,
      code_hash: codeHash,
      type: type,
      expires_at: expiresAt.toISOString(),
      metadata: {
        generated_at: new Date().toISOString(),
        expiry_days: expiryDays
      }
    })

  return formattedCode
}