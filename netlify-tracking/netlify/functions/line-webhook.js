const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client with SERVICE_ROLE_KEY
// IMPORTANT: Webhooks are server-side operations that need full database access
// ANON_KEY would be restricted by Row Level Security (RLS)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// LINE Messaging API configuration
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

exports.handler = async (event, context) => {
    // Handle CORS for preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, X-Line-Signature',
                'Access-Control-Allow-Methods': 'POST'
            }
        };
    }

    // Only allow POST method
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Verify LINE webhook signature
        const signature = event.headers['x-line-signature'];
        const body = event.body;

        if (!verifySignature(body, signature)) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }

        const webhookBody = JSON.parse(body);
        const events = webhookBody.events;

        // 無限ループ防止: 既に転送されたリクエストは再転送しない
        const isForwarded = event.headers['x-forwarded-from'];
        if (isForwarded) {
            console.log('⚠️ Request already forwarded from:', isForwarded, '- skipping re-forward to prevent infinite loop');
        }

        // Netlify側の処理（コンバージョン記録のみ）[v2.0]
        console.log('=== Netlify Webhook処理開始 ===');
        console.log('Events count:', events.length);

        for (const lineEvent of events) {
            console.log('Processing event type:', lineEvent.type);
            // クライアント情報をイベントに追加（スコアリングマッチング用）
            await processLineEvent(lineEvent, event.headers);
        }

        // メッセージ・フォロー・アンフォローイベント処理（Renderに転送）
        const shouldForwardToRender = events.some(e =>
            e.type === 'message' ||
            e.type === 'follow' ||
            e.type === 'unfollow'
        );
        const eventTypes = events.map(e => e.type).join(', ');
        console.log('Event types:', eventTypes);
        console.log('Should forward to Render:', shouldForwardToRender);
        console.log('Is forwarded:', isForwarded);

        if (shouldForwardToRender && !isForwarded) {
            console.log('🚀 Render転送を開始します... (event types:', eventTypes, ')');
            // Renderに転送（完了を待つ）
            await forwardToRender(body, signature);
        } else {
            if (!shouldForwardToRender) {
                console.log('ℹ️ 転送対象イベントがないため、Render転送をスキップ (types:', eventTypes, ')');
            }
            if (isForwarded) {
                console.log('ℹ️ 既に転送済みのため、Render転送をスキップ（無限ループ防止）');
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('LINE webhook error:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error: ' + error.message
            })
        };
    }
};

// Verify LINE webhook signature
function verifySignature(body, signature) {
    if (!LINE_CHANNEL_SECRET || !signature) {
        return false;
    }

    const hash = crypto
        .createHmac('sha256', LINE_CHANNEL_SECRET)
        .update(body)
        .digest('base64');

    return hash === signature;
}

// Process individual LINE events
async function processLineEvent(event, headers) {
    try {
        switch (event.type) {
            case 'follow':
                await handleFollowEvent(event, headers);
                break;
            case 'unfollow':
                await handleUnfollowEvent(event);
                break;
            case 'message':
                await handleMessageEvent(event, headers);
                break;
            default:
                console.log('Unhandled event type:', event.type);
        }
    } catch (error) {
        console.error('Error processing LINE event:', error);
    }
}

