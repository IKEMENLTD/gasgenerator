const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agency-Id',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Verify JWT token
    const authHeader = event.headers.authorization;
    const agencyId = event.headers['x-agency-id'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: '認証が必要です' })
        };
    }

    const token = authHeader.substring(7);

    try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

        if (!agencyId || decoded.agencyId !== agencyId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'アクセス権限がありません' })
            };
        }

        // Get link_id from query parameters
        const linkId = event.queryStringParameters?.link_id;

        if (!linkId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'link_id パラメータが必要です' })
            };
        }

        // Verify the link belongs to this agency
        const { data: link, error: linkError } = await supabase
            .from('agency_tracking_links')
            .select('id, agency_id')
            .eq('id', linkId)
            .eq('agency_id', agencyId)
            .single();

        if (linkError || !link) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'リンクが見つかりません' })
            };
        }

        // Get visits for this link (most recent 50)
        const { data: visits, error: visitsError } = await supabase
            .from('agency_tracking_visits')
            .select('*')
            .eq('tracking_link_id', linkId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (visitsError) {
            console.error('Error fetching visits:', visitsError);
            throw visitsError;
        }

        // Get unique LINE user IDs from visits
        const lineUserIds = [...new Set(
            (visits || [])
                .map(v => v.line_user_id)
                .filter(id => id != null)
        )];

        console.log(`[agency-link-visits] link_id=${linkId}, visits=${(visits||[]).length}, linked_users=${lineUserIds.length}`);

        // Fetch LINE user information from line_profiles
        let lineProfilesMap = {};
        if (lineUserIds.length > 0) {
            const { data: lineProfiles, error: lineProfilesError } = await supabase
                .from('line_profiles')
                .select('user_id, display_name')
                .in('user_id', lineUserIds);

            if (lineProfilesError) {
                console.error('[agency-link-visits] line_profiles query error:', lineProfilesError);
            }

            if (!lineProfilesError && lineProfiles && lineProfiles.length > 0) {
                lineProfilesMap = Object.fromEntries(
                    lineProfiles.map(profile => [profile.user_id, profile])
                );
                console.log(`[agency-link-visits] line_profiles matched: ${lineProfiles.length}/${lineUserIds.length}`);
            }

            // Fallback: if line_profiles returned nothing, try agency_conversions
            if (Object.keys(lineProfilesMap).length === 0) {
                console.log('[agency-link-visits] Fallback: checking agency_conversions for display names');
                const { data: conversions, error: convError } = await supabase
                    .from('agency_conversions')
                    .select('line_user_id, line_display_name')
                    .in('line_user_id', lineUserIds)
                    .not('line_display_name', 'is', null);

                if (convError) {
                    console.error('[agency-link-visits] agency_conversions fallback error:', convError);
                } else if (conversions && conversions.length > 0) {
                    lineProfilesMap = Object.fromEntries(
                        conversions.map(c => [c.line_user_id, { display_name: c.line_display_name }])
                    );
                    console.log(`[agency-link-visits] Fallback matched: ${conversions.length}`);
                }
            }
        }

        // Format visits to include LINE display name
        const formattedVisits = (visits || []).map(visit => {
            const lineProfile = visit.line_user_id ? lineProfilesMap[visit.line_user_id] : null;
            const friendType = visit.metadata?.friend_type || null;
            return {
                ...visit,
                line_display_name: lineProfile?.display_name || null,
                friend_status: friendType === 'new_friend' ? '新規' : friendType === 'existing_friend' ? '既存' : null
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                visits: formattedVisits,
                total: formattedVisits.length
            })
        };

    } catch (error) {
        console.error('Handler error:', error);

        if (error.name === 'JsonWebTokenError') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '無効な認証トークンです' })
            };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '訪問履歴の取得に失敗しました',
                details: error.message
            })
        };
    }
};
