const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

exports.handler = async (event, context) => {
      if (event.httpMethod === 'OPTIONS') {
              return {
                        statusCode: 200,
                        headers: {
                                    'Access-Control-Allow-Origin': '*',
                                    'Access-Control-Allow-Headers': 'Content-Type',
                                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
                        }
              };
      }

      if (event.httpMethod !== 'POST') {
              return {
                        statusCode: 405,
                        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Method not allowed' })
              };
      }

      try {
              const trackingData = JSON.parse(event.body);

        if (!trackingData.tracking_code) {
                  return {
                              statusCode: 400,
                              headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                              body: JSON.stringify({ error: 'Missing tracking_code' })
                  };
        }

        const { data: trackingLink, error: linkError } = await supabase
                .from('agency_tracking_links')
                .select('*')
                .eq('tracking_code', trackingData.tracking_code)
                .eq('is_active', true)
                .single();

        if (linkError || !trackingLink) {
                  return {
                              statusCode: 404,
                              headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                              body: JSON.stringify({ error: 'Invalid tracking code' })
                  };
        }

        let clientIP = trackingData.ip_address;
              if (!clientIP || clientIP === 'unknown') {
                        clientIP = getClientIPFromHeaders(event.headers);
              }
              // IP正規化: カンマ区切りの場合は最初のIP（実クライアントIP）のみ使用
              clientIP = (clientIP || 'unknown').split(',')[0].trim();

        const userAgent = trackingData.user_agent || event.headers['user-agent'] || 'Unknown';
              const sessionId = generateSessionId();
              const deviceType = getUserDeviceType(userAgent);
              const browser = getUserBrowser(userAgent);
              const os = getUserOS(userAgent);

        // 同じIPの過去訪問からLINEユーザーIDを自動取得（再訪問者の自動リンク）
        // 全tracking_link横断で検索（クロスリンク対応）
        let autoLinkedUserId = null;
        const { data: linkedVisits } = await supabase
            .from('agency_tracking_visits')
            .select('line_user_id')
            .or(`visitor_ip.eq.${clientIP},visitor_ip.like.${clientIP},%`)
            .not('line_user_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (linkedVisits && linkedVisits.length > 0) {
            autoLinkedUserId = linkedVisits[0].line_user_id;
            console.log('[track-visit] Auto-link from same IP:', autoLinkedUserId);
        }

        // 重複チェック（過去5分以内の同一IP）
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              const { data: recentVisits } = await supabase
                .from('agency_tracking_visits')
                .select('id')
                .eq('tracking_link_id', trackingLink.id)
                .eq('visitor_ip', clientIP)
                .gte('created_at', fiveMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1);

        const recentVisit = recentVisits && recentVisits.length > 0 ? recentVisits[0] : null;

        let visitId = null;

        if (recentVisit) {
                  // FIX: 重複訪問でも既存のvisit_idを返す（LIFFブリッジでの紐付けに必要）
                visitId = recentVisit.id;
                  console.log('[track-visit] Reusing existing visit for LIFF linking:', visitId);
        } else {
                  // 新規訪問をinsert（auto-linked LINE IDがあれば設定）
                const { data: visit, error: visitError } = await supabase
                    .from('agency_tracking_visits')
                    .insert([{
                                  tracking_link_id: trackingLink.id,
                                  agency_id: trackingLink.agency_id,
                                  visitor_ip: clientIP,
                                  user_agent: userAgent,
                                  referrer: trackingData.referrer,
                                  session_id: sessionId,
                                  device_type: deviceType,
                                  browser: browser,
                                  os: os,
                                  line_user_id: autoLinkedUserId,
                                  metadata: {
                                                  utm_source: trackingData.utm_source || trackingLink.utm_source,
                                                  utm_medium: trackingData.utm_medium || trackingLink.utm_medium,
                                                  utm_campaign: trackingData.utm_campaign || trackingLink.utm_campaign,
                                                  screen_resolution: trackingData.screen_resolution,
                                                  language: trackingData.language,
                                                  timezone: trackingData.timezone,
                                                  auto_linked: autoLinkedUserId ? true : undefined
                                  }
                    }])
                    .select()
                    .single();

                if (visitError) {
                            console.error('[track-visit] Error creating visit:', JSON.stringify(visitError));
                } else {
                            visitId = visit.id;
                            await supabase
                              .from('agency_tracking_links')
                              .update({
                                              visit_count: (trackingLink.visit_count || 0) + 1,
                                              updated_at: new Date().toISOString()
                              })
                              .eq('id', trackingLink.id);
                            console.log('[track-visit] New visit created:', visitId, autoLinkedUserId ? '(auto-linked)' : '');
                }
        }

        // LINEリダイレクト先URL: LIFF URLではなくlin.ee形式のURLを優先
        // （/t/ページのJSがLIFF ID付きURLを構築するため、ここではlin.ee URLを返す）
        const rawLineUrl = trackingLink.line_friend_url || trackingLink.destination_url || 'https://lin.ee/4NLfSqH';
              // liff.line.me URLが登録されている場合はデフォルトにフォールバック
        const lineFriendUrl = rawLineUrl.includes('liff.line.me')
                ? 'https://lin.ee/4NLfSqH'
                  : rawLineUrl;

        console.log('[track-visit] visit_id:', visitId, 'line_url:', lineFriendUrl);

        return {
                  statusCode: 200,
                  headers: {
                              'Access-Control-Allow-Origin': '*',
                              'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                              success: true,
                              line_friend_url: lineFriendUrl,
                              tracking_link: {
                                            name: trackingLink.name,
                                            utm_source: trackingLink.utm_source,
                                            utm_medium: trackingLink.utm_medium,
                                            utm_campaign: trackingLink.utm_campaign
                              },
                              visit_id: visitId,
                              session_id: sessionId
                  })
        };

      } catch (error) {
              console.error('[track-visit] Function error:', error);
              return {
                        statusCode: 500,
                        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Internal server error: ' + error.message })
              };
      }
};

