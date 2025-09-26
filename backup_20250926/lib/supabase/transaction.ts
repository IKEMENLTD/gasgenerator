import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function handleTokenWithTransaction(
  sessionId: string,
  lineUserId: string,
  trackingLinkId: string,
  profile: any
) {
  try {
    const { error } = await supabase.rpc('process_token_verification', {
      p_session_id: sessionId,
      p_line_user_id: lineUserId,
      p_tracking_link_id: trackingLinkId,
      p_display_name: profile?.displayName || null,
      p_picture_url: profile?.pictureUrl || null,
      p_status_message: profile?.statusMessage || null,
      p_language: profile?.language || 'ja'
    })

    if (error) {
      console.error('Transaction failed:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Transaction error:', error)
    return false
  }
}