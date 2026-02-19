const { createClient } = require('@supabase/supabase-js');
const logger = require('./utils/logger');

// Environment variable check with detailed logging
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('❌ CRITICAL: Missing Supabase environment variables');
    logger.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'MISSING');
    logger.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'MISSING');
}

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

exports.handler = async (event) => {
    logger.log('🔗 Track-redirect function called');
    logger.log('📍 Full path:', event.path);
    logger.log('🌐 Method:', event.httpMethod);
    logger.log('📨 Headers:', JSON.stringify(event.headers, null, 2));

    // Extract tracking code from path
    const pathParts = event.path.split('/');
    const trackingCode = pathParts[pathParts.length - 1];

    logger.log('🔍 Extracted tracking code:', trackingCode);
    logger.log('📂 Path parts:', pathParts);

    if (!trackingCode || trackingCode === 'track-redirect') {
        logger.error('❌ No tracking code found in path');
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <!DOCTYPE html>
                <html>
                <head><title>Tracking Code Missing</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ Tracking Code Not Found</h1>
                    <p>The tracking link appears to be incomplete.</p>
                    <p><strong>Path:</strong> ${event.path}</p>
                    <p><a href="https://lin.ee/4NLfSqH">Continue to LINE</a></p>
                </body>
                </html>
            `
        };
    }

    try {
        logger.log('🔎 Searching for tracking link in database...');

        // Find tracking link
        const { data: link, error: linkError } = await supabase
            .from('agency_tracking_links')
            .select(`
                *,
                agencies (*)
            `)
            .eq('tracking_code', trackingCode)
            .eq('is_active', true)
            .single();

        if (linkError) {
            logger.error('❌ Database error when fetching tracking link:', linkError);
            logger.error('Error details:', {
                message: linkError.message,
                code: linkError.code,
                details: linkError.details,
                hint: linkError.hint
            });
        }

        if (!link) {
            logger.warn('⚠️  Tracking link not found:', trackingCode);
            logger.warn('Possible reasons: 1) Link does not exist, 2) Link is inactive, 3) Wrong tracking code');

            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'text/html'
                },
                body: `
                    <!DOCTYPE html>
                    <html>
                    <head><title>Link Not Found</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>🔍 Tracking Link Not Found</h1>
                        <p>The tracking link you're trying to access does not exist or has been deactivated.</p>
                        <p><strong>Tracking Code:</strong> ${trackingCode}</p>
                        <p><a href="https://lin.ee/4NLfSqH" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #06c755; color: white; text-decoration: none; border-radius: 5px;">Continue to LINE</a></p>
                    </body>
                    </html>
                `
            };
        }

        logger.log('✅ Tracking link found:', {
            id: link.id,
            name: link.name,
            agency_id: link.agency_id,
            visit_count: link.visit_count
        });

        // Extract visitor information
        const visitorInfo = {
            ip: event.headers['x-forwarded-for'] || event.headers['client-ip'],
            userAgent: event.headers['user-agent'],
            referrer: event.headers['referer'] || event.headers['referrer'],
            // Parse user agent for device info
            deviceType: getUserDeviceType(event.headers['user-agent']),
            browser: getUserBrowser(event.headers['user-agent']),
            os: getUserOS(event.headers['user-agent'])
        };

        // Generate session ID for tracking across conversion funnel
        const sessionId = generateSessionId();
        logger.log('🆔 Generated session ID:', sessionId);

        // Record the visit
        logger.log('💾 Recording visit to database...');
        const { data: visit, error: visitError } = await supabase
            .from('agency_tracking_visits')
            .insert({
                tracking_link_id: link.id,
                agency_id: link.agency_id,
                visitor_ip: visitorInfo.ip,
                user_agent: visitorInfo.userAgent,
                referrer: visitorInfo.referrer,
                device_type: visitorInfo.deviceType,
                browser: visitorInfo.browser,
                os: visitorInfo.os,
                session_id: sessionId,
                line_user_id: null, // Will be linked when user adds LINE friend
                metadata: {
                    tracking_code: trackingCode,
                    utm_source: link.utm_source,
                    utm_medium: link.utm_medium,
                    utm_campaign: link.utm_campaign,
                    timestamp: new Date().toISOString()
                }
            })
            .select()
            .single();

        if (visitError) {
            logger.error('❌ Error recording visit:', visitError);
            logger.error('Visit error details:', {
                message: visitError.message,
                code: visitError.code,
                details: visitError.details
            });
        } else {
            logger.log('✅ Visit recorded successfully. Visit ID:', visit?.id);
        }

        // Increment visit count
        logger.log('📊 Incrementing visit count...');
        const { error: updateError } = await supabase
            .from('agency_tracking_links')
            .update({
                visit_count: link.visit_count + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', link.id);

        if (updateError) {
            logger.error('❌ Error updating visit count:', updateError);
        } else {
            logger.log('✅ Visit count updated to:', link.visit_count + 1);
        }

        // Build LINE friend URL
        let rawLineUrl = link.destination_url || link.line_friend_url || 'https://lin.ee/4NLfSqH';
        // liff.line.me URLがDBに残っている場合はデフォルトにフォールバック
        if (rawLineUrl.includes('liff.line.me')) {
            rawLineUrl = 'https://lin.ee/4NLfSqH';
        }
        const lineUrl = new URL(rawLineUrl);

        // Add UTM parameters
        if (link.utm_source) lineUrl.searchParams.append('utm_source', link.utm_source);
        if (link.utm_medium) lineUrl.searchParams.append('utm_medium', link.utm_medium);
        if (link.utm_campaign) lineUrl.searchParams.append('utm_campaign', link.utm_campaign);

        const finalLineUrl = lineUrl.toString();
        const visitId = visit?.id || null;

        // LIFF設定
        const LIFF_ID = process.env.LIFF_ID || '2009173525-SZzAqCLG';
        const LIFF_BRIDGE_URL = process.env.LIFF_BRIDGE_URL || 'https://gasgenerator.onrender.com/liff';

        // Set cookie for session tracking
        const cookieValue = JSON.stringify({
            trackingCode,
            sessionId,
            agencyId: link.agency_id,
            timestamp: new Date().toISOString()
        });
        const cookieHeader = `taskmate_tracking=${Buffer.from(cookieValue).toString('base64')}; Path=/; Max-Age=2592000; SameSite=Lax`;

        // モバイル判定
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(visitorInfo.userAgent || '');

        if (isMobile && visitId && LIFF_ID) {
            // モバイル: LIFFブリッジに直接リダイレクト → LINE内で自動紐付け
            const liffUrl = `https://liff.line.me/${LIFF_ID}?visit_id=${encodeURIComponent(visitId)}&line_url=${encodeURIComponent(finalLineUrl)}`;
            logger.log('📱 Mobile → LIFF redirect:', liffUrl);

            return {
                statusCode: 302,
                headers: {
                    'Location': liffUrl,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Set-Cookie': cookieHeader
                },
                body: ''
            };
        }

        if (!isMobile && visitId && LIFF_ID) {
            // デスクトップ: QRコード表示ページを返す
            const liffUrl = `https://liff.line.me/${LIFF_ID}?visit_id=${encodeURIComponent(visitId)}&line_url=${encodeURIComponent(finalLineUrl)}`;
            logger.log('🖥️ Desktop → QR code page (visit_id:', visitId, ')');

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Set-Cookie': cookieHeader
                },
                body: generateQRPage(liffUrl, finalLineUrl, link.name || 'TaskMate')
            };
        }

        // フォールバック: visit_id取得失敗時は直接リダイレクト
        logger.log('⚠️ Fallback → direct redirect (no visit_id)');
        return {
            statusCode: 302,
            headers: {
                'Location': finalLineUrl,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Set-Cookie': cookieHeader
            },
            body: ''
        };

    } catch (error) {
        logger.error('❌❌❌ CRITICAL ERROR in track-redirect ❌❌❌');
        logger.error('Error type:', error.name);
        logger.error('Error message:', error.message);
        logger.error('Error stack:', error.stack);
        logger.error('Event details:', {
            path: event.path,
            method: event.httpMethod,
            headers: event.headers
        });

        // Fallback redirect to LINE friend URL with error info
        const fallbackUrl = 'https://lin.ee/4NLfSqH';
        logger.log('⚠️  Performing fallback redirect to:', fallbackUrl);

        return {
            statusCode: 302,
            headers: {
                'Location': fallbackUrl,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Error-Occurred': 'true'
            },
            body: ''
        };
    }
};

