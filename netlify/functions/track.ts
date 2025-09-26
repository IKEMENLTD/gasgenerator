import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const LINE_FRIEND_URL = process.env.LINE_FRIEND_URL || 'https://lin.ee/taskmate'

function isBot(userAgent: string): boolean {
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'facebookexternalhit',
    'Twitterbot', 'LinkedInBot', 'WhatsApp', 'Slack', 'Telegram',
    'Discordbot', 'PingdomBot', 'StatusCake', 'UptimeRobot'
  ]

  const ua = userAgent.toLowerCase()
  return botPatterns.some(pattern => ua.includes(pattern.toLowerCase()))
}

import * as crypto from 'crypto'

function generateAuthToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.randomBytes(6)
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars[bytes[i] % chars.length]
  }
  return token
}

function getClientIP(event: any): string {
  return event.headers['x-forwarded-for']?.split(',')[0].trim() ||
         event.headers['x-real-ip'] ||
         '0.0.0.0'
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  const code = event.queryStringParameters?.code
  const campaign = event.queryStringParameters?.campaign

  if (!code && !campaign) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing code or campaign parameter' })
    }
  }

  try {
    let trackingLink = null

    if (code) {
      const { data, error } = await supabase
        .from('tracking_links')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Tracking link not found' })
        }
      }

      trackingLink = data
    } else if (campaign) {
      const { data, error } = await supabase
        .from('tracking_links')
        .select('*')
        .eq('campaign_name', campaign)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Campaign not found' })
        }
      }

      trackingLink = data
    }

    const userAgent = event.headers['user-agent'] || ''
    const referer = event.headers['referer'] || null
    const ipAddress = getClientIP(event)
    const botDetected = isBot(userAgent)

    await supabase.rpc('increment_click_count', {
      link_id: trackingLink.id
    })

    const authToken = generateAuthToken()
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    const { data: sessionData, error: sessionError } = await supabase
      .from('tracking_sessions')
      .insert({
        tracking_link_id: trackingLink.id,
        auth_token: authToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        referer: referer,
        expires_at: expiresAt.toISOString(),
        is_bot: botDetected
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return {
        statusCode: 302,
        headers: {
          Location: LINE_FRIEND_URL
        },
        body: ''
      }
    }

    if (botDetected) {
      return {
        statusCode: 302,
        headers: {
          Location: LINE_FRIEND_URL
        },
        body: ''
      }
    }

    return {
      statusCode: 302,
      headers: {
        Location: `/auth?token=${authToken}`
      },
      body: ''
    }
  } catch (error) {
    console.error('Error in tracking function:', error)

    return {
      statusCode: 302,
      headers: {
        Location: LINE_FRIEND_URL
      },
      body: ''
    }
  }
}