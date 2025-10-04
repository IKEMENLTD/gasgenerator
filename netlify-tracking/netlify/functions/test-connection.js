const { createClient } = require('@supabase/supabase-js');

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

    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {},
        supabase: {},
        database: {},
        errors: []
    };

    try {
        // 1. 環境変数チェック
        diagnostics.environment = {
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            JWT_SECRET: !!process.env.JWT_SECRET,
            NODE_ENV: process.env.NODE_ENV || 'not set'
        };

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            diagnostics.errors.push('Missing required environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify(diagnostics)
            };
        }

        // 2. Supabase接続テスト
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        diagnostics.supabase = {
            url: process.env.SUPABASE_URL.replace(/https?:\/\/([^.]+).*/, '$1...'),
            client_created: !!supabase
        };

        // 3. データベース接続テスト - agencies テーブル
        const { data: agenciesTest, error: agenciesError } = await supabase
            .from('agencies')
            .select('count')
            .limit(1);

        if (agenciesError) {
            diagnostics.errors.push(`Agencies table error: ${agenciesError.message}`);
            diagnostics.database.agencies = {
                accessible: false,
                error: agenciesError.message
            };
        } else {
            diagnostics.database.agencies = {
                accessible: true,
                test_query: 'success'
            };
        }

        // 4. データベース接続テスト - agency_users テーブル
        const { data: usersTest, error: usersError } = await supabase
            .from('agency_users')
            .select('count')
            .limit(1);

        if (usersError) {
            diagnostics.errors.push(`Agency users table error: ${usersError.message}`);
            diagnostics.database.agency_users = {
                accessible: false,
                error: usersError.message
            };
        } else {
            diagnostics.database.agency_users = {
                accessible: true,
                test_query: 'success'
            };
        }

        // 5. bcryptjsテスト
        try {
            const bcrypt = require('bcryptjs');
            const testHash = await bcrypt.hash('test', 10);
            diagnostics.bcrypt = {
                loaded: true,
                test_hash: testHash.substring(0, 10) + '...',
                hash_length: testHash.length
            };
        } catch (bcryptError) {
            diagnostics.errors.push(`bcrypt error: ${bcryptError.message}`);
            diagnostics.bcrypt = {
                loaded: false,
                error: bcryptError.message
            };
        }

        // 6. カラム情報取得（PostgreSQL情報スキーマ）
        const { data: columnsData, error: columnsError } = await supabase
            .rpc('get_table_info', {
                table_names: ['agencies', 'agency_users']
            })
            .limit(20);

        if (!columnsError && columnsData) {
            diagnostics.database.schema_info = columnsData;
        } else if (columnsError) {
            // RPC関数が存在しない場合は通常のクエリで試す
            const { data: agencyColumns } = await supabase
                .from('agencies')
                .select('*')
                .limit(0);

            if (agencyColumns !== null) {
                diagnostics.database.columns_test = 'Tables exist and are queryable';
            }
        }

        // 7. 総合診断
        diagnostics.overall = {
            status: diagnostics.errors.length === 0 ? 'healthy' : 'issues_detected',
            total_errors: diagnostics.errors.length,
            ready_for_registration: diagnostics.errors.length === 0
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(diagnostics, null, 2)
        };

    } catch (error) {
        diagnostics.errors.push(`Unexpected error: ${error.message}`);
        diagnostics.exception = {
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5)
        };

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify(diagnostics, null, 2)
        };
    }
};