function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
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

    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/line/i.test(userAgent)) return 'LINE';
    return 'other';
}

function getUserOS(userAgent) {
    if (!userAgent) return 'unknown';

    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
    return 'other';
}

function generateQRPage(liffUrl, fallbackLineUrl, linkName) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TaskMate AI - LINE友だち追加</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,'Hiragino Sans',sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:center;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 50%,#2a2a2a 100%);color:#fff}
.card{background:rgba(26,26,26,0.95);border-radius:24px;padding:2.5rem 2rem;text-align:center;max-width:420px;width:90%;border:1px solid rgba(0,185,0,0.15);box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 80px rgba(0,185,0,0.08)}
.logo{font-size:2rem;font-weight:900;background:linear-gradient(135deg,#22c55e,#00B900);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.25rem}
.subtitle{font-size:.8rem;color:#9ca3af;margin-bottom:2rem}
.line-badge{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:linear-gradient(135deg,#22c55e,#00B900);border-radius:16px;margin-bottom:1.25rem;box-shadow:0 0 30px rgba(0,185,0,0.4)}
.line-badge svg{width:30px;height:30px;fill:#fff}
.title{font-size:1.2rem;font-weight:700;margin-bottom:.4rem}
.desc{font-size:.875rem;color:#9ca3af;margin-bottom:1.5rem;line-height:1.6}
.qr-box{background:#fff;border-radius:12px;padding:16px;display:inline-block;margin-bottom:1.5rem;box-shadow:0 0 20px rgba(0,185,0,0.2)}
.qr-box canvas{display:block}
.steps{text-align:left;margin:0 auto 1.5rem;max-width:280px}
.step{display:flex;align-items:center;gap:10px;margin-bottom:10px;color:#d1d5db;font-size:.85rem}
.step-n{width:24px;height:24px;min-width:24px;background:linear-gradient(135deg,#22c55e,#00B900);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700}
hr{border:none;height:1px;background:rgba(255,255,255,0.08);margin:1.25rem 0}
.fallback{font-size:.75rem;color:#6b7280;margin-bottom:.5rem}
.fallback-btn{display:inline-flex;align-items:center;gap:6px;color:#9ca3af;text-decoration:none;font-size:.8rem;padding:.5rem 1.25rem;border:1px solid rgba(255,255,255,0.12);border-radius:10px;transition:all .2s}
.fallback-btn:hover{color:#fff;border-color:rgba(0,185,0,0.4);background:rgba(0,185,0,0.1)}
</style>
</head>
<body>
<div class="card">
<div class="logo">TaskMate</div>
<div class="subtitle">業務自動化で生産性を最大化</div>
<div class="line-badge"><svg viewBox="0 0 24 24"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg></div>
<div class="title">LINE友だち追加</div>
<div class="desc">スマートフォンのLINEで<br>QRコードを読み取ってください</div>
<div class="qr-box"><canvas id="qr"></canvas></div>
<div class="steps">
<div class="step"><span class="step-n">1</span><span>スマホでLINEアプリを開く</span></div>
<div class="step"><span class="step-n">2</span><span>ホーム画面のQRアイコンをタップ</span></div>
<div class="step"><span class="step-n">3</span><span>このQRコードを読み取る</span></div>
</div>
<hr>
<div class="fallback">QRコードが読み取れない場合</div>
<a href="${fallbackLineUrl}" class="fallback-btn">直接LINEで追加する</a>
</div>
<script>
if(typeof QRCode!=='undefined'){
QRCode.toCanvas(document.getElementById('qr'),'${liffUrl}',{width:200,margin:2,color:{dark:'#000',light:'#fff'}},function(e){if(e){console.error(e);window.location.href='${fallbackLineUrl}';}});
}else{window.location.href='${fallbackLineUrl}';}
<\/script>
</body>
</html>`;
}