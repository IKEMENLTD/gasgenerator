const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET'
            }
        };
    }

    // Only allow GET method
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // 運営の代理店コード（level=0または1の最上位代理店）を取得
        // まずlevel=0を探す
        let { data: masterAgency, error: level0Error } = await supabase
            .from('agencies')
            .select('code, name, level')
            .eq('level', 0)
            .eq('status', 'active')
            .single();

        // level=0が見つからない場合、level=1を探す
        if (level0Error || !masterAgency) {
            const { data: level1Agencies, error: level1Error } = await supabase
                .from('agencies')
                .select('code, name, level')
                .eq('level', 1)
                .eq('status', 'active')
                .order('created_at', { ascending: true })
                .limit(1);

            if (level1Error) {
                console.error('❌ level=1代理店の検索に失敗:', level1Error);
                return {
                    statusCode: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: 'データベースエラーが発生しました: ' + level1Error.message
                    })
                };
            }

            const level1Agency = level1Agencies?.[0];

            if (!level1Agency) {
                // 最上位代理店が見つからない場合
                return {
                    statusCode: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: '運営の代理店が見つかりません。まずagenciesテーブルにlevel=0またはlevel=1の代理店を登録してください。'
                    })
                };
            }

            masterAgency = level1Agency;
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: masterAgency.code,
                name: masterAgency.name,
                level: masterAgency.level
            })
        };

    } catch (error) {
        console.error('Function error:', error);

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Internal server error: ' + error.message
            })
        };
    }
};

// Validate environment variables on cold start
if (!process.env.SUPABASE_URL) {
    console.error('Missing required environment variables: SUPABASE_URL');
}
