import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Run every hour
export const handler = schedule('0 * * * *', async (event) => {
  console.log('Starting session cleanup...')

  try {
    // Delete expired sessions (older than 10 minutes without conversion)
    const tenMinutesAgo = new Date()
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10)

    const { data: expiredSessions, error: selectError } = await supabase
      .from('tracking_sessions')
      .select('id')
      .lt('expires_at', tenMinutesAgo.toISOString())
      .is('line_user_id', null)

    if (selectError) {
      console.error('Error fetching expired sessions:', selectError)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch expired sessions' })
      }
    }

    if (expiredSessions && expiredSessions.length > 0) {
      const { error: deleteError } = await supabase
        .from('tracking_sessions')
        .delete()
        .in('id', expiredSessions.map(s => s.id))

      if (deleteError) {
        console.error('Error deleting expired sessions:', deleteError)
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to delete expired sessions' })
        }
      }

      console.log(`Deleted ${expiredSessions.length} expired sessions`)
    } else {
      console.log('No expired sessions to delete')
    }

    // Clean up old completed sessions (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: oldSessions, error: oldSelectError } = await supabase
      .from('tracking_sessions')
      .select('id')
      .lt('created_at', thirtyDaysAgo.toISOString())

    if (oldSelectError) {
      console.error('Error fetching old sessions:', oldSelectError)
    } else if (oldSessions && oldSessions.length > 0) {
      const { error: oldDeleteError } = await supabase
        .from('tracking_sessions')
        .delete()
        .in('id', oldSessions.map(s => s.id))

      if (oldDeleteError) {
        console.error('Error deleting old sessions:', oldDeleteError)
      } else {
        console.log(`Deleted ${oldSessions.length} old sessions`)
      }
    }

    // Update statistics summary table (if exists)
    const { error: statsError } = await supabase.rpc('update_tracking_statistics')

    if (statsError && !statsError.message.includes('does not exist')) {
      console.error('Error updating statistics:', statsError)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Session cleanup completed',
        expiredDeleted: expiredSessions?.length || 0,
        oldDeleted: oldSessions?.length || 0,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error: any) {
    console.error('Cleanup error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Cleanup failed',
        message: error.message
      })
    }
  }
})