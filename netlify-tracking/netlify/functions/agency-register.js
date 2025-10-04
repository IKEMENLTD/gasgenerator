const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
        console.log('Registration request received');

        // Check if Supabase is configured
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'システム設定エラー：環境変数が設定されていません'
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

        console.log('Parsed request data for email:', email);

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
                    error: 'このメールアドレスは既に登録されています'
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
                status: 'pending', // 新規登録は承認待ちに設定
                commission_rate: 10.00, // デフォルト手数料率
                settings: {},
                payment_info: {}
            })
            .select()
            .single();

        if (agencyError) {
            console.error('Agency creation error:', agencyError);
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
                is_active: false // 代理店承認待ちのため非アクティブに設定
            })
            .select()
            .single();

        if (userError) {
            console.error('User creation error:', userError);
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
        console.error('Registration error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // More specific error messages
        let errorMessage = '登録処理中にエラーが発生しました。';

        if (error.message?.includes('SUPABASE')) {
            errorMessage = 'データベース接続エラーが発生しました。';
        } else if (error.message?.includes('bcrypt')) {
            errorMessage = 'パスワード処理中にエラーが発生しました。';
        } else if (error.message?.includes('duplicate')) {
            errorMessage = 'このメールアドレスは既に登録されています。';
        }

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