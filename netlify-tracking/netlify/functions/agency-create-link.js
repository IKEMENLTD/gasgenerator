const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateTrackingCode() {
    return Math.random().toString(36).substring(2, 8) +
           Math.random().toString(36).substring(2, 8);
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agency-Id',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Verify JWT token
        const token = event.headers.authorization?.replace('Bearer ', '');
        const agencyId = event.headers['x-agency-id'];

        if (!token || !agencyId) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '認証が必要です' })
            };
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: '無効なトークンです' })
            };
        }

        // Verify agency ID matches token
        if (decoded.agencyId !== agencyId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'アクセス権限がありません' })
            };
        }

        const {
            name,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_term,
            utm_content,
            line_friend_url,
            destination_url
        } = JSON.parse(event.body);

        // Validate required fields
        if (!name || !line_friend_url) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'キャンペーン名とLINE友達追加URLは必須です'
                })
            };
        }

        // Generate unique tracking code
        let trackingCode;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
            trackingCode = generateTrackingCode();

            const { data: existing } = await supabase
                .from('agency_tracking_links')
                .select('id')
                .eq('tracking_code', trackingCode)
                .single();

            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            throw new Error('Failed to generate unique tracking code');
        }

        // Create tracking link
        const { data: link, error: linkError } = await supabase
            .from('agency_tracking_links')
            .insert({
                agency_id: agencyId,
                created_by: decoded.userId,
                tracking_code: trackingCode,
                name,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_term,
                utm_content,
                line_friend_url,
                destination_url: destination_url || line_friend_url,
                is_active: true,
                visit_count: 0,
                conversion_count: 0
            })
            .select()
            .single();

        if (linkError) {
            console.error('Error creating link:', linkError);
            throw linkError;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                ...link
            })
        };
    } catch (error) {
        console.error('Create link error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'リンクの作成に失敗しました'
            })
        };
    }
};