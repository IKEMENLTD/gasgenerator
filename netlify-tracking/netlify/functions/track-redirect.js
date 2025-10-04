const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    // Extract tracking code from path
    const pathParts = event.path.split('/');
    const trackingCode = pathParts[pathParts.length - 1];

    if (!trackingCode) {
        return {
            statusCode: 404,
            body: 'Tracking code not found'
        };
    }

    try {
        // Find tracking link
        const { data: link, error: linkError } = await supabase
            .from('agency_tracking_links')
            .select(`
                *,
                agencies (*)
            `)
            .eq('tracking_code', trackingCode)
            .eq('is_active', true)
            .single();

        if (linkError || !link) {
            return {
                statusCode: 404,
                body: 'Invalid tracking link'
            };
        }

        // Extract visitor information
        const visitorInfo = {
            ip: event.headers['x-forwarded-for'] || event.headers['client-ip'],
            userAgent: event.headers['user-agent'],
            referrer: event.headers['referer'] || event.headers['referrer'],
            // Parse user agent for device info
            deviceType: getUserDeviceType(event.headers['user-agent']),
            browser: getUserBrowser(event.headers['user-agent']),
            os: getUserOS(event.headers['user-agent'])
        };

        // Generate session ID for tracking across conversion funnel
        const sessionId = generateSessionId();

        // Record the visit
        const { data: visit, error: visitError } = await supabase
            .from('agency_tracking_visits')
            .insert({
                tracking_link_id: link.id,
                agency_id: link.agency_id,
                visitor_ip: visitorInfo.ip,
                user_agent: visitorInfo.userAgent,
                referrer: visitorInfo.referrer,
                device_type: visitorInfo.deviceType,
                browser: visitorInfo.browser,
                os: visitorInfo.os,
                session_id: sessionId,
                metadata: {
                    tracking_code: trackingCode,
                    utm_source: link.utm_source,
                    utm_medium: link.utm_medium,
                    utm_campaign: link.utm_campaign,
                    timestamp: new Date().toISOString()
                }
            })
            .select()
            .single();

        if (visitError) {
            console.error('Error recording visit:', visitError);
        }

        // Increment visit count
        await supabase
            .from('agency_tracking_links')
            .update({
                visit_count: link.visit_count + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', link.id);

        // Build redirect URL with tracking parameters
        const destinationUrl = link.destination_url || link.line_friend_url || 'https://lin.ee/4NLfSqH';
        const url = new URL(destinationUrl);

        // Add tracking parameters to preserve attribution
        url.searchParams.append('tid', trackingCode);
        url.searchParams.append('sid', sessionId);
        url.searchParams.append('aid', link.agency_id);

        // Add UTM parameters if they exist
        if (link.utm_source) url.searchParams.append('utm_source', link.utm_source);
        if (link.utm_medium) url.searchParams.append('utm_medium', link.utm_medium);
        if (link.utm_campaign) url.searchParams.append('utm_campaign', link.utm_campaign);
        if (link.utm_term) url.searchParams.append('utm_term', link.utm_term);
        if (link.utm_content) url.searchParams.append('utm_content', link.utm_content);

        // Set cookie for session tracking (for web-based conversions)
        const cookieValue = JSON.stringify({
            trackingCode,
            sessionId,
            agencyId: link.agency_id,
            timestamp: new Date().toISOString()
        });

        return {
            statusCode: 302,
            headers: {
                'Location': url.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Set-Cookie': `taskmate_tracking=${Buffer.from(cookieValue).toString('base64')}; Path=/; Max-Age=2592000; SameSite=Lax`
            },
            body: ''
        };

    } catch (error) {
        console.error('Tracking error:', error);

        // Fallback redirect to LINE friend URL
        return {
            statusCode: 302,
            headers: {
                'Location': 'https://lin.ee/4NLfSqH',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: ''
        };
    }
};

function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getUserDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    if (/bot/i.test(userAgent)) return 'bot';
    return 'desktop';
}

function getUserBrowser(userAgent) {
    if (!userAgent) return 'unknown';

    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/line/i.test(userAgent)) return 'LINE';
    return 'other';
}

function getUserOS(userAgent) {
    if (!userAgent) return 'unknown';

    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
    return 'other';
}