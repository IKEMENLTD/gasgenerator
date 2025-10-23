const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
            }
        };
    }

    // Only allow POST method
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const trackingData = JSON.parse(event.body);

        // Validate required fields
        if (!trackingData.tracking_code) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Missing tracking_code'
                })
            };
        }

        // Get tracking link information
        const { data: trackingLink, error: linkError } = await supabase
            .from('agency_tracking_links')
            .select('*')
            .eq('tracking_code', trackingData.tracking_code)
            .eq('is_active', true)
            .single();

        if (linkError || !trackingLink) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Invalid tracking code'
                })
            };
        }

        // Get client IP from headers if not provided
        let clientIP = trackingData.ip_address;
        if (!clientIP || clientIP === 'unknown') {
            clientIP = getClientIPFromHeaders(event.headers);
        }

        // Parse User-Agent for device info
        const userAgent = trackingData.user_agent || event.headers['user-agent'] || 'Unknown';

        // Create visit record
        const visitData = {
            tracking_link_id: trackingLink.id,
            ip_address: clientIP,
            user_agent: userAgent,
            referrer: trackingData.referrer,
            utm_source: trackingData.utm_source || trackingLink.utm_source,
            utm_medium: trackingData.utm_medium || trackingLink.utm_medium,
            utm_campaign: trackingData.utm_campaign || trackingLink.utm_campaign,
            screen_resolution: trackingData.screen_resolution,
            language: trackingData.language,
            timezone: trackingData.timezone,
            visited_at: trackingData.visited_at || new Date().toISOString(),
            session_id: generateSessionId(),
            device_type: getUserDeviceType(userAgent),
            browser: getUserBrowser(userAgent),
            os: getUserOS(userAgent)
        };

        // Check for duplicate visits within the last 5 minutes from same IP
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentVisit } = await supabase
            .from('agency_tracking_visits')
            .select('id')
            .eq('tracking_link_id', trackingLink.id)
            .eq('visitor_ip', clientIP)
            .gte('visited_at', fiveMinutesAgo)
            .single();

        let visitId = null;
        if (!recentVisit) {
            // Insert visit record
            const { data: visit, error: visitError } = await supabase
                .from('agency_tracking_visits')
                .insert([{
                    tracking_link_id: trackingLink.id,
                    agency_id: trackingLink.agency_id,
                    visitor_ip: clientIP,
                    user_agent: visitData.user_agent,
                    referrer: visitData.referrer,
                    session_id: visitData.session_id,
                    device_type: visitData.device_type,
                    browser: visitData.browser,
                    os: visitData.os,
                    metadata: {
                        utm_source: visitData.utm_source,
                        utm_medium: visitData.utm_medium,
                        utm_campaign: visitData.utm_campaign,
                        screen_resolution: visitData.screen_resolution,
                        language: visitData.language,
                        timezone: visitData.timezone
                    }
                }])
                .select()
                .single();

            if (visitError) {
                console.error('Error creating visit:', visitError);
                // Don't fail the request if visit tracking fails
            } else {
                visitId = visit.id;

                // Increment visit count for the tracking link
                const { error: updateError } = await supabase
                    .from('agency_tracking_links')
                    .update({
                        visit_count: trackingLink.visit_count + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', trackingLink.id);

                if (updateError) {
                    console.error('Error updating visit count:', updateError);
                }
            }
        }

        // Store visit info in session for potential LINE user linking
        const sessionData = {
            visit_id: visitId,
            tracking_link_id: trackingLink.id,
            utm_params: {
                source: visitData.utm_source,
                medium: visitData.utm_medium,
                campaign: visitData.utm_campaign
            },
            timestamp: new Date().toISOString()
        };

        // Return tracking link's LINE friend URL and session info
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
                'Set-Cookie': `tracking_session=${JSON.stringify(sessionData)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=3600`
            },
            body: JSON.stringify({
                success: true,
                line_friend_url: trackingLink.destination_url || trackingLink.line_friend_url || 'https://lin.ee/4NLfSqH',
                tracking_link: {
                    name: trackingLink.name,
                    utm_source: trackingLink.utm_source,
                    utm_medium: trackingLink.utm_medium,
                    utm_campaign: trackingLink.utm_campaign
                },
                visit_id: visitId,
                session_id: visitData.session_id
            })
        };

    } catch (error) {
        console.error('Function error:', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Internal server error: ' + error.message
            })
        };
    }
};

// Helper function to extract client IP from headers
function getClientIPFromHeaders(headers) {
    // Check various headers for client IP
    const ipHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-client-ip',
        'cf-connecting-ip',  // Cloudflare
        'x-forwarded',
        'forwarded-for',
        'forwarded'
    ];

    for (const header of ipHeaders) {
        const value = headers[header];
        if (value) {
            // x-forwarded-for can contain multiple IPs, get the first one
            return value.split(',')[0].trim();
        }
    }

    return 'unknown';
}

// Helper function to generate session ID
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper function to parse User-Agent for device type
function getUserDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    if (/bot/i.test(userAgent)) return 'bot';
    return 'desktop';
}

// Helper function to parse User-Agent for browser
function getUserBrowser(userAgent) {
    if (!userAgent) return 'unknown';

    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/line/i.test(userAgent)) return 'LINE';
    return 'other';
}

// Helper function to parse User-Agent for OS
function getUserOS(userAgent) {
    if (!userAgent) return 'unknown';

    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
    return 'other';
}

// Validate environment variables on cold start
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
}