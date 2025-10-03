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

// Link user to recent tracking visit
async function linkUserToTracking(lineUserId, userId) {
    try {
        // Find recent tracking visits (within last hour) that don't have a linked LINE user
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data: recentVisits, error } = await supabase
            .from('tracking_visits')
            .select('*')
            .is('line_user_id', null)
            .gte('visited_at', oneHourAgo)
            .order('visited_at', { ascending: false })
            .limit(5); // Check last 5 unlinked visits

        if (error || !recentVisits || recentVisits.length === 0) {
            return;
        }

        // Link the most recent visit to this user
        const { error: updateError } = await supabase
            .from('tracking_visits')
            .update({ line_user_id: userId })
            .eq('id', recentVisits[0].id);

        if (!updateError) {
            console.log(`Linked LINE user ${lineUserId} to visit ${recentVisits[0].id}`);
        }
    } catch (error) {
        console.error('Error linking user to tracking:', error);
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