function getClientIPFromHeaders(headers) {
      const ipHeaders = [
              'x-forwarded-for', 'x-real-ip', 'x-client-ip',
              'cf-connecting-ip', 'x-forwarded', 'forwarded-for', 'forwarded'
            ];
      for (const header of ipHeaders) {
              const value = headers[header];
              if (value) return value.split(',')[0].trim();
      }
      return 'unknown';
}

function generateSessionId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getUserDeviceType(userAgent) {
      if (!userAgent) return 'unknown';
      if (/mobile/i.test(userAgent)) return 'mobile';
      if (/tablet/i.test(userAgent)) return 'tablet';
      if (/bot/i.test(userAgent)) return 'bot';
      return 'desktop';
}

function getUserBrowser(userAgent) {
      if (!userAgent) return 'unknown';
      if (/line/i.test(userAgent)) return 'LINE';
      if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
      if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
      if (/firefox/i.test(userAgent)) return 'Firefox';
      if (/edge/i.test(userAgent)) return 'Edge';
      return 'other';
}

function getUserOS(userAgent) {
      if (!userAgent) return 'unknown';
      const iosMatch = userAgent.match(/(?:iPhone|iPad|iPod).*?OS ([\d_]+)/i);
      if (iosMatch) {
              const version = iosMatch[1].replace(/_/g, '.');
              const device = /iPad/i.test(userAgent) ? 'iPadOS' : 'iOS';
              return `${device} ${version}`;
      }
      const androidMatch = userAgent.match(/Android ([\d.]+)/i);
      if (androidMatch) return `Android ${androidMatch[1]}`;
      const windowsMatch = userAgent.match(/Windows NT ([\d.]+)/i);
      if (windowsMatch) {
              const ntVersion = windowsMatch[1];
              const windowsVersion = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista' }[ntVersion] || ntVersion;
              return `Windows ${windowsVersion}`;
      }
      const macMatch = userAgent.match(/Mac OS X ([\d_]+)/i);
      if (macMatch) return `macOS ${macMatch[1].replace(/_/g, '.')}`;
      if (/linux/i.test(userAgent)) return 'Linux';
      return 'other';
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}
