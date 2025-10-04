const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
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

        // Get total links count
        const { count: totalLinks } = await supabase
            .from('agency_tracking_links')
            .select('*', { count: 'exact', head: true })
            .eq('agency_id', agencyId);

        // Get total clicks (visits)
        const { data: clickData } = await supabase
            .from('agency_tracking_links')
            .select('visit_count')
            .eq('agency_id', agencyId);

        const totalClicks = clickData?.reduce((sum, link) => sum + (link.visit_count || 0), 0) || 0;

        // Get total conversions
        const { data: conversionData } = await supabase
            .from('agency_tracking_links')
            .select('conversion_count')
            .eq('agency_id', agencyId);

        const totalConversions = conversionData?.reduce((sum, link) => sum + (link.conversion_count || 0), 0) || 0;

        // Calculate conversion rate
        const conversionRate = totalClicks > 0
            ? Math.round((totalConversions / totalClicks) * 100 * 10) / 10
            : 0;

        // Get current month commission
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const { data: currentMonthCommission } = await supabase
            .from('agency_commissions')
            .select('commission_amount')
            .eq('agency_id', agencyId)
            .gte('period_start', startOfMonth.toISOString())
            .lte('period_end', endOfMonth.toISOString())
            .single();

        // Get last month commission
        const startOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);

        const { data: lastMonthCommission } = await supabase
            .from('agency_commissions')
            .select('commission_amount')
            .eq('agency_id', agencyId)
            .gte('period_start', startOfLastMonth.toISOString())
            .lte('period_end', endOfLastMonth.toISOString())
            .single();

        // Get total commission
        const { data: totalCommissionData } = await supabase
            .from('agency_commissions')
            .select('commission_amount')
            .eq('agency_id', agencyId)
            .eq('status', 'paid');

        const totalCommission = totalCommissionData?.reduce(
            (sum, commission) => sum + (commission.commission_amount || 0), 0
        ) || 0;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                totalLinks: totalLinks || 0,
                totalClicks,
                totalConversions,
                conversionRate,
                monthlyCommission: currentMonthCommission?.commission_amount || 0,
                lastMonthCommission: lastMonthCommission?.commission_amount || 0,
                totalCommission
            })
        };
    } catch (error) {
        console.error('Stats error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '統計情報の取得に失敗しました'
            })
        };
    }
};