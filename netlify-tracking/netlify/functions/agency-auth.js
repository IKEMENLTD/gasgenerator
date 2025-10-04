const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
        console.log('Looking for user with email:', email);

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
                    commission_rate,
                    status
                )
            `)
            .eq('email', email)
            .single();

        console.log('User query result:', { user, error: userError });

        if (userError || !user) {
            console.error('User not found or error:', userError);
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
        console.log('Comparing password...');
        const validPassword = await bcrypt.compare(password, user.password_hash);
        console.log('Password valid:', validPassword);

        if (!validPassword) {
            console.error('Invalid password');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: 'メールアドレスまたはパスワードが間違っています'
                })
            };
        }

        // Check if user account is active
        if (!user.is_active) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    error: 'このユーザーアカウントは無効です。管理者にお問い合わせください。'
                })
            };
        }

        // Check if agency is active
        if (user.agencies.status !== 'active') {
            let errorMessage = 'このアカウントは現在利用できません';
            if (user.agencies.status === 'pending') {
                errorMessage = 'このアカウントは承認待ちです。管理者の承認をお待ちください。';
            } else if (user.agencies.status === 'rejected') {
                errorMessage = 'このアカウントの申請は承認されませんでした。';
            } else if (user.agencies.status === 'suspended') {
                errorMessage = 'このアカウントは一時停止中です。';
            }

            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    error: errorMessage
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

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
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
                    commission_rate: user.agencies.commission_rate
                }
            })
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'サーバーエラーが発生しました'
            })
        };
    }
};