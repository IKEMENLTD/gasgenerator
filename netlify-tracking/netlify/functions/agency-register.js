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
    logger.log('=== 登録リクエスト受信 ===');
    logger.log('IPアドレス:', event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown');
    logger.log('User-Agent:', event.headers['user-agent']);

    const rateLimitResponse = applyRateLimit(event, STRICT_RATE_LIMIT);
    if (rateLimitResponse) {
        logger.error('❌ レート制限により拒否されました');
        return rateLimitResponse;
    }
    logger.log('✅ レート制限チェック通過');

    // CSRF保護チェック
    const csrfValidation = validateCsrfProtection(event);
    if (!csrfValidation.valid) {
        logger.error('❌ CSRF検証失敗:', csrfValidation.error);
        logger.error('Origin:', event.headers.origin);
        logger.error('Referer:', event.headers.referer);
        return createCsrfErrorResponse(csrfValidation.error);
    }
    logger.log('✅ CSRF保護チェック通過');

    try {
        logger.log('=== 登録処理開始 ===');

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
            password,
            invitation_code
        } = JSON.parse(event.body);

        logger.log('受信したデータ:');
        logger.log('- 会社名:', company_name);
        logger.log('- 代理店名:', agency_name);
        logger.log('- 住所:', address);
        logger.log('- 担当者名:', contact_name);
        logger.log('- メールアドレス:', email);
        logger.log('- 電話番号:', phone);
        logger.log('- パスワード長:', password ? password.length : 0);
        logger.log('- 招待コード:', invitation_code);

        // Validate required fields
        logger.log('=== STEP 0: 必須項目チェック ===');
        const missingFields = [];
        if (!company_name) missingFields.push('会社名');
        if (!agency_name) missingFields.push('代理店名');
        if (!contact_name) missingFields.push('担当者名');
        if (!email) missingFields.push('メールアドレス');
        if (!phone) missingFields.push('電話番号');
        if (!password) missingFields.push('パスワード');
        if (!invitation_code) missingFields.push('招待コード');

        if (missingFields.length > 0) {
            logger.error('❌ 必須項目が入力されていません');
            logger.error('未入力の項目:', missingFields.join(', '));
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '必須項目を入力してください'
                })
            };
        }
        logger.log('✅ 必須項目チェック通過');

        // Validate password length
        logger.log('パスワード長チェック:', password.length, '文字');
        if (password.length < 8) {
            logger.error('❌ パスワードが短すぎます:', password.length, '文字');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'パスワードは8文字以上で入力してください'
                })
            };
        }
        logger.log('✅ パスワード長チェック通過');

        // Validate invitation code
        logger.log('=== STEP 1: 招待コード検証開始 ===');
        logger.log('招待コード:', invitation_code);
        const { data: invitationLink, error: invitationError } = await supabase
            .from('agency_tracking_links')
            .select('id, agency_id, is_active')
            .eq('tracking_code', invitation_code)
            .single();

        logger.log('Supabaseクエリ結果:');
        logger.log('- invitationLink:', invitationLink);
        logger.log('- invitationError:', invitationError);

        if (invitationError || !invitationLink) {
            logger.error('❌ 招待コードが見つかりません');
            logger.error('- 入力された招待コード:', invitation_code);
            logger.error('- Supabaseエラー:', invitationError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '招待コードが無効です。代理店から正しい招待コードを取得してください。'
                })
            };
        }

        logger.log('✅ 招待コードが見つかりました');
        logger.log('- ID:', invitationLink.id);
        logger.log('- Agency ID:', invitationLink.agency_id);
        logger.log('- is_active:', invitationLink.is_active);

        if (!invitationLink.is_active) {
            logger.error('❌ 招待コードが無効化されています');
            logger.error('- 招待コード:', invitation_code);
            logger.error('- is_active:', invitationLink.is_active);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'この招待コードは現在無効です。代理店にお問い合わせください。'
                })
            };
        }

        logger.log('✅ 招待コード検証完了 - 有効なコードです');

        // Check if email already exists
        // セキュリティ上の理由により、メール存在を明示しない（ユーザー列挙攻撃対策）
        logger.log('=== STEP 2: メールアドレス重複チェック ===');
        logger.log('チェックするメールアドレス:', email);
        const { data: existingUser } = await supabase
            .from('agency_users')
            .select('id')
            .eq('email', email)
            .single();

        logger.log('メール重複チェック結果:');
        logger.log('- existingUser:', existingUser ? 'メールアドレスは既に使用されています' : 'メールアドレスは使用可能です');

        if (existingUser) {
            logger.error('❌ メールアドレスが既に登録されています');
            logger.error('- メールアドレス:', email);
            logger.error('- 既存ユーザーID:', existingUser.id);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: '登録処理を完了できませんでした。入力内容を確認してください。'
                })
            };
        }

        logger.log('✅ メールアドレスは使用可能です');

        // Generate unique agency code
        logger.log('=== STEP 3: 代理店コード生成 ===');
        let agencyCode = generateAgencyCode();
        let codeIsUnique = false;
        let attempts = 0;

        while (!codeIsUnique && attempts < 5) {
            logger.log('代理店コード生成試行:', attempts + 1, '回目 -', agencyCode);
            const { data: existingAgency } = await supabase
                .from('agencies')
                .select('id')
                .eq('code', agencyCode)
                .single();

            if (!existingAgency) {
                codeIsUnique = true;
                logger.log('✅ ユニークな代理店コードを生成:', agencyCode);
            } else {
                logger.log('⚠️  代理店コードが重複、再生成します');
                agencyCode = generateAgencyCode();
                attempts++;
            }
        }

        if (!codeIsUnique) {
            logger.error('❌ ユニークな代理店コードの生成に失敗');
            throw new Error('Failed to generate unique agency code');
        }

        // Create agency
        logger.log('=== STEP 4: 代理店レコード作成 ===');
        logger.log('代理店コード:', agencyCode);
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
            logger.error('❌ 代理店レコード作成エラー:', agencyError);
            logger.error('エラー詳細:', {
                message: agencyError.message,
                code: agencyError.code,
                details: agencyError.details
            });
            throw agencyError;
        }
        logger.log('✅ 代理店レコード作成成功 - ID:', agency.id);

        // Hash password
        logger.log('=== STEP 5: パスワードハッシュ化 ===');
        const hashedPassword = await bcrypt.hash(password, 10);
        logger.log('✅ パスワードハッシュ化完了');

        // Create agency user
        logger.log('=== STEP 6: ユーザーレコード作成 ===');
        logger.log('メールアドレス:', email);
        logger.log('代理店ID:', agency.id);
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
            logger.error('❌ ユーザーレコード作成エラー:', userError);
            logger.error('エラー詳細:', {
                message: userError.message,
                code: userError.code,
                details: userError.details
            });
            // Rollback agency creation
            logger.log('ロールバック: 代理店レコードを削除します');
            await supabase
                .from('agencies')
                .delete()
                .eq('id', agency.id);
            throw userError;
        }
        logger.log('✅ ユーザーレコード作成成功 - ID:', agencyUser.id);

        // Send welcome email (optional - implement if needed)
        // await sendWelcomeEmail(email, contact_name, agency_name);

        logger.log('=== ✅✅✅ 登録処理完了 ✅✅✅ ===');
        logger.log('代理店コード:', agencyCode);
        logger.log('代理店ID:', agency.id);
        logger.log('ユーザーID:', agencyUser.id);
        logger.log('メールアドレス:', email);

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
        logger.error('=== ❌❌❌ 登録処理でエラーが発生 ❌❌❌ ===');
        logger.error('エラータイプ:', error.name);
        logger.error('エラーメッセージ:', error.message);
        logger.error('エラー詳細:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code || 'N/A',
            details: error.details || 'N/A'
        });

        // Supabaseエラーの場合、追加情報をログ出力
        if (error.code) {
            logger.error('Supabaseエラーコード:', error.code);
            logger.error('Supabaseエラー詳細:', error.details);
            logger.error('Supabaseヒント:', error.hint);
        }

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