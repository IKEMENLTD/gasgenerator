import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Public client (for read-only operations with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Re-export supabaseAdmin from admin.ts for backward compatibility
// NOTE: supabaseAdmin should only be used in server-side contexts
export { supabaseAdmin } from './admin'



export async function getTrackingLinkByCode(code: string) {
  const { data, error } = await supabase
    .from('tracking_links')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching tracking link:', error)
    return null
  }

  return data
}

export async function getTrackingLinkByCampaign(campaign: string) {
  const { data, error } = await supabase
    .from('tracking_links')
    .select('*')
    .eq('campaign_name', campaign)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching tracking link by campaign:', error)
    return null
  }

  return data
}

export async function createTrackingSession(
  trackingLinkId: string,
  authToken: string,
  ipAddress: string,
  userAgent: string,
  referer: string | null,
  isBot: boolean
) {
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + 10)

  const { data, error } = await supabase
    .from('tracking_sessions')
    .insert({
      tracking_link_id: trackingLinkId,
      auth_token: authToken,
      ip_address: ipAddress,
      user_agent: userAgent,
      referer: referer,
      expires_at: expiresAt.toISOString(),
      is_bot: isBot
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating tracking session:', error)
    return null
  }

  return data
}

export async function getSessionByToken(token: string) {
  const { data, error } = await supabase
    .from('tracking_sessions')
    .select(`
      *,
      tracking_links (*)
    `)
    .eq('auth_token', token)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (error) {
    console.error('Error fetching session by token:', error)
    return null
  }

  return data
}

export async function updateSessionWithLineUser(sessionId: string, lineUserId: string) {
  const { error } = await supabase
    .from('tracking_sessions')
    .update({
      line_user_id: lineUserId,
      friend_added_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error updating session with LINE user:', error)
    return false
  }

  return true
}

export async function incrementClickCount(trackingLinkId: string) {
  const { error } = await supabase.rpc('increment_click_count', {
    link_id: trackingLinkId
  })

  if (error) {
    console.error('Error incrementing click count:', error)
  }
}

export async function incrementFriendCount(trackingLinkId: string) {
  const { error } = await supabase.rpc('increment_friend_count', {
    link_id: trackingLinkId
  })

  if (error) {
    console.error('Error incrementing friend count:', error)
  }
}

export async function createOrUpdateUserState(
  lineUserId: string,
  displayName: string | null,
  pictureUrl: string | null,
  statusMessage: string | null,
  language: string | null,
  state: any
) {
  const { error } = await supabase
    .from('user_states')
    .upsert({
      line_user_id: lineUserId,
      display_name: displayName,
      picture_url: pictureUrl,
      status_message: statusMessage,
      language: language,
      state: state,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'line_user_id'
    })

  if (error) {
    console.error('Error creating/updating user state:', error)
    return false
  }

  return true
}

export async function getAllTrackingLinks() {
  const { data, error } = await supabase
    .from('tracking_links')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tracking links:', error)
    return []
  }

  return data
}

export async function createTrackingLink(
  code: string,
  source: string,
  campaignName: string,
  createdBy: string
) {
  const { data, error } = await supabase
    .from('tracking_links')
    .insert({
      code: code,
      source: source,
      campaign_name: campaignName,
      created_by: createdBy
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating tracking link:', error)
    return null
  }

  return data
}

export async function updateTrackingLink(
  id: string,
  updates: {
    source?: string
    campaign_name?: string
    is_active?: boolean
  }
) {
  const { data, error } = await supabase
    .from('tracking_links')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating tracking link:', error)
    return null
  }

  return data
}

export async function getTrackingSessions(trackingLinkId?: string) {
  let query = supabase
    .from('tracking_sessions')
    .select(`
      *,
      tracking_links (*)
    `)
    .order('created_at', { ascending: false })

  if (trackingLinkId) {
    query = query.eq('tracking_link_id', trackingLinkId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching tracking sessions:', error)
    return []
  }

  return data
}