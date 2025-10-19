const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@line/bot-sdk');
const { validateCsrfProtection, createCsrfErrorResponse } = require('./utils/csrf-protection');
const { applyRateLimit, STRICT_RATE_LIMIT } = require('./utils/rate-limiter');
const logger = require('./utils/logger');

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

if (!process.env.LINE_LOGIN_CHANNEL_ID || !process.env.LINE_LOGIN_CHANNEL_SECRET) {
    logger.error('Missing required LINE environment variables: LINE_LOGIN_CHANNEL_ID or LINE_LOGIN_CHANNEL_SECRET');
}

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Exchange LINE authorization code for access token
async function getLineAccessToken(code, redirectUri) {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET
    });

    const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('LINE token exchange failed:', errorText);
        throw new Error('Failed to get LINE access token');
    }

    return await response.json();
}

// Get LINE user profile
async function getLineProfile(accessToken) {
    const response = await fetch('https://api.line.me/v2/profile', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('LINE profile fetch failed:', errorText);
        throw new Error('Failed to get LINE profile');
    }

    return await response.json();
}

exports.handler = async (event) => {
    // Strict CORS configuration
    const ALLOWED_ORIGINS = [
        'https://taskmateai.net',
        'http://localhost:3000',
        'http://localhost:8888'  // Netlify Dev
    ];

    const origin = event.headers.origin || event.headers.Origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    const headers = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
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

    // Rate limiting (防止DoS攻撃)
    logger.log('=== LINE連携完了処理開始 ===');
    logger.log('IPアドレス:', event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown');

    const rateLimitResponse = applyRateLimit(event, STRICT_RATE_LIMIT);
    if (rateLimitResponse) {
        logger.error('❌ レート制限により拒否されました');
        return { ...rateLimitResponse, headers };
    }
    logger.log('✅ レート制限チェック通過');

    // CSRF protection
    const csrfValidation = validateCsrfProtection(event);
    if (!csrfValidation.valid) {
        logger.error('❌ CSRF検証失敗:', csrfValidation.error);
        logger.error('Origin:', event.headers.origin);
        logger.error('Referer:', event.headers.referer);
        const csrfError = createCsrfErrorResponse(csrfValidation.error);
        return { ...csrfError, headers };
    }
    logger.log('✅ CSRF保護チェック通過');

    try {

        // Check if environment variables are configured
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'サービスが一時的に利用できません。しばらくしてから再度お試しください。'
                })
            };
        }

        if (!process.env.LINE_LOGIN_CHANNEL_ID || !process.env.LINE_LOGIN_CHANNEL_SECRET) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'LINE連携の設定が完了していません。管理者にお問い合わせください。'
                })
            };
        }

        const {
            code,
            registration_token,
            redirect_uri
        } = JSON.parse(event.body);

        logger.log('受信したデータ:');
        logger.log('- LINEコード:', code ? 'あり' : 'なし');
        logger.log('- 登録トークン:', registration_token ? registration_token.substring(0, 8) + '...' : 'なし');
        logger.log('- リダイレクトURI:', redirect_uri);

        // Validate required fields
        if (!code || !registration_token || !redirect_uri) {
            logger.error('❌ 必須パラメータが不足しています');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '必須パラメータが不足しています'
                })
            };
        }

        // Validate redirect_uri (防止Open Redirect攻撃)
        const ALLOWED_CALLBACK_URLS = [
            'https://taskmateai.net/agency/',
            'http://localhost:3000/agency/',
            'http://localhost:8888/agency/',
            process.env.LINE_LOGIN_CALLBACK_URL
        ].filter(Boolean);

        const isValidRedirectUri = ALLOWED_CALLBACK_URLS.some(allowedUrl => {
            return redirect_uri === allowedUrl || redirect_uri.startsWith(allowedUrl);
        });

        if (!isValidRedirectUri) {
            logger.error('❌ 不正なリダイレクトURI:', redirect_uri);
            logger.error('許可されたURL:', ALLOWED_CALLBACK_URLS);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '不正なリダイレクトURIです'
                })
            };
        }
        logger.log('✅ リダイレクトURI検証通過');

        // Find agency by registration token
        logger.log('=== STEP 1: 登録トークン検証 ===');
        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('id, code, name, status, registration_token, line_user_id, registration_token_expires_at')
            .eq('registration_token', registration_token)
            .eq('status', 'pending_line_verification')
            .single();

        if (agencyError || !agency) {
            logger.error('❌ 登録トークンが無効です');
            logger.error('- トークン:', registration_token.substring(0, 8) + '...');
            logger.error('- Supabaseエラー:', agencyError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '登録トークンが無効です。最初から登録をやり直してください。'
                })
            };
        }

        logger.log('✅ 代理店レコード発見');
        logger.log('- 代理店ID:', agency.id);
        logger.log('- 代理店名:', agency.name);

        // Check if LINE verification is already completed (防止Code Replay攻撃)
        if (agency.line_user_id) {
            logger.error('❌ この代理店は既にLINE連携済みです');
            logger.error('- LINE User ID:', agency.line_user_id.substring(0, 8) + '...');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'この代理店は既にLINE連携済みです'
                })
            };
        }

        // Check token expiration (if registration_token_expires_at exists)
        if (agency.registration_token_expires_at) {
            const expiresAt = new Date(agency.registration_token_expires_at);
            const now = new Date();
            if (expiresAt < now) {
                logger.error('❌ 登録トークンの有効期限が切れています');
                logger.error('- 有効期限:', expiresAt.toISOString());
                logger.error('- 現在時刻:', now.toISOString());
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: '登録トークンの有効期限が切れています。最初から登録をやり直してください。'
                    })
                };
            }
            logger.log('✅ トークン有効期限チェック通過');
        }

        // Exchange LINE code for access token
        logger.log('=== STEP 2: LINEアクセストークン取得 ===');
        const tokenData = await getLineAccessToken(code, redirect_uri);
        logger.log('✅ アクセストークン取得成功');

        // Get LINE user profile
        logger.log('=== STEP 3: LINEプロフィール取得 ===');
        const profile = await getLineProfile(tokenData.access_token);
        logger.log('✅ LINEプロフィール取得成功');
        logger.log('- LINE User ID:', profile.userId);
        logger.log('- 表示名:', profile.displayName);

        // Check if LINE user ID is already registered
        logger.log('=== STEP 4: LINE ID重複チェック ===');
        const { data: existingAgency } = await supabase
            .from('agencies')
            .select('id')
            .eq('line_user_id', profile.userId)
            .neq('id', agency.id)
            .single();

        if (existingAgency) {
            logger.error('❌ このLINEアカウントは既に使用されています');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'このLINEアカウントは既に他の代理店で使用されています。'
                })
            };
        }
        logger.log('✅ LINE ID使用可能');

        // Update agency with LINE information and activate (トランザクション処理)
        logger.log('=== STEP 5: 代理店レコード更新 ===');
        const { error: updateError } = await supabase
            .from('agencies')
            .update({
                line_user_id: profile.userId,
                line_display_name: profile.displayName,
                line_picture_url: profile.pictureUrl,
                status: 'active',
                registration_token: null, // Clear token after use
                registration_token_expires_at: null
            })
            .eq('id', agency.id);

        if (updateError) {
            logger.error('❌ 代理店レコード更新エラー:', updateError);
            throw updateError;
        }
        logger.log('✅ 代理店レコード更新成功');

        // Activate agency user (エラー時はロールバック)
        logger.log('=== STEP 6: ユーザーアクティベーション ===');
        try {
            const { error: userUpdateError } = await supabase
                .from('agency_users')
                .update({
                    is_active: true
                })
                .eq('agency_id', agency.id)
                .eq('role', 'owner');

            if (userUpdateError) {
                logger.error('❌ ユーザーアクティベーションエラー:', userUpdateError);

                // Rollback: 代理店を元の状態に戻す
                logger.log('🔄 ロールバック: 代理店を元の状態に戻します');
                await supabase
                    .from('agencies')
                    .update({
                        line_user_id: null,
                        line_display_name: null,
                        line_picture_url: null,
                        status: 'pending_line_verification',
                        registration_token: agency.registration_token,
                        registration_token_expires_at: agency.registration_token_expires_at
                    })
                    .eq('id', agency.id);

                throw userUpdateError;
            }
            logger.log('✅ ユーザーアクティベーション成功');
        } catch (userError) {
            logger.error('❌ ユーザーアクティベーション失敗、ロールバック完了');
            throw userError;
        }

        // Send LINE welcome message (既存友達でも新規友達でも送信可能)
        logger.log('=== STEP 7: LINE連携完了メッセージ送信 ===');
        try {
            if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
                const lineClient = new Client({
                    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
                });

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

                // Push message（既存友達でも新規友達でも送信可能）
                await lineClient.pushMessage(profile.userId, welcomeMessage);
                logger.log('✅ LINE連携完了メッセージ送信成功');
                logger.log('- 送信先LINE User ID:', profile.userId.substring(0, 8) + '...');
            } else {
                logger.log('⚠️ LINE_CHANNEL_ACCESS_TOKENが未設定のため、メッセージ送信をスキップ');
            }
        } catch (lineError) {
            // LINEメッセージ送信失敗は致命的エラーではないので、ログのみ
            logger.error('⚠️ LINEメッセージ送信に失敗（登録自体は成功）:', lineError.message);
        }

        logger.log('=== ✅✅✅ LINE連携完了 ✅✅✅ ===');
        logger.log('代理店コード:', agency.code);
        logger.log('代理店ID:', agency.id);
        logger.log('LINE User ID:', profile.userId.substring(0, 8) + '...');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: '登録が完了しました',
                agency: {
                    code: agency.code,
                    name: agency.name
                },
                line_user_name: profile.displayName
            })
        };

    } catch (error) {
        logger.error('=== ❌❌❌ LINE連携完了処理でエラーが発生 ❌❌❌ ===');
        logger.error('エラータイプ:', error.name);
        logger.error('エラーメッセージ:', error.message);
        logger.error('エラー詳細:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // Security: Never expose detailed error information in production
        const errorMessage = 'LINE連携処理を完了できませんでした。しばらくしてから再度お試しください。';

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: errorMessage
                // 本番環境では絶対にdetailsを含めない
            })
        };
    }
};
