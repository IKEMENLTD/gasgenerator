const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
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

        // Process each event
        for (const event of events) {
            await processLineEvent(event);
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
async function processLineEvent(event) {
    try {
        switch (event.type) {
            case 'follow':
                await handleFollowEvent(event);
                break;
            case 'unfollow':
                await handleUnfollowEvent(event);
                break;
            case 'message':
                await handleMessageEvent(event);
                break;
            default:
                console.log('Unhandled event type:', event.type);
        }
    } catch (error) {
        console.error('Error processing LINE event:', error);
    }
}

// Handle follow events (user adds bot as friend)
async function handleFollowEvent(event) {
    const userId = event.source.userId;

    try {
        // Get user profile from LINE API
        const userProfile = await getLineUserProfile(userId);

        if (!userProfile) {
            console.error('Failed to get user profile for:', userId);
            return;
        }

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('line_users')
            .select('*')
            .eq('line_user_id', userId)
            .single();

        if (existingUser) {
            // Update existing user
            const { error } = await supabase
                .from('line_users')
                .update({
                    display_name: userProfile.displayName,
                    picture_url: userProfile.pictureUrl,
                    status_message: userProfile.statusMessage,
                    is_friend: true,
                    last_activity: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('line_user_id', userId);

            if (error) {
                console.error('Error updating existing user:', error);
            }
        } else {
            // Create new user record
            const userData = {
                line_user_id: userId,
                display_name: userProfile.displayName,
                picture_url: userProfile.pictureUrl,
                status_message: userProfile.statusMessage,
                is_friend: true,
                created_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
            };

            const { data: newUser, error } = await supabase
                .from('line_users')
                .insert([userData])
                .select()
                .single();

            if (error) {
                console.error('Error creating user:', error);
                return;
            }

            // Try to link with recent tracking visit
            await linkUserToTracking(userId, newUser.id);
        }

        // Send welcome message
        await sendWelcomeMessage(userId, userProfile.displayName);

    } catch (error) {
        console.error('Error handling follow event:', error);
    }
}

// Handle unfollow events (user removes bot as friend)
async function handleUnfollowEvent(event) {
    const userId = event.source.userId;

    try {
        const { error } = await supabase
            .from('line_users')
            .update({
                is_friend: false,
                updated_at: new Date().toISOString()
            })
            .eq('line_user_id', userId);

        if (error) {
            console.error('Error updating user unfollow status:', error);
        }
    } catch (error) {
        console.error('Error handling unfollow event:', error);
    }
}

// Handle message events
async function handleMessageEvent(event) {
    const userId = event.source.userId;

    try {
        // Update user's last activity
        await supabase
            .from('line_users')
            .update({
                last_activity: new Date().toISOString()
            })
            .eq('line_user_id', userId);

        // Process message based on type and content
        if (event.message.type === 'text') {
            await handleTextMessage(userId, event.message.text);
        }
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
async function linkUserToTracking(lineUserId, userId) {
    try {
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
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data: recentVisits, error } = await supabase
            .from('tracking_visits')
            .select('*')
            .is('line_user_id', null)
            .gte('visited_at', oneHourAgo)
            .order('visited_at', { ascending: false })
            .limit(5);

        if (error || !recentVisits || recentVisits.length === 0) {
            return null;
        }

        // Link the most recent visit to this user
        const { error: updateError } = await supabase
            .from('tracking_visits')
            .update({ line_user_id: userId })
            .eq('id', recentVisits[0].id);

        if (!updateError) {
            console.log(`Linked LINE user ${lineUserId} to visit ${recentVisits[0].id}`);
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
            .single();

        if (existingConversion) {
            return; // Already recorded
        }

        // Get agency information for commission calculation
        const { data: agency } = await supabase
            .from('agencies')
            .select('commission_rate')
            .eq('id', session.agency_id)
            .single();

        const conversionData = {
            agency_id: session.agency_id,
            tracking_link_id: session.tracking_link_id,
            visit_id: session.visit_id,
            session_id: session.id,
            user_id: userId,
            line_user_id: lineUserId,
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
                await supabase
                    .from('agency_tracking_links')
                    .update({
                        conversion_count: supabase.raw('conversion_count + 1')
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

// Validate environment variables on cold start
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
}

if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('Missing LINE environment variables: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN');
}