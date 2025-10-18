const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { validateCsrfProtection, createCsrfErrorResponse } = require('./utils/csrf-protection');
const { applyRateLimit, STRICT_RATE_LIMIT } = require('./utils/rate-limiter');
const logger = require('./utils/logger');

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Generate unique agency code
function generateAgencyCode() {
    const prefix = 'AG';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
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

    // レート制限チェック（スパム登録攻撃対策）
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
        logger.log('Registration request received');

        // Check if Supabase is configured
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'サービスが一時的に利用できません。しばらくしてから再度お試しください。'
                })
            };
        }

        const {
            company_name,
            agency_name,
            address,
            contact_name,
            email,
            phone,
            password
        } = JSON.parse(event.body);

        logger.log('Parsed request data for email:', email);

        // Validate required fields
        if (!company_name || !agency_name || !contact_name || !email || !phone || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '必須項目を入力してください'
                })
            };
        }

        // Validate password length
        if (password.length < 8) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'パスワードは8文字以上で入力してください'
                })
            };
        }

        // Check if email already exists
        // セキュリティ上の理由により、メール存在を明示しない（ユーザー列挙攻撃対策）
        const { data: existingUser } = await supabase
            .from('agency_users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '登録処理を完了できませんでした。入力内容を確認してください。'
                })
            };
        }

        // Generate unique agency code
        let agencyCode = generateAgencyCode();
        let codeIsUnique = false;
        let attempts = 0;

        while (!codeIsUnique && attempts < 5) {
            const { data: existingAgency } = await supabase
                .from('agencies')
                .select('id')
                .eq('code', agencyCode)
                .single();

            if (!existingAgency) {
                codeIsUnique = true;
            } else {
                agencyCode = generateAgencyCode();
                attempts++;
            }
        }

        if (!codeIsUnique) {
            throw new Error('Failed to generate unique agency code');
        }

        // Create agency
        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .insert({
                code: agencyCode,
                name: agency_name,
                company_name: company_name,
                contact_email: email,
                contact_phone: phone,
                address: address,
                status: 'active', // 新規登録を自動承認に変更
                commission_rate: 10.00, // デフォルト手数料率
                settings: {},
                payment_info: {}
            })
            .select()
            .single();

        if (agencyError) {
            logger.error('Agency creation error:', agencyError);
            throw agencyError;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create agency user
        const { data: agencyUser, error: userError } = await supabase
            .from('agency_users')
            .insert({
                agency_id: agency.id,
                email: email,
                password_hash: hashedPassword,
                name: contact_name,
                role: 'owner',
                is_active: true // 新規登録を自動承認に変更（すぐにログイン可能）
            })
            .select()
            .single();

        if (userError) {
            logger.error('User creation error:', userError);
            // Rollback agency creation
            await supabase
                .from('agencies')
                .delete()
                .eq('id', agency.id);
            throw userError;
        }

        // Send welcome email (optional - implement if needed)
        // await sendWelcomeEmail(email, contact_name, agency_name);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: '登録が完了しました',
                agency_code: agencyCode
            })
        };

    } catch (error) {
        logger.error('Registration error:', error);
        logger.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // セキュリティ上の理由により、詳細なエラー情報は返さない
        const errorMessage = '登録処理を完了できませんでした。しばらくしてから再度お試しください。';

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};