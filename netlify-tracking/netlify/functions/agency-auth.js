const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { validateCsrfProtection, createCsrfErrorResponse, getSecureCookieOptions } = require('./utils/csrf-protection');
const { applyRateLimit, STRICT_RATE_LIMIT } = require('./utils/rate-limiter');
const logger = require('./utils/logger');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'X-Content-Type-Options': 'nosniff'
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

    // レート制限チェック（ブルートフォース攻撃対策）
    const rateLimitResponse = applyRateLimit(event, STRICT_RATE_LIMIT);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    // CSRF保護チェック
    const csrfValidation = validateCsrfProtection(event);
    if (!csrfValidation.valid) {
        return createCsrfErrorResponse(csrfValidation.error);
    }

    try {
        const { email, password } = JSON.parse(event.body);

        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'メールアドレスとパスワードを入力してください'
                })
            };
        }

        // Find agency user
        logger.log('Looking for user with email:', email);

        const { data: user, error: userError } = await supabase
            .from('agency_users')
            .select(`
                id,
                email,
                password_hash,
                name,
                role,
                is_active,
                agency_id,
                agencies!inner (
                    id,
                    code,
                    name,
                    company_name,
                    contact_email,
                    contact_phone,
                    status,
                    level,
                    own_commission_rate,
                    parent_agency_id
                )
            `)
            .eq('email', email)
            .single();

        logger.log('User query result:', { user, error: userError });

        if (userError || !user) {
            logger.error('User not found or error:', userError);
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: 'メールアドレスまたはパスワードが間違っています',
                    details: userError?.message
                })
            };
        }

        // Verify password
        logger.log('Comparing password...');
        const validPassword = await bcrypt.compare(password, user.password_hash);
        logger.log('Password valid:', validPassword);

        if (!validPassword) {
            logger.error('Invalid password');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: 'メールアドレスまたはパスワードが間違っています'
                })
            };
        }

        // Check if user account is active
        // セキュリティ上の理由により、具体的な理由は表示しない（ユーザー列挙攻撃対策）
        if (!user.is_active || user.agencies.status !== 'active') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: 'メールアドレスまたはパスワードが間違っています'
                })
            };
        }

        // Update last login
        await supabase
            .from('agency_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id);

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                agencyId: user.agency_id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET || 'your-jwt-secret',
            { expiresIn: '7d' }
        );

        // セキュアなCookie設定を取得
        const cookieOptions = getSecureCookieOptions();

        // HttpOnly Cookieでトークンを設定（セキュリティ強化）
        const setCookieHeaders = [
            `agencyAuthToken=${token}; ${cookieOptions}`,
            `agencyId=${user.agency_id}; ${cookieOptions.replace('HttpOnly; ', '')}`  // agencyIdはJSからアクセス可能に
        ];

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Set-Cookie': setCookieHeaders.join(', ')
            },
            body: JSON.stringify({
                success: true,
                // 下位互換性のためにtokenも返すが、推奨はCookieを使用
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                agency: {
                    id: user.agencies.id,
                    code: user.agencies.code,
                    name: user.agencies.name,
                    company_name: user.agencies.company_name,
                    contact_email: user.agencies.contact_email,
                    contact_phone: user.agencies.contact_phone,
                    // 4段階代理店制度の情報
                    level: user.agencies.level,
                    own_commission_rate: user.agencies.own_commission_rate,
                    parent_agency_id: user.agencies.parent_agency_id
                }
            })
        };
    } catch (error) {
        logger.error('Authentication error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'サーバーエラーが発生しました'
            })
        };
    }
};