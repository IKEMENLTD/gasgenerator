// 環境変数チェック用エンドポイント
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // 環境変数の存在チェック（値は表示しない）
    const envCheck = {
        timestamp: new Date().toISOString(),
        environment: {
            SUPABASE_URL: {
                exists: !!process.env.SUPABASE_URL,
                preview: process.env.SUPABASE_URL ?
                    process.env.SUPABASE_URL.substring(0, 20) + '...' : 'NOT SET'
            },
            SUPABASE_SERVICE_ROLE_KEY: {
                exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
            },
            JWT_SECRET: {
                exists: !!process.env.JWT_SECRET,
                length: process.env.JWT_SECRET?.length || 0
            },
            APP_URL: {
                exists: !!process.env.APP_URL,
                value: process.env.APP_URL || 'NOT SET'
            },
            SENDGRID_API_KEY: {
                exists: !!process.env.SENDGRID_API_KEY,
                configured: !!process.env.SENDGRID_API_KEY
            },
            EMAIL_FROM: {
                exists: !!process.env.EMAIL_FROM,
                value: process.env.EMAIL_FROM || 'NOT SET'
            },
            NODE_ENV: process.env.NODE_ENV || 'not set'
        },
        recommendations: []
    };

    // 推奨事項
    if (!process.env.SUPABASE_URL) {
        envCheck.recommendations.push('⚠️ SUPABASE_URLを設定してください');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        envCheck.recommendations.push('⚠️ SUPABASE_SERVICE_ROLE_KEYを設定してください');
    }
    if (!process.env.JWT_SECRET) {
        envCheck.recommendations.push('⚠️ JWT_SECRETを設定してください（32文字以上推奨）');
    }
    if (!process.env.APP_URL) {
        envCheck.recommendations.push('📝 APP_URLを設定することを推奨します');
    }
    if (!process.env.SENDGRID_API_KEY) {
        envCheck.recommendations.push('📧 メール送信にはSENDGRID_API_KEYが必要です');
    }

    // 全体の健全性チェック
    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'JWT_SECRET'
    ];

    const missingRequired = requiredVars.filter(v => !process.env[v]);

    envCheck.status = {
        healthy: missingRequired.length === 0,
        missingRequired,
        message: missingRequired.length === 0
            ? '✅ 必須環境変数はすべて設定されています'
            : `❌ ${missingRequired.length}個の必須環境変数が不足しています`
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(envCheck, null, 2)
    };
};