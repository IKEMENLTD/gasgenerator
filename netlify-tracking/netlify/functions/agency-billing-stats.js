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

        // Get agency commission rate for calculation
        const { data: agencyData } = await supabase
            .from('agencies')
            .select('commission_rate')
            .eq('id', agencyId)
            .single();

        const commissionRate = agencyData?.commission_rate || 10;

        // Get all conversions for this agency with user billing info
        const { data: conversions, error: conversionsError } = await supabase
            .from('agency_conversions')
            .select(`
                id,
                user_id,
                conversion_type,
                conversion_value,
                created_at,
                line_user_id,
                line_display_name
            `)
            .eq('agency_id', agencyId)
            .order('created_at', { ascending: false });

        if (conversionsError) {
            console.error('Conversions error:', conversionsError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'コンバージョンデータの取得に失敗しました' })
            };
        }

        // Get user IDs from conversions
        const userIds = [...new Set(conversions?.map(c => c.user_id).filter(Boolean))];

        let billingUsers = [];
        let activeSubscriberCount = 0;
        let totalCommission = 0;

        if (userIds.length > 0) {
            // Get user billing information
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select(`
                    id,
                    display_name,
                    line_display_name,
                    subscription_status,
                    subscription_started_at,
                    subscription_end_date,
                    payment_start_date,
                    is_premium,
                    stripe_customer_id
                `)
                .in('id', userIds);

            if (usersError) {
                console.error('Users error:', usersError);
            } else {
                // Process billing data
                billingUsers = users.map(user => {
                    const isActive = user.subscription_status === 'active' || user.subscription_status === 'trialing';
                    const isPremium = user.is_premium === true;

                    // Calculate commission for this user
                    // Assuming monthly subscription is 980円
                    const monthlyFee = 980;
                    let userCommission = 0;

                    if (isActive && user.subscription_started_at) {
                        const startDate = new Date(user.subscription_started_at);
                        const now = new Date();
                        const monthsActive = Math.max(1, Math.floor((now - startDate) / (1000 * 60 * 60 * 24 * 30)));
                        userCommission = monthlyFee * monthsActive * (commissionRate / 100);
                        totalCommission += userCommission;
                    }

                    if (isActive) {
                        activeSubscriberCount++;
                    }

                    return {
                        userId: user.id,
                        displayName: user.display_name || user.line_display_name || '名前未設定',
                        subscriptionStatus: user.subscription_status || 'free',
                        subscriptionStartedAt: user.subscription_started_at,
                        subscriptionEndDate: user.subscription_end_date,
                        isPremium,
                        isActive,
                        commission: Math.round(userCommission),
                        stripeCustomerId: user.stripe_customer_id
                    };
                }).sort((a, b) => {
                    // Active subscribers first
                    if (a.isActive && !b.isActive) return -1;
                    if (!a.isActive && b.isActive) return 1;
                    // Then sort by start date
                    const dateA = new Date(a.subscriptionStartedAt || 0);
                    const dateB = new Date(b.subscriptionStartedAt || 0);
                    return dateB - dateA;
                });
            }
        }

        // Get total paid commission from agency_commissions table
        const { data: paidCommissions } = await supabase
            .from('agency_commissions')
            .select('commission_amount')
            .eq('agency_id', agencyId)
            .eq('status', 'paid');

        const totalPaidCommission = paidCommissions?.reduce(
            (sum, c) => sum + (parseFloat(c.commission_amount) || 0), 0
        ) || 0;

        // Get pending commission
        const { data: pendingCommissions } = await supabase
            .from('agency_commissions')
            .select('commission_amount')
            .eq('agency_id', agencyId)
            .eq('status', 'pending');

        const totalPendingCommission = pendingCommissions?.reduce(
            (sum, c) => sum + (parseFloat(c.commission_amount) || 0), 0
        ) || 0;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                // サマリー統計
                summary: {
                    activeSubscribers: activeSubscriberCount,
                    totalConversions: conversions?.length || 0,
                    totalCommission: Math.round(totalCommission),
                    paidCommission: Math.round(totalPaidCommission),
                    pendingCommission: Math.round(totalPendingCommission),
                    commissionRate: commissionRate
                },
                // 個別ユーザーの課金状態
                billingUsers: billingUsers,
                // 最終更新日時
                lastUpdated: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Billing stats error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: '課金統計情報の取得に失敗しました',
                details: error.message
            })
        };
    }
};
