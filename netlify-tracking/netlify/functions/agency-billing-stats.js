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
            .select('own_commission_rate, commission_rate')
            .eq('id', agencyId)
            .single();

        const commissionRate = agencyData?.own_commission_rate || agencyData?.commission_rate || 20;

        // Get all conversions for this agency with user billing info
        console.log('🔍 [DEBUG] Fetching conversions for agency:', agencyId);
        const { data: conversions, error: conversionsError } = await supabase
            .from('agency_conversions')
            .select(`
                id,
                user_id,
                conversion_type,
                conversion_value,
                created_at,
                line_user_id,
                line_display_name,
                device_type,
                browser,
                os
            `)
            .eq('agency_id', agencyId)
            .order('created_at', { ascending: false });

        if (conversionsError) {
            console.error('❌ Conversions error:', conversionsError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'コンバージョンデータの取得に失敗しました' })
            };
        }

        console.log('✅ [DEBUG] Conversions fetched:', conversions?.length || 0);
        console.log('📊 [DEBUG] Conversion sample:', conversions?.[0]);

        // Get user IDs from conversions
        const userIds = [...new Set(conversions?.map(c => c.user_id).filter(Boolean))];

        console.log('👥 [DEBUG] Extracted user IDs:', userIds.length, userIds);
        console.log('🔍 [DEBUG] Conversions with user_id:', conversions?.filter(c => c.user_id).length || 0);
        console.log('🔍 [DEBUG] Conversions without user_id:', conversions?.filter(c => !c.user_id).length || 0);

        let billingUsers = [];
        let activeSubscriberCount = 0;
        let totalCommission = 0;

        if (userIds.length > 0) {
            console.log('🔄 [DEBUG] Fetching users from users table...');
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
                    stripe_customer_id,
                    current_plan_price
                `)
                .in('id', userIds);

            if (usersError) {
                console.error('❌ Users error:', usersError);
                console.error('❌ Users error details:', JSON.stringify(usersError));
            } else {
                console.log('✅ [DEBUG] Users fetched:', users?.length || 0);
                console.log('📊 [DEBUG] Users sample:', users?.[0]);

                // Process billing data
                billingUsers = users.map(user => {
                    const isActive = user.subscription_status === 'active' || user.subscription_status === 'trialing'
                        || user.subscription_status === 'premium' || user.subscription_status === 'professional';
                    const isPremium = user.is_premium === true;

                    // Determine monthly fee from actual plan price
                    // Premium: 10,000円/月, Professional: 50,000円/月
                    const monthlyFee = user.current_plan_price
                        || (user.subscription_status === 'professional' ? 50000 : 10000);
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

                    // コンバージョンからLINE名前・デバイス情報を取得
                    const userConversions = conversions?.filter(c => c.user_id === user.id) || [];
                    const latestConversion = userConversions[0];

                    return {
                        userId: user.id,
                        displayName: user.display_name || user.line_display_name || latestConversion?.line_display_name || '名前未設定',
                        subscriptionStatus: user.subscription_status || 'free',
                        subscriptionStartedAt: user.subscription_started_at,
                        subscriptionEndDate: user.subscription_end_date,
                        isPremium,
                        isActive,
                        commission: Math.round(userCommission),
                        stripeCustomerId: user.stripe_customer_id,
                        deviceType: latestConversion?.device_type || null,
                        browser: latestConversion?.browser || null,
                        os: latestConversion?.os || null,
                        lineDisplayName: latestConversion?.line_display_name || null
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

                console.log('💰 [DEBUG] Billing users processed:', billingUsers.length);
                console.log('📊 [DEBUG] Active subscribers:', activeSubscriberCount);
            }
        } else {
            console.log('⚠️  [DEBUG] No user IDs found in conversions');
            console.log('💡 [DEBUG] Possible reasons:');
            console.log('   1. No conversions recorded yet');
            console.log('   2. All conversions have user_id = NULL');
            console.log('   3. Stripe webhook not setting user_id in metadata');
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

        // リファラルコミッション集計（agency_commission_distributions テーブルから）
        const { data: distributions } = await supabase
            .from('agency_commission_distributions')
            .select('commission_type, commission_amount, payment_status')
            .eq('agency_id', agencyId);

        const referralTotal = (distributions || [])
            .filter(d => d.commission_type === 'referral')
            .reduce((sum, d) => sum + (parseFloat(d.commission_amount) || 0), 0);

        const referralPending = (distributions || [])
            .filter(d => d.commission_type === 'referral' && d.payment_status === 'pending')
            .reduce((sum, d) => sum + (parseFloat(d.commission_amount) || 0), 0);

        const referralPaid = (distributions || [])
            .filter(d => d.commission_type === 'referral' && d.payment_status === 'paid')
            .reduce((sum, d) => sum + (parseFloat(d.commission_amount) || 0), 0);

        const responseData = {
            // サマリー統計
            summary: {
                activeSubscribers: activeSubscriberCount,
                totalConversions: conversions?.length || 0,
                totalCommission: Math.round(totalCommission),
                paidCommission: Math.round(totalPaidCommission),
                pendingCommission: Math.round(totalPendingCommission),
                commissionRate: commissionRate,
                referralCommissionTotal: Math.round(referralTotal),
                referralPending: Math.round(referralPending),
                referralPaid: Math.round(referralPaid)
            },
            // 個別ユーザーの課金状態
            billingUsers: billingUsers,
            // 最終更新日時
            lastUpdated: new Date().toISOString(),
            // デバッグ情報（本番環境では削除推奨）
            debug: {
                totalConversions: conversions?.length || 0,
                conversionsWithUserId: conversions?.filter(c => c.user_id).length || 0,
                extractedUserIds: userIds.length,
                fetchedUsers: billingUsers.length
            }
        };

        console.log('📤 [DEBUG] Response summary:', responseData.summary);
        console.log('📤 [DEBUG] Response debug:', responseData.debug);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
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
