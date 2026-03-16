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
        let masterAgency = null;

        // 環境変数でマスター代理店コードが指定されている場合、それを使用
        const masterCode = process.env.MASTER_AGENCY_CODE;
        if (masterCode) {
            const { data, error } = await supabase
                .from('agencies')
                .select('code, name, level')
                .eq('code', masterCode)
                .eq('status', 'active')
                .single();

            if (!error && data) {
                masterAgency = data;
            }
        }

        // フォールバック: level=1 + company_nameで株式会社イケメンを検索
        if (!masterAgency) {
            const { data } = await supabase
                .from('agencies')
                .select('code, name, level')
                .eq('level', 1)
                .eq('status', 'active')
                .eq('company_name', '株式会社イケメン')
                .limit(1);

            if (data?.[0]) {
                masterAgency = data[0];
            }
        }

        // 最終フォールバック: level=1 + parent_agency_id IS NULL + テストデータ除外
        if (!masterAgency) {
            const { data, error } = await supabase
                .from('agencies')
                .select('code, name, level, company_name')
                .eq('level', 1)
                .eq('status', 'active')
                .is('parent_agency_id', null)
                .not('company_name', 'like', '株式会社テスト%')
                .order('created_at', { ascending: true })
                .limit(1);

            if (error) {
                console.error('代理店検索エラー:', error);
                return {
                    statusCode: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: 'データベースエラーが発生しました: ' + error.message
                    })
                };
            }

            masterAgency = data?.[0] || null;
        }

        if (!masterAgency) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: '運営の代理店が見つかりません。'
                })
            };
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
