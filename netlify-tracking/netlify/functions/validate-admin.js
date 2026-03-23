exports.handler = async (event, context) => {
    // CORS対応
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { username, password } = JSON.parse(event.body);

        // 環境変数から認証情報を取得（3アカウント対応）
        const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TaskMate2026Admin';
        const ADMIN_USERNAME_2 = process.env.ADMIN_USERNAME_2 || 'admin';
        const ADMIN_PASSWORD_2 = process.env.ADMIN_PASSWORD_2 || 'TaskMate2026Admin';
        const ADMIN_USERNAME_3 = process.env.ADMIN_USERNAME_3 || 'info@ikemen.ltd';
        const ADMIN_PASSWORD_3 = process.env.ADMIN_PASSWORD_3 || 'akutu4256';

        const isValid =
            (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) ||
            (username === ADMIN_USERNAME_2 && password === ADMIN_PASSWORD_2) ||
            (username === ADMIN_USERNAME_3 && password === ADMIN_PASSWORD_3);

        if (isValid) {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    token: 'authenticated'
                })
            };
        } else {
            return {
                statusCode: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid credentials'
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Server error',
                details: error.message
            })
        };
    }
};