// Handle follow events (user adds bot as friend)
async function handleFollowEvent(event, headers) {
    const userId = event.source.userId;

    try {
        console.log('=== FOLLOW EVENT 受信 ===');
        console.log('LINE User ID:', userId);

        // クライアント情報を取得（スコアリングマッチング用）
        const clientIp = headers['x-forwarded-for'] || headers['client-ip'] || '';
        const userAgent = headers['user-agent'] || '';
        console.log('📍 Client IP:', clientIp);
        console.log('🖥️  User-Agent:', userAgent?.substring(0, 100) + '...');

        // Get user profile from LINE API
        const userProfile = await getLineUserProfile(userId);

        if (!userProfile) {
            console.error('Failed to get user profile for:', userId);
            return;
        }

        console.log('LINE Profile取得成功:', userProfile.displayName);

        // 🆕 Check if this is an agency registration (代理店登録フロー)
        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('id, code, name, status, contact_email')
            .eq('line_user_id', userId)
            .maybeSingle();

        if (!agencyError && agency) {
            console.log('✅ 代理店登録の友達追加を検知:', agency.name);
            console.log('- 代理店ID:', agency.id);
            console.log('- 代理店コード:', agency.code);
            console.log('- 現在のステータス:', agency.status);

            // 既に処理済みの場合はスキップ（重複防止）
            if (agency.status === 'active' || agency.status === 'pending') {
                console.log(`⚠️ 代理店は既に${agency.status} - スキップします`);
                return;
            }

            // 友達追加完了 → 管理者承認待ち（pending）に遷移
            // ※ pending_friend_add または pending_line_verification から遷移
            const { error: updateError } = await supabase
                .from('agencies')
                .update({
                    status: 'pending'
                })
                .eq('id', agency.id);

            if (updateError) {
                console.error('❌ 代理店ステータス更新失敗:', updateError);
            } else {
                console.log('✅ 代理店を承認待ち（pending）に更新しました');

                // 友達追加完了メッセージを送信（承認待ちの案内）
                await sendAgencyPendingMessage(userId, agency);
                console.log('✅ 代理店承認待ちメッセージ送信完了');
            }

            return; // 代理店フロー完了
        }

        console.log('通常の友達追加として処理します');

        // 🔽 既存のトラッキングユーザー処理（従来通り）

        // Check if user profile already exists
        const { data: existingProfile } = await supabase
            .from('line_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingProfile) {
            // Update existing profile
            const { error } = await supabase
                .from('line_profiles')
                .update({
                    display_name: userProfile.displayName,
                    picture_url: userProfile.pictureUrl,
                    status_message: userProfile.statusMessage,
                    language: userProfile.language,
                    fetched_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) {
                console.error('Error updating existing profile:', error);
            }
        } else {
            // Create new profile record
            const profileData = {
                user_id: userId,
                display_name: userProfile.displayName,
                picture_url: userProfile.pictureUrl,
                status_message: userProfile.statusMessage,
                language: userProfile.language,
                fetched_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: newProfile, error } = await supabase
                .from('line_profiles')
                .insert([profileData])
                .select()
                .single();

            if (error) {
                console.error('Error creating profile:', error);
                return;
            }

            // Try to link with recent tracking visit (新規友達として記録)
            await linkUserToTracking(userId, userId, clientIp, userAgent, 'new_friend');
        }

        // ⚠️ Netlify側ではメッセージ送信は行わない（Render側のみが送信）
        // await sendWelcomeMessage(userId, userProfile.displayName);

    } catch (error) {
        console.error('Error handling follow event:', error);
    }
}

// Handle unfollow events (user removes bot as friend)
async function handleUnfollowEvent(event) {
    const userId = event.source.userId;

    try {
        // Note: line_profiles table doesn't have is_friend column
        // Just log the unfollow event
        console.log(`User ${userId} unfollowed the bot`);
    } catch (error) {
        console.error('Error handling unfollow event:', error);
    }
}

// Handle message events
async function handleMessageEvent(event, headers) {
    const userId = event.source.userId;

    // クライアント情報を取得
    const clientIp = headers?.['x-forwarded-for'] || headers?.['client-ip'] || '';
    const userAgent = headers?.['user-agent'] || '';

    try {
        // Get user profile from LINE API and upsert to line_profiles
        // This ensures existing friends (who didn't trigger follow event) are also recorded
        const userProfile = await getLineUserProfile(userId);

        if (userProfile) {
            await supabase
                .from('line_profiles')
                .upsert({
                    user_id: userId,
                    display_name: userProfile.displayName,
                    picture_url: userProfile.pictureUrl,
                    status_message: userProfile.statusMessage,
                    fetched_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            console.log('✅ LINE Profile upsert成功:', userProfile.displayName);
        }

        // 🆕 既存友達の訪問記録紐付けロジック
        // followイベントが発生しない既存友達がトラッキングリンク経由で来た場合、
        // メッセージ送信時に過去1時間以内の未紐付け訪問記録を紐付ける
        console.log('🔗 既存友達の訪問記録紐付けチェック開始:', userId);

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // 未紐付けの訪問記録を検索（metadataも取得してN+1クエリ回避）
        const { data: unlinkedVisits, error: searchError } = await supabase
            .from('agency_tracking_visits')
            .select('id, tracking_link_id, agency_id, created_at, metadata')
            .is('line_user_id', null)
            .gte('created_at', oneHourAgo)
            .order('created_at', { ascending: false })
            .limit(5);

        if (searchError) {
            console.error('❌ 未紐付け訪問記録の検索に失敗:', searchError);
            return; // エラー時は処理を中断
        }

        if (!unlinkedVisits || unlinkedVisits.length === 0) {
            console.log('ℹ️ 過去1時間以内の未紐付け訪問記録なし');
            return;
        }

        console.log(`✅ ${unlinkedVisits.length}件の未紐付け訪問記録を発見`);

        // 🆕 既存友達用の簡易スコアリング（最も最近の1件のみ紐付け）
        // followイベントと違い、クライアント情報が信頼できないため時間のみで判定
        const mostRecentVisit = unlinkedVisits[0];  // 既にcreated_at降順でソート済み

        try {
            const currentMetadata = mostRecentVisit.metadata || {};

            const { error: updateError } = await supabase
                .from('agency_tracking_visits')
                .update({
                    line_user_id: userId,
                    metadata: {
                        ...currentMetadata,
                        friend_type: 'existing_friend',
                        linked_at: new Date().toISOString(),
                        match_method: 'message_event'
                    }
                })
                .eq('id', mostRecentVisit.id)
                .is('line_user_id', null);  // 既に紐付けられていたら更新しない

            if (updateError) {
                console.error(`❌ Visit ${mostRecentVisit.id} の更新に失敗:`, updateError);
            } else {
                console.log(`✅ 最新の訪問記録 ${mostRecentVisit.id} を既存友達に紐付けました`);

                // コンバージョン記録も作成
                const sessionData = {
                    id: null, // セッションIDがない場合
                    agency_id: mostRecentVisit.agency_id,
                    tracking_link_id: mostRecentVisit.tracking_link_id,
                    visit_id: mostRecentVisit.id
                };

                await createAgencyLineConversion(sessionData, userId, userId).catch(err => {
                    console.error(`❌ Visit ${mostRecentVisit.id} のコンバージョン記録作成に失敗:`, err);
                });
            }
        } catch (error) {
            console.error(`❌ Visit ${mostRecentVisit.id} の処理中にエラー:`, error);
        }

        // ⚠️ Netlify側ではメッセージ返信は行わない（Render側のみが返信）
        // 代理店プログラムのコンバージョン記録のみを担当
        // if (event.message.type === 'text') {
        //     await handleTextMessage(userId, event.message.text);
        // }
    } catch (error) {
        console.error('Error handling message event:', error);
    }
}

// Get user profile from LINE API
async function getLineUserProfile(userId) {
    try {
        const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
            headers: {
                'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            }
        });

        if (response.ok) {
            return await response.json();
        } else {
            console.error('Failed to get LINE user profile:', response.status, response.statusText);
            return null;
        }
    } catch (error) {
        console.error('Error getting LINE user profile:', error);
        return null;
    }
}

// Link user to recent tracking visit with enhanced agency attribution
async function linkUserToTracking(lineUserId, userId, clientIp, userAgent, friendType = 'new_friend') {
    try {
        console.log(`🔗 訪問記録紐付け開始 - User: ${lineUserId}, Type: ${friendType}`);
        console.log(`📍 Client IP: ${clientIp}, UA: ${userAgent?.substring(0, 50)}...`);
        // First, try to find an active session for this user
        const { data: activeSession, error: sessionError } = await supabase
            .from('user_sessions')
            .select('*')
            .is('line_user_id', null)
            .gte('last_activity_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Within last 2 hours
            .order('last_activity_at', { ascending: false })
            .limit(1);

        if (!sessionError && activeSession && activeSession.length > 0) {
            const session = activeSession[0];

            // Update session with LINE user info
            const { error: updateError } = await supabase
                .from('user_sessions')
                .update({
                    line_user_id: lineUserId,
                    line_friend_at: new Date().toISOString(),
                    last_activity_at: new Date().toISOString()
                })
                .eq('id', session.id);

            if (!updateError) {
                console.log(`Linked LINE user ${lineUserId} to session ${session.id} for agency ${session.agency_id}`);

                // Record funnel step
                await supabase
                    .from('conversion_funnels')
                    .insert([{
                        session_id: session.id,
                        agency_id: session.agency_id,
                        step_name: 'line_friend',
                        step_data: {
                            line_user_id: lineUserId,
                            user_id: userId,
                            timestamp: new Date().toISOString()
                        }
                    }]);

                // Create LINE friend conversion if this is an agency session
                if (session.agency_id) {
                    await createAgencyLineConversion(session, lineUserId, userId);
                }

                return session;
            }
        }

        // Fallback to old method for backward compatibility
        // 🔧 時間制限を1時間 → 24時間に延長（2025-11-13）
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const followTime = new Date();
        console.log(`🔍 訪問記録検索: ${oneDayAgo} 以降, line_user_id=NULL`);

        // Try agency_tracking_visits first - 候補を多めに取得してスコアリング
        const { data: agencyVisits, error: agencyError } = await supabase
            .from('agency_tracking_visits')
            .select('*')
            .is('line_user_id', null)
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(20);  // 候補を20件に増やす

        // 🔧 検索エラーのログ追加（2025-11-13）
        if (agencyError) {
            console.error(`❌ agency_tracking_visits 検索エラー:`, agencyError);
        } else if (!agencyVisits || agencyVisits.length === 0) {
            console.log(`⚠️ 紐付け可能な訪問記録が見つかりませんでした (過去24時間, line_user_id=NULL)`);
        } else {
            console.log(`✅ ${agencyVisits.length}件の訪問記録を候補として検出`);
        }

        if (!agencyError && agencyVisits && agencyVisits.length > 0) {
            // 🆕 スコアリングマッチング（2025-11-13）
            let bestMatch = { visit: null, score: 0, reasons: [] };

            for (const visit of agencyVisits) {
                let score = 0;
                let reasons = [];

                // IP一致 (40点)
                if (clientIp && visit.visitor_ip && visit.visitor_ip === clientIp) {
                    score += 40;
                    reasons.push('IP一致(+40)');
                }

                // User-Agent一致 (30点)
                if (userAgent && visit.user_agent && visit.user_agent === userAgent) {
                    score += 30;
                    reasons.push('UA一致(+30)');
                }

                // 時間近接度 (最大20点)
                const timeDiff = Math.abs(followTime - new Date(visit.created_at));
                const minutes = timeDiff / (60 * 1000);

                if (minutes < 5) {
                    score += 20;
                    reasons.push('5分以内(+20)');
                } else if (minutes < 15) {
                    score += 15;
                    reasons.push('15分以内(+15)');
                } else if (minutes < 30) {
                    score += 10;
                    reasons.push('30分以内(+10)');
                } else if (minutes < 60) {
                    score += 5;
                    reasons.push('1時間以内(+5)');
                }

                // デバイスタイプ一致 (10点)
                if (userAgent && visit.user_agent) {
                    const currentDeviceType = getUserDeviceType(userAgent);
                    const visitDeviceType = visit.device_type;
                    if (currentDeviceType === visitDeviceType && currentDeviceType !== 'unknown') {
                        score += 10;
                        reasons.push(`デバイス一致:${currentDeviceType}(+10)`);
                    }
                }

                if (score > bestMatch.score) {
                    bestMatch = { visit, score, reasons };
                }

                console.log(`📊 Visit ${visit.id}: スコア=${score}, 理由=[${reasons.join(', ')}]`);
            }

            // 閾値判定（最低50点以上）
            const THRESHOLD = 50;

            if (bestMatch.score < THRESHOLD) {
                console.log(`❌ 紐付け失敗: 最高スコア=${bestMatch.score} < 閾値=${THRESHOLD}`);
                console.log(`   候補数=${agencyVisits.length}件, 全てスコア不足`);
            } else {
                console.log(`✅ ベストマッチ検出: Visit ${bestMatch.visit.id}, スコア=${bestMatch.score}`);
                console.log(`   理由: ${bestMatch.reasons.join(', ')}`);

                // 🆕 1件のみ紐付け（他のユーザーの記録を守る）
                const currentMetadata = bestMatch.visit.metadata || {};
                const { error: updateError } = await supabase
                    .from('agency_tracking_visits')
                    .update({
                        line_user_id: lineUserId,
                        metadata: {
                            ...currentMetadata,
                            friend_type: friendType,
                            linked_at: new Date().toISOString(),
                            match_score: bestMatch.score,
                            match_reasons: bestMatch.reasons
                        }
                    })
                    .eq('id', bestMatch.visit.id)
                    .is('line_user_id', null);  // 既に紐付けられていたら更新しない

                if (updateError) {
                    console.error(`❌ Visit ${bestMatch.visit.id} の更新に失敗:`, updateError);
                } else {
                    console.log(`🎯 紐付け成功: Visit ${bestMatch.visit.id} ← LINE user ${lineUserId} (スコア=${bestMatch.score})`);
                }
            }
        }

        // Also check old tracking_visits table
        console.log(`🔍 旧tracking_visitsテーブル検索中...`);
        const { data: recentVisits, error } = await supabase
            .from('tracking_visits')
            .select('*')
            .is('line_user_id', null)
            .gte('visited_at', oneDayAgo)
            .order('visited_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error(`❌ tracking_visits 検索エラー:`, error);
            return null;
        }

        if (!recentVisits || recentVisits.length === 0) {
            console.log(`⚠️ tracking_visits にも紐付け可能な記録なし`);
            return null;
        }

        console.log(`✅ tracking_visits で ${recentVisits.length}件検出`);

        // Link the most recent visit to this user
        const { error: updateError } = await supabase
            .from('tracking_visits')
            .update({ line_user_id: userId })
            .eq('id', recentVisits[0].id);

        if (updateError) {
            console.error(`❌ tracking_visits 更新エラー:`, updateError);
        } else {
            console.log(`✅ tracking_visits: LINE user ${lineUserId} を visit ${recentVisits[0].id} に紐付け成功`);
        }

        return null;
    } catch (error) {
        console.error('Error linking user to tracking:', error);
        return null;
    }
}

// Create agency LINE friend conversion
async function createAgencyLineConversion(session, lineUserId, userId) {
    try {
        // Check if conversion already exists
        const { data: existingConversion } = await supabase
            .from('agency_conversions')
            .select('id')
            .eq('session_id', session.id)
            .eq('conversion_type', 'line_friend')
            .maybeSingle();

        if (existingConversion) {
            return; // Already recorded
        }

        // Get agency information for commission calculation
        const { data: agency } = await supabase
            .from('agencies')
            .select('commission_rate')
            .eq('id', session.agency_id)
            .single();

        // LINE プロフィール取得（表示名をコンバージョンに保存）
        let lineDisplayName = null;
        try {
            const profile = await getLineUserProfile(lineUserId);
            lineDisplayName = profile?.displayName || null;
        } catch (e) {
            console.error('Failed to get LINE profile for conversion:', e);
        }

        // Visit のデバイス情報を取得
        let deviceInfo = {};
        if (session.visit_id || session.id) {
            try {
                const visitQuery = session.visit_id
                    ? supabase.from('agency_tracking_visits').select('id, device_type, browser, os').eq('id', session.visit_id).maybeSingle()
                    : supabase.from('agency_tracking_visits').select('id, device_type, browser, os').eq('session_id', session.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                const { data: visitData } = await visitQuery;
                if (visitData) {
                    deviceInfo = {
                        visit_id: visitData.id,
                        device_type: visitData.device_type,
                        browser: visitData.browser,
                        os: visitData.os
                    };
                }
            } catch (e) {
                console.error('Failed to fetch visit device info:', e);
            }
        }

        const conversionData = {
            agency_id: session.agency_id,
            tracking_link_id: session.tracking_link_id,
            visit_id: deviceInfo.visit_id || session.visit_id || null,
            session_id: session.id,
            user_id: userId,
            line_user_id: lineUserId,
            line_display_name: lineDisplayName,
            device_type: deviceInfo.device_type || null,
            browser: deviceInfo.browser || null,
            os: deviceInfo.os || null,
            conversion_type: 'line_friend',
            conversion_value: 0, // LINE friend has no direct monetary value
            metadata: {
                session_metadata: session.metadata,
                utm_source: session.utm_source,
                utm_medium: session.utm_medium,
                utm_campaign: session.utm_campaign
            }
        };

        const { error: conversionError } = await supabase
            .from('agency_conversions')
            .insert([conversionData]);

        if (conversionError) {
            console.error('Error creating agency LINE conversion:', conversionError);
        } else {
            console.log(`LINE friend conversion recorded for agency ${session.agency_id}`);

            // Update tracking link conversion count
            if (session.tracking_link_id) {
                const { data: linkData } = await supabase
                    .from('agency_tracking_links')
                    .select('conversion_count')
                    .eq('id', session.tracking_link_id)
                    .single();

                await supabase
                    .from('agency_tracking_links')
                    .update({
                        conversion_count: (linkData?.conversion_count || 0) + 1
                    })
                    .eq('id', session.tracking_link_id);
            }

            // Send notification to agency (future enhancement)
            await notifyAgencyOfConversion(session.agency_id, 'line_friend', conversionData);
        }

    } catch (error) {
        console.error('Error creating agency LINE conversion:', error);
    }
}

// Notify agency of new conversion (placeholder for future implementation)
async function notifyAgencyOfConversion(agencyId, conversionType, conversionData) {
    try {
        // This could send email notifications, webhook calls, etc.
        console.log(`Notification: Agency ${agencyId} has new ${conversionType} conversion`);

        // For now, just log the event
        // Future implementation could include:
        // - Email notifications
        // - Slack/Discord webhooks
        // - Real-time dashboard updates
        // - SMS notifications for high-value conversions

    } catch (error) {
        console.error('Error sending agency notification:', error);
    }
}

// Send welcome message to new user
async function sendWelcomeMessage(userId, displayName) {
    try {
        const message = {
            type: 'text',
            text: `こんにちは${displayName}さん！\n\nTaskMate AIの公式LINEアカウントにご登録いただき、ありがとうございます。\n\nTaskMate AIは、あなたの日常業務を効率化するAIアシスタントです。何かご質問がございましたら、お気軽にメッセージをお送りください。\n\nよろしくお願いいたします！`
        };

        await sendLineMessage(userId, message);
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
}

// Handle text messages
async function handleTextMessage(userId, text) {
    // ⚠️ Netlify側ではメッセージ返信を完全に無効化（Render側のみが返信）
    console.log('⚠️ handleTextMessage called but disabled (Netlify side)');
    return;

    try {
        // Simple auto-response logic
        let response = '';

        if (text.includes('こんにちは') || text.includes('こんばんは')) {
            response = 'こんにちは！TaskMate AIです。どのようなことでお手伝いできますか？';
        } else if (text.includes('ありがとう')) {
            response = 'どういたしまして！他にもご質問がございましたら、お気軽にお聞かせください。';
        } else if (text.includes('機能') || text.includes('できること')) {
            response = 'TaskMate AIは以下のようなことができます：\n\n• タスク管理\n• スケジュール調整\n• メモの管理\n• リマインダー設定\n\n詳しくは https://taskmateai.net をご覧ください！';
        } else {
            response = 'メッセージをありがとうございます！現在、より良いサービスを提供するための準備を進めております。\n\n詳しい機能については、近日中にお知らせいたします。今後ともよろしくお願いいたします。';
        }

        if (response) {
            await sendLineMessage(userId, {
                type: 'text',
                text: response
            });
        }
    } catch (error) {
        console.error('Error handling text message:', error);
    }
}

// Send message via LINE Messaging API
async function sendLineMessage(userId, message) {
    // ⚠️ Netlify側ではメッセージ送信を完全に無効化（Render側のみが送信）
    console.log('⚠️ sendLineMessage called but disabled (Netlify side)');
    return;

    try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: userId,
                messages: [message]
            })
        });

        if (!response.ok) {
            console.error('Failed to send LINE message:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error sending LINE message:', error);
    }
}

// 🆕 Send agency registration welcome message
async function sendAgencyPendingMessage(userId, agency) {
    // ⚠️ Netlify側ではメッセージ送信を完全に無効化（Render側のみが送信）
    console.log('⚠️ sendAgencyPendingMessage called but disabled (Netlify side)');
    console.log(`代理店: ${agency.name} (${agency.code}) - LINE友達追加完了、管理者承認待ち`);
    return;
}

async function sendAgencyWelcomeMessage(userId, agency) {
    // ⚠️ Netlify側ではメッセージ送信を完全に無効化（Render側のみが送信）
    console.log('⚠️ sendAgencyWelcomeMessage called but disabled (Netlify side)');
    return;

    try {
        console.log('代理店ウェルカムメッセージ送信開始:', agency.name);

        const welcomeMessage = {
            type: 'flex',
            altText: '✅ LINE連携が完了しました！',
            contents: {
                type: 'bubble',
                hero: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '✅',
                            size: '4xl',
                            align: 'center',
                            weight: 'bold',
                            color: '#10b981'
                        }
                    ],
                    backgroundColor: '#f0fdf4',
                    paddingAll: '20px'
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: 'LINE連携完了',
                            weight: 'bold',
                            size: 'xl',
                            color: '#1f2937'
                        },
                        {
                            type: 'text',
                            text: 'TaskMate AI パートナー登録',
                            size: 'sm',
                            color: '#6b7280',
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'xl'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            margin: 'lg',
                            spacing: 'sm',
                            contents: [
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '代理店名',
                                            color: '#6b7280',
                                            size: 'sm',
                                            flex: 2
                                        },
                                        {
                                            type: 'text',
                                            text: agency.name,
                                            wrap: true,
                                            color: '#111827',
                                            size: 'sm',
                                            flex: 5,
                                            weight: 'bold'
                                        }
                                    ]
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '代理店コード',
                                            color: '#6b7280',
                                            size: 'sm',
                                            flex: 2
                                        },
                                        {
                                            type: 'text',
                                            text: agency.code,
                                            wrap: true,
                                            color: '#10b981',
                                            size: 'md',
                                            flex: 5,
                                            weight: 'bold'
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            type: 'separator',
                            margin: 'xl'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            margin: 'lg',
                            spacing: 'sm',
                            contents: [
                                {
                                    type: 'text',
                                    text: '🎉 次のステップ',
                                    weight: 'bold',
                                    color: '#111827',
                                    margin: 'md'
                                },
                                {
                                    type: 'text',
                                    text: '1. ダッシュボードにログイン\n2. トラッキングリンクを作成\n3. お客様に共有して報酬GET!',
                                    wrap: true,
                                    color: '#4b5563',
                                    size: 'sm',
                                    margin: 'md'
                                }
                            ]
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'uri',
                                label: 'ダッシュボードへ',
                                uri: 'https://taskmateai.net/agency/'
                            },
                            color: '#10b981'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            contents: [],
                            margin: 'sm'
                        }
                    ],
                    flex: 0
                }
            }
        };

        await sendLineMessage(userId, welcomeMessage);
        console.log('✅ 代理店ウェルカムメッセージ送信成功');

    } catch (error) {
        console.error('❌ 代理店ウェルカムメッセージ送信失敗:', error);
    }
}

// ========================================
// ヘルパー関数
// ========================================

// デバイスタイプ判定（User-Agentから）
function getUserDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    if (/bot/i.test(userAgent)) return 'bot';
    return 'desktop';
}

// Validate environment variables on cold start
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

// Forward LINE webhook to Render (TaskMate AI)
async function forwardToRender(body, signature) {
    const renderWebhookUrl = process.env.RENDER_WEBHOOK_URL || 'https://gasgenerator.onrender.com/api/webhook';

    if (!renderWebhookUrl) {
        console.log('⚠️ RENDER_WEBHOOK_URL not configured, skipping forward to Render');
        return;
    }

    try {
        console.log('📤 [v2.0] Forwarding to Render TaskMate AI:', renderWebhookUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for Render wake-up

        const response = await fetch(renderWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Line-Signature': signature,
                'X-Forwarded-From': 'netlify'  // 無限ループ防止フラグ
            },
            body: body,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn('⚠️ Render forward failed with status:', response.status);
        } else {
            console.log('✅ Render forward successful');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('⏱️ Render forward timeout (30s) - Render may be sleeping');
        } else {
            console.error('❌ Render forward error:', error.message);
        }
    }
}

if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('Missing LINE environment variables: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN');
}