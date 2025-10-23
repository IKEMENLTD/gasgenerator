# TaskMate AI - Netlify側 システム設計書

**最終更新:** 2024-10-23
**バージョン:** 2.0
**対象:** Netlify Functions (トラッキング & Webhook転送)

---

## 目次

1. [Netlify側システム概要](#1-netlify側システム概要)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構成](#3-ディレクトリ構成)
4. [Functions 詳細](#4-functions詳細)
5. [管理画面（Admin Dashboard）](#5-管理画面admin-dashboard)
6. [データベース連携](#6-データベース連携)
7. [環境変数](#7-環境変数)
8. [デプロイ手順](#8-デプロイ手順)
9. [トラブルシューティング](#9-トラブルシューティング)

---

## 1. Netlify側システム概要

### 1.1 役割

**トラッキングシステム & LINE Webhook 中継**

Netlify Functions は TaskMate AI のトラッキング機能と LINE Webhook の中継点を担当します。

**主な責務:**
1. **トラッキングリンクの訪問記録** → 代理店の成果測定
2. **LINE Webhook の転送** → Netlify → Render へ
3. **LINE Profile の保存** → 訪問記録との紐付け
4. **代理店管理画面の提供** → Admin Dashboard

**Render との関係:**
```
LINE API → Netlify Functions → Render (メイン処理)
                ↓
         トラッキング処理（独立）
```

---

### 1.2 なぜ Netlify を使うのか？

#### 理由1: 高速デプロイ
- Netlify Functions: 30秒-1分でデプロイ完了
- Render (Next.js): 3-5分のビルド時間

トラッキング機能の修正を即座に反映できる

#### 理由2: トラッキング処理の独立性
- トラッキングリンクの訪問記録は Render のメイン処理と無関係
- 負荷分散: トラッキング負荷が Render に影響しない

#### 理由3: 静的サイトホスティング
- ランディングページ（public/index.html）
- 代理店管理画面（admin/index.html）

---

### 1.3 システム構成

```
┌──────────────────────────────────────────────────────┐
│              Netlify Site                             │
│              (elegant-gumdrop-9a983a)                 │
│                                                       │
│  URL: https://taskmateai.net                         │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ Static Files                                │    │
│  │ - public/index.html     (ランディング)      │    │
│  │ - admin/index.html      (管理画面)          │    │
│  │ - admin/login.html      (ログイン)          │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ Netlify Functions                           │    │
│  │ - line-webhook          (LINE 転送)         │    │
│  │ - track-visit           (訪問記録作成)       │    │
│  │ - get-tracking-stats    (統計取得)          │    │
│  │ - get-master-agency     (マスター代理店)     │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                ↓                        ↓
       ┌────────────┐          ┌──────────────┐
       │ Supabase   │          │ Render       │
       │ PostgreSQL │          │ (Next.js)    │
       └────────────┘          └──────────────┘
```

---

## 2. 技術スタック

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **Netlify Functions** | - | サーバーレス関数 (AWS Lambda ベース) |
| **Node.js** | 18.x | ランタイム |
| **@supabase/supabase-js** | 2.x | PostgreSQL クライアント |
| **Alpine.js** | 3.x | 管理画面の UI フレームワーク |
| **Chart.js** | 4.x | 管理画面のグラフ表示 |

**パッケージマネージャー:** npm

---

## 3. ディレクトリ構成

```
netlify-tracking/
├── netlify/
│   └── functions/
│       ├── line-webhook.js         # LINE Webhook 転送 & Profile保存
│       ├── track-visit.js          # 訪問記録作成
│       ├── get-tracking-stats.js   # 統計取得 API
│       └── get-master-agency.js    # マスター代理店取得
│
├── admin/
│   ├── index.html                  # 管理画面メイン
│   ├── dashboard.js                # 管理画面ロジック
│   ├── login.html                  # ログイン画面
│   └── styles.css                  # スタイル
│
├── public/
│   ├── index.html                  # ランディングページ
│   ├── tracking.js                 # トラッキングスクリプト
│   └── styles.css                  # スタイル
│
├── netlify.toml                    # Netlify 設定ファイル
├── package.json
└── NETLIFY_ARCHITECTURE.md         # このファイル
```

---

## 4. Functions 詳細

### 4.1 line-webhook.js

**役割:** LINE Webhook を受信し、Render に転送 & LINE Profile 保存

**エンドポイント:** `POST /.netlify/functions/line-webhook`

---

#### 処理フロー全体

```
1. CORS 処理（OPTIONS リクエスト）
2. 署名検証（x-line-signature）
3. イベント振り分け
   - follow → handleFollowEvent
   - message → handleMessageEvent
   - unfollow → handleUnfollowEvent
4. Render へ転送（await forwardToRender）
```

---

#### handleFollowEvent（友達追加）

```javascript
async function handleFollowEvent(event) {
    const userId = event.source.userId;

    try {
        // 1. LINE API からプロフィール取得
        const userProfile = await getLineUserProfile(userId);

        if (!userProfile) {
            console.error('Failed to get user profile for', userId);
            return;
        }

        // 2. line_profiles テーブルに保存
        const profileData = {
            user_id: userId,
            display_name: userProfile.displayName,
            picture_url: userProfile.pictureUrl,
            status_message: userProfile.statusMessage,
            fetched_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: newProfile, error } = await supabase
            .from('line_profiles')
            .insert([profileData])
            .select()
            .single();

        if (error) {
            console.error('Error creating profile:', error);
            return;
        }

        // 3. トラッキングリンク経由の場合、訪問記録に紐付け
        await linkUserToTracking(userId, userId, 'new_friend');

    } catch (error) {
        console.error('Error handling follow event:', error);
    }
}
```

**データベース操作:**
```sql
-- LINE Profile 保存
INSERT INTO line_profiles (user_id, display_name, picture_url, ...)
VALUES ($1, $2, $3, ...);

-- 訪問記録紐付け
UPDATE agency_tracking_visits SET
  line_user_id = $1,
  metadata = jsonb_set(metadata, '{friend_type}', '"new_friend"')
WHERE line_user_id IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

---

#### handleMessageEvent（メッセージ受信）

```javascript
async function handleMessageEvent(event) {
    const userId = event.source.userId;

    try {
        // 1. LINE Profile UPSERT（既存友達対応）
        const userProfile = await getLineUserProfile(userId);

        if (userProfile) {
            await supabase
                .from('line_profiles')
                .upsert({
                    user_id: userId,
                    display_name: userProfile.displayName,
                    picture_url: userProfile.pictureUrl,
                    status_message: userProfile.statusMessage,
                    fetched_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            console.log('✅ LINE Profile upsert成功:', userProfile.displayName);
        }

        // 2. 未紐付け訪問記録検索（過去1時間）
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data: unlinkedVisits, error: searchError } = await supabase
            .from('agency_tracking_visits')
            .select('id, tracking_link_id, agency_id, created_at, metadata')
            .is('line_user_id', null)
            .gte('created_at', oneHourAgo)
            .order('created_at', { ascending: false })
            .limit(5);

        if (searchError) {
            console.error('❌ 未紐付け訪問記録の検索に失敗:', searchError);
            return;
        }

        if (!unlinkedVisits || unlinkedVisits.length === 0) {
            console.log('ℹ️ 過去1時間以内の未紐付け訪問記録なし');
            return;
        }

        console.log(`✅ ${unlinkedVisits.length}件の未紐付け訪問記録を発見`);

        // 3. 訪問記録に紐付け（既存友達として）
        let successCount = 0;
        let errorCount = 0;

        for (const visit of unlinkedVisits) {
            try {
                const currentMetadata = visit.metadata || {};

                const { error: updateError } = await supabase
                    .from('agency_tracking_visits')
                    .update({
                        line_user_id: userId,
                        metadata: {
                            ...currentMetadata,
                            friend_type: 'existing_friend',
                            linked_at: new Date().toISOString()
                        }
                        // updated_at は存在しないカラム（削除済み）
                    })
                    .eq('id', visit.id);

                if (updateError) {
                    console.error(`❌ Visit ${visit.id} の更新に失敗:`, updateError);
                    errorCount++;
                } else {
                    successCount++;

                    // コンバージョン記録作成
                    const sessionData = {
                        id: null,
                        agency_id: visit.agency_id,
                        tracking_link_id: visit.tracking_link_id,
                        visit_id: visit.id
                    };

                    await createAgencyLineConversion(sessionData, userId, userId).catch(err => {
                        console.error(`❌ Visit ${visit.id} のコンバージョン記録作成に失敗:`, err);
                    });
                }
            } catch (error) {
                console.error(`❌ Visit ${visit.id} の処理に失敗:`, error);
                errorCount++;
            }
        }

        console.log(`✅ ${successCount}件の紐付けに成功`);
        if (errorCount > 0) {
            console.error(`⚠️ ${errorCount}件の紐付けに失敗しました`);
        }

    } catch (error) {
        console.error('Error handling message event:', error);
    }
}
```

**重要な修正履歴:**
- **2024-10-23**: `updated_at` カラム削除（存在しないためエラー）
- **2024-10-22**: UPSERT 追加（既存友達の LINE 名記録）

---

#### forwardToRender（Render 転送）

```javascript
async function forwardToRender(body, signature) {
    const RENDER_URL = 'https://gasgenerator.onrender.com/api/webhook';

    try {
        console.log('📤 [v2.0] Forwarding to Render TaskMate AI:', RENDER_URL);

        const response = await fetch(RENDER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-line-signature': signature,
                'x-forwarded-from': 'netlify'  // 無限ループ防止
            },
            body: body,
            signal: AbortSignal.timeout(28000)  // 28秒タイムアウト
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Render forward failed (${response.status}):`, errorText);
            throw new Error(`Render responded with ${response.status}`);
        }

        console.log('✅ Render forward successful');
    } catch (error) {
        console.error('❌ Forward to Render error:', error);
        throw error;
    }
}
```

**重要:**
- **必ず `await` すること**: 関数終了前にリクエスト完了を待つ
- **x-forwarded-from ヘッダー**: Render 側で無限ループを防止
- **タイムアウト 28秒**: Netlify Functions の制限（最大30秒）内

---

### 4.2 track-visit.js

**役割:** トラッキングリンクの訪問記録を作成

**エンドポイント:** `POST /.netlify/functions/track-visit`

---

#### リクエストボディ例

```json
{
  "tracking_code": "TWITTER_AD_001",
  "referrer": "https://twitter.com/...",
  "ip_address": "123.45.67.89",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) ...",
  "utm_source": "twitter",
  "utm_medium": "social",
  "utm_campaign": "oct_campaign",
  "screen_resolution": "390x844",
  "language": "ja-JP",
  "timezone": "Asia/Tokyo"
}
```

---

#### 処理フロー

```javascript
exports.handler = async (event, context) => {
    // 1. CORS 処理
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

    // 2. POST メソッドのみ許可
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const trackingData = JSON.parse(event.body);

        // 3. トラッキングコード検証
        if (!trackingData.tracking_code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing tracking_code' })
            };
        }

        // 4. トラッキングリンク取得
        const { data: trackingLink, error: linkError } = await supabase
            .from('agency_tracking_links')
            .select('*')
            .eq('tracking_code', trackingData.tracking_code)
            .eq('is_active', true)
            .single();

        if (linkError || !trackingLink) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Invalid tracking code' })
            };
        }

        // 5. IP アドレス取得
        let clientIP = trackingData.ip_address;
        if (!clientIP || clientIP === 'unknown') {
            clientIP = getClientIPFromHeaders(event.headers);
        }

        // 6. User-Agent 解析
        const userAgent = trackingData.user_agent || event.headers['user-agent'] || 'Unknown';

        // 7. 訪問データ作成
        const visitData = {
            tracking_link_id: trackingLink.id,
            ip_address: clientIP,
            user_agent: userAgent,
            referrer: trackingData.referrer,
            utm_source: trackingData.utm_source || trackingLink.utm_source,
            utm_medium: trackingData.utm_medium || trackingLink.utm_medium,
            utm_campaign: trackingData.utm_campaign || trackingLink.utm_campaign,
            screen_resolution: trackingData.screen_resolution,
            language: trackingData.language,
            timezone: trackingData.timezone,
            visited_at: trackingData.visited_at || new Date().toISOString(),
            session_id: generateSessionId(),
            device_type: getUserDeviceType(userAgent),
            browser: getUserBrowser(userAgent),
            os: getUserOS(userAgent)  // ← 強化版（iOS 17.1.1 等）
        };

        // 8. 重複チェック（同一IPから5分以内）
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentVisit } = await supabase
            .from('agency_tracking_visits')
            .select('id')
            .eq('tracking_link_id', trackingLink.id)
            .eq('visitor_ip', clientIP)
            .gte('visited_at', fiveMinutesAgo)
            .single();

        let visitId = null;
        if (!recentVisit) {
            // 9. 訪問記録作成
            const { data: visit, error: visitError } = await supabase
                .from('agency_tracking_visits')
                .insert([{
                    tracking_link_id: trackingLink.id,
                    agency_id: trackingLink.agency_id,
                    visitor_ip: clientIP,
                    user_agent: visitData.user_agent,
                    referrer: visitData.referrer,
                    session_id: visitData.session_id,
                    device_type: visitData.device_type,
                    browser: visitData.browser,
                    os: visitData.os,
                    metadata: {
                        utm_source: visitData.utm_source,
                        utm_medium: visitData.utm_medium,
                        utm_campaign: visitData.utm_campaign,
                        screen_resolution: visitData.screen_resolution,
                        language: visitData.language,
                        timezone: visitData.timezone
                    }
                }])
                .select()
                .single();

            if (visitError) {
                console.error('Error creating visit:', visitError);
            } else {
                visitId = visit.id;

                // 10. 訪問カウント更新
                const { error: updateError } = await supabase
                    .from('agency_tracking_links')
                    .update({
                        visit_count: trackingLink.visit_count + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', trackingLink.id);

                if (updateError) {
                    console.error('Error updating visit count:', updateError);
                }
            }
        }

        // 11. レスポンス返却
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                line_friend_url: trackingLink.destination_url || trackingLink.line_friend_url || 'https://lin.ee/4NLfSqH',
                tracking_link: {
                    name: trackingLink.name,
                    utm_source: trackingLink.utm_source,
                    utm_medium: trackingLink.utm_medium,
                    utm_campaign: trackingLink.utm_campaign
                },
                visit_id: visitId,
                session_id: visitData.session_id
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
```

---

#### User-Agent 解析関数（強化版）

**2024-10-23 更新: スマホOSバージョン詳細取得対応**

```javascript
// デバイスタイプ判定
function getUserDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    if (/bot/i.test(userAgent)) return 'bot';
    return 'desktop';
}

// ブラウザ判定
function getUserBrowser(userAgent) {
    if (!userAgent) return 'unknown';

    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/line/i.test(userAgent)) return 'LINE';
    return 'other';
}

// OS判定（詳細バージョン付き）
function getUserOS(userAgent) {
    if (!userAgent) return 'unknown';

    // iOS: "iOS 17.1.1" or "iPadOS 16.5"
    const iosMatch = userAgent.match(/(?:iPhone|iPad|iPod).*?OS ([\d_]+)/i);
    if (iosMatch) {
        const version = iosMatch[1].replace(/_/g, '.');
        const device = /iPad/i.test(userAgent) ? 'iPadOS' : 'iOS';
        return `${device} ${version}`;
    }

    // Android: "Android 14" or "Android 13.0"
    const androidMatch = userAgent.match(/Android ([\d.]+)/i);
    if (androidMatch) {
        return `Android ${androidMatch[1]}`;
    }

    // Windows: "Windows 10/11" or "Windows 8.1"
    const windowsMatch = userAgent.match(/Windows NT ([\d.]+)/i);
    if (windowsMatch) {
        const ntVersion = windowsMatch[1];
        const windowsVersion = {
            '10.0': '10/11',
            '6.3': '8.1',
            '6.2': '8',
            '6.1': '7',
            '6.0': 'Vista'
        }[ntVersion] || ntVersion;
        return `Windows ${windowsVersion}`;
    }

    // macOS: "macOS 14.1" or "macOS 10.15.7"
    const macMatch = userAgent.match(/Mac OS X ([\d_]+)/i);
    if (macMatch) {
        const version = macMatch[1].replace(/_/g, '.');
        return `macOS ${version}`;
    }

    // Linux (generic)
    if (/linux/i.test(userAgent)) return 'Linux';

    return 'other';
}
```

**User-Agent 例と解析結果:**

| User-Agent | device_type | browser | os |
|-----------|-------------|---------|-----|
| `Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1` | mobile | Safari | iOS 17.1.1 |
| `Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36` | mobile | Chrome | Android 14 |
| `Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1` | tablet | Safari | iPadOS 16.5 |
| `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36` | desktop | Chrome | Windows 10/11 |
| `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36` | desktop | Chrome | macOS 10.15.7 |

---

#### IP アドレス取得

```javascript
function getClientIPFromHeaders(headers) {
    // 優先順位順にチェック
    const ipHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-client-ip',
        'cf-connecting-ip',  // Cloudflare
        'x-forwarded',
        'forwarded-for',
        'forwarded'
    ];

    for (const header of ipHeaders) {
        const value = headers[header];
        if (value) {
            // x-forwarded-for は複数IPを含む可能性がある
            return value.split(',')[0].trim();
        }
    }

    return 'unknown';
}
```

---

### 4.3 get-tracking-stats.js

**役割:** 代理店の訪問統計を取得

**エンドポイント:** `GET /.netlify/functions/get-tracking-stats`

---

#### リクエストヘッダー

```
Authorization: Bearer <agency_code>
```

---

#### 処理フロー

```javascript
exports.handler = async (event, context) => {
    // 1. CORS 処理
    if (event.httpMethod === 'OPTIONS') {
        return corsResponse();
    }

    // 2. GET メソッドのみ許可
    if (event.httpMethod !== 'GET') {
        return errorResponse(405, 'Method not allowed');
    }

    try {
        // 3. 認証（Authorization ヘッダー）
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(401, 'Unauthorized');
        }

        const agencyCode = authHeader.replace('Bearer ', '');

        // 4. 代理店情報取得
        const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .select('*')
            .eq('code', agencyCode)
            .single();

        if (agencyError || !agency) {
            return errorResponse(401, 'Invalid agency code');
        }

        // 5. 訪問記録取得（LEFT JOIN で削除されたリンクも含む）
        const { data: agencyVisits, error: agencyError } = await supabase
            .from('agency_tracking_visits')
            .select(`
                *,
                agency_tracking_links(name, tracking_code),
                line_profiles(user_id, display_name, fetched_at)
            `)
            .eq('agency_id', agency.id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (agencyError) {
            console.error('Error fetching visits:', agencyError);
            return errorResponse(500, 'Failed to fetch visits');
        }

        // 6. 友達タイプ判定
        const visitsWithInfo = agencyVisits.map(visit => {
            let friendType = '未追加';

            if (visit.line_user_id) {
                // metadata に friend_type が記録されている場合
                if (visit.metadata?.friend_type) {
                    friendType = visit.metadata.friend_type === 'new_friend' ? '新規友達' : '既存友達';
                } else {
                    // 訪問日時とLINEプロフィール取得日時を比較
                    const visitDate = new Date(visit.created_at);
                    const profileDate = visit.line_profiles?.fetched_at
                        ? new Date(visit.line_profiles.fetched_at)
                        : null;

                    if (profileDate) {
                        // ±30分以内なら新規友達
                        const timeDiff = Math.abs(visitDate.getTime() - profileDate.getTime());
                        const thirtyMinutes = 30 * 60 * 1000;

                        friendType = timeDiff <= thirtyMinutes ? '新規友達' : '既存友達';
                    } else {
                        // プロフィール情報がない場合はデフォルトで新規友達
                        friendType = '新規友達';
                    }
                }
            }

            return {
                ...visit,
                tracking_link: visit.agency_tracking_links,
                line_user: visit.line_profiles,
                friend_type: friendType,
                ip_address: visit.visitor_ip,
                visited_at: visit.created_at
            };
        });

        // 7. 統計計算
        const totalVisits = visitsWithInfo.length;
        const totalConversions = visitsWithInfo.filter(v => v.line_user_id).length;
        const conversionRate = totalVisits > 0
            ? ((totalConversions / totalVisits) * 100).toFixed(2)
            : '0.00';

        // 8. レスポンス返却
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                visits: visitsWithInfo,
                stats: {
                    total_visits: totalVisits,
                    total_conversions: totalConversions,
                    conversion_rate: conversionRate + '%'
                }
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        return errorResponse(500, 'Internal server error: ' + error.message);
    }
};
```

---

#### レスポンス例

```json
{
  "visits": [
    {
      "id": "dc4aafc5-6eb5-4346-a92c-905f634b03f5",
      "tracking_link": {
        "name": "Twitter広告A",
        "tracking_code": "TWITTER_AD_001"
      },
      "line_user": {
        "display_name": "りゅう",
        "user_id": "U2f9d259e..."
      },
      "friend_type": "新規友達",
      "device_type": "mobile",
      "os": "iOS 17.1.1",
      "browser": "Safari",
      "ip_address": "123.45.67.89",
      "visited_at": "2024-10-23T21:25:55Z"
    }
  ],
  "stats": {
    "total_visits": 150,
    "total_conversions": 45,
    "conversion_rate": "30.00%"
  }
}
```

---

### 4.4 get-master-agency.js

**役割:** マスター代理店情報を取得

**エンドポイント:** `GET /.netlify/functions/get-master-agency`

**処理:**
```javascript
const { data: masterAgency } = await supabase
    .from('agencies')
    .select('*')
    .eq('is_master', true)
    .limit(1);

return {
    statusCode: 200,
    body: JSON.stringify({
        master_agency: masterAgency[0] || null
    })
};
```

---

## 5. 管理画面（Admin Dashboard）

### 5.1 ファイル構成

```
admin/
├── index.html          # メイン画面
├── login.html          # ログイン画面
├── dashboard.js        # Alpine.js ロジック
└── styles.css          # スタイル
```

---

### 5.2 ログイン機能

**ファイル:** `admin/login.html`

```html
<div x-data="loginForm()">
    <form @submit.prevent="login">
        <input
            type="text"
            x-model="agencyCode"
            placeholder="代理店コード"
            required
        />
        <button type="submit">ログイン</button>
        <p x-show="error" class="error" x-text="error"></p>
    </form>
</div>

<script>
function loginForm() {
    return {
        agencyCode: '',
        error: '',

        async login() {
            try {
                // 認証テスト: get-tracking-stats を呼び出し
                const response = await fetch('/.netlify/functions/get-tracking-stats', {
                    headers: {
                        'Authorization': `Bearer ${this.agencyCode}`
                    }
                });

                if (response.ok) {
                    // 認証成功: sessionStorage に保存
                    sessionStorage.setItem('agencyCode', this.agencyCode);
                    window.location.href = 'index.html';
                } else {
                    this.error = '無効な代理店コードです';
                }
            } catch (error) {
                this.error = 'ログインに失敗しました';
            }
        }
    };
}
</script>
```

---

### 5.3 ダッシュボード機能

**ファイル:** `admin/dashboard.js`

#### 主要機能

1. **訪問統計取得**
```javascript
async loadStats() {
    const agencyCode = sessionStorage.getItem('agencyCode');

    const response = await fetch('/.netlify/functions/get-tracking-stats', {
        headers: {
            'Authorization': `Bearer ${agencyCode}`
        }
    });

    const data = await response.json();

    this.visits = data.visits;
    this.stats = data.stats;
}
```

2. **トラッキングリンク一覧**
```javascript
async loadTrackingLinks() {
    const agencyCode = sessionStorage.getItem('agencyCode');

    const response = await fetch('https://gasgenerator.onrender.com/api/admin/tracking-links', {
        headers: {
            'Authorization': `Bearer ${agencyCode}`
        }
    });

    const data = await response.json();
    this.trackingLinks = data.tracking_links;
}
```

3. **マスター代理店コード表示**
```javascript
async loadMasterAgency() {
    const response = await fetch('/.netlify/functions/get-master-agency');
    const data = await response.json();

    if (data.master_agency) {
        this.masterAgencyCode = data.master_agency.code;
    }
}
```

4. **コピー機能**
```javascript
async copyToClipboard(text, event) {
    try {
        await navigator.clipboard.writeText(text);

        const button = event.currentTarget;
        const originalText = button.textContent;
        button.textContent = 'コピーしました！';
        button.classList.add('success');

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('success');
        }, 2000);
    } catch (error) {
        alert('コピーに失敗しました');
    }
}
```

---

## 6. データベース連携

### 6.1 使用テーブル一覧

| テーブル名 | 用途 | Netlify での操作 |
|-----------|------|-----------------|
| `line_profiles` | LINE プロフィール | INSERT, UPSERT |
| `agencies` | 代理店情報 | SELECT |
| `agency_tracking_links` | トラッキングリンク | SELECT, UPDATE (visit_count) |
| `agency_tracking_visits` | 訪問記録 | SELECT, INSERT, UPDATE (line_user_id) |
| `agency_line_conversions` | CV記録 | INSERT |

---

### 6.2 agency_tracking_visits テーブル

#### スキーマ
```sql
CREATE TABLE agency_tracking_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_link_id UUID NOT NULL REFERENCES agency_tracking_links(id),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  line_user_id TEXT REFERENCES line_profiles(user_id),
  visitor_ip TEXT,
  user_agent TEXT,
  device_type TEXT,      -- mobile | desktop | tablet | bot
  browser TEXT,          -- Chrome | Safari | LINE | ...
  os TEXT,               -- iOS 17.1.1 | Android 14 | ...
  referrer TEXT,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_visits_tracking_link ON agency_tracking_visits(tracking_link_id);
CREATE INDEX idx_visits_line_user ON agency_tracking_visits(line_user_id);
CREATE INDEX idx_visits_created_at ON agency_tracking_visits(created_at DESC);
CREATE INDEX idx_visits_unlinked ON agency_tracking_visits(line_user_id) WHERE line_user_id IS NULL;
```

#### metadata JSONB 構造
```json
{
  "friend_type": "new_friend" | "existing_friend",
  "linked_at": "2024-10-23T21:25:57Z",
  "utm_source": "twitter",
  "utm_medium": "social",
  "utm_campaign": "oct_campaign",
  "screen_resolution": "390x844",
  "language": "ja-JP",
  "timezone": "Asia/Tokyo"
}
```

**重要:** `updated_at` カラムは存在しない（2024-10-23 確認）

---

### 6.3 line_profiles テーブル

#### スキーマ
```sql
CREATE TABLE line_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url TEXT,
  status_message TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### UPSERT パターン
```javascript
await supabase
    .from('line_profiles')
    .upsert({
        user_id: userId,
        display_name: userProfile.displayName,
        picture_url: userProfile.pictureUrl,
        status_message: userProfile.statusMessage,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }, {
        onConflict: 'user_id'
    });
```

---

## 7. 環境変数

### 7.1 必須環境変数

| 変数名 | 用途 | 取得方法 |
|--------|------|---------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE API 認証トークン | LINE Developers Console → Messaging API設定 |
| `LINE_CHANNEL_SECRET` | Webhook 署名検証用 | LINE Developers Console → Basic settings |
| `SUPABASE_URL` | Supabase プロジェクトURL | Supabase Dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase 匿名キー | Supabase Dashboard → Project Settings → API → anon key |

**注意:**
- Netlify は `SUPABASE_ANON_KEY` を使用（Render は `SERVICE_ROLE_KEY`）
- `RENDER_WEBHOOK_URL` はハードコード可（コード内に直接記述）

---

### 7.2 環境変数の設定方法（Netlify）

```
1. Netlify Dashboard にアクセス
2. "elegant-gumdrop-9a983a" サイトを選択
3. "Site settings" → "Environment variables"
4. "Add a variable" で追加
5. "Deploy site" で再デプロイ（自動）
```

---

## 8. デプロイ手順

### 8.1 自動デプロイ設定

**GitHub 連携:**
```
Repository: IKEMENLTD/gasgenerator
Branch: main
Base directory: netlify-tracking
```

**ビルド設定:**
```
Build command: (なし)
Publish directory: public
Functions directory: netlify/functions
```

---

### 8.2 デプロイフロー

```
1. GitHub に main ブランチへ push（netlify-tracking/配下）
   ↓
2. Netlify が自動検知
   ↓
3. デプロイ開始
   - Functions のビルド（依存関係インストール）
   - 静的ファイルのアップロード
   ↓
4. デプロイ完了（約30秒-1分）
   ↓
5. 即座に反映
```

---

### 8.3 デプロイ後の確認

#### Functions テスト
```bash
# トラッキング機能テスト
curl -X POST https://taskmateai.net/.netlify/functions/track-visit \
  -H "Content-Type: application/json" \
  -d '{"tracking_code":"TEST001"}'
```

#### LINE Webhook テスト
```bash
# 実際に LINE から友達追加またはメッセージ送信
```

#### ログ確認
```
1. Netlify Dashboard → elegant-gumdrop-9a983a
2. "Functions" タブをクリック
3. "line-webhook" を選択
4. ログが表示される
```

---

## 9. トラブルシューティング

### 9.1 LINE 名が表示されない

#### 症状
管理画面の訪問履歴で LINE 名が `-` になる

#### 原因
1. メッセージを送っていない（メッセージイベントでのみ記録）
2. `getLineUserProfile` がエラーを返している
3. UPSERT が失敗している

#### 確認方法
```
1. Netlify Functions ログを開く
2. "line-webhook" を選択
3. 以下のログを探す:
   ✅ LINE Profile upsert成功: りゅう
```

#### 対処法
- ログに `✅ LINE Profile upsert成功` が出ていない場合:
  - `LINE_CHANNEL_ACCESS_TOKEN` が正しいか確認
  - LINE API がエラーを返していないか確認

---

### 9.2 訪問記録が紐付けられない

#### 症状
```
❌ Visit dc4aafc5-... の更新に失敗:
Could not find the 'updated_at' column of 'agency_tracking_visits'
```

#### 原因
`agency_tracking_visits` テーブルに `updated_at` カラムが存在しない

#### 修正済み（2024-10-23）
```javascript
// BEFORE
.update({
  line_user_id: userId,
  metadata: {...},
  updated_at: new Date().toISOString()  // ← 削除
})

// AFTER
.update({
  line_user_id: userId,
  metadata: {...}
})
```

---

### 9.3 Render 転送が失敗

#### 症状
```
❌ Background forward to Render failed: timeout
```

#### 原因
`await` なしで `forwardToRender` を呼んでいた（関数が早期終了）

#### 修正済み（2024-10-21）
```javascript
// BEFORE
forwardToRender(body, signature).catch(...)

// AFTER
await forwardToRender(body, signature)
```

---

### 9.4 ログ確認方法

#### Netlify Functions ログ
```
https://app.netlify.com/
↓
"elegant-gumdrop-9a983a" をクリック
↓
"Functions" タブをクリック
↓
"line-webhook" を選択
↓
ログが表示される
```

**探すべきキーワード:**
- `✅ LINE Profile upsert成功` → LINE 名記録成功
- `❌ Visit ... の更新に失敗` → 訪問記録紐付けエラー
- `🚀 Render転送を開始` → 転送開始
- `✅ Render forward successful` → 転送成功

---

## 付録

### A. 主要なコミット履歴

| 日付 | コミット | 内容 |
|------|---------|------|
| 2024-10-23 | `5dbf4d5` | updated_at エラー修正 + スマホOSバージョン詳細取得 |
| 2024-10-22 | `892b06c` | LINE Profile UPSERT 追加（既存友達の LINE 名記録） |
| 2024-10-21 | `d140a7b` | await forwardToRender 修正（関数早期終了防止） |
| 2024-10-20 | `80aa2ab` | 辛口レビューで発見したバグ全修正（N+1クエリ等） |

---

### B. 今後の改善案

#### 優先度: 高
1. **A/Bテスト機能**: トラッキングリンクの効果測定
2. **リアルタイム統計**: WebSocket でリアルタイム更新

#### 優先度: 中
1. **QRコードに訪問ID埋め込み**: デバイス情報の正確性向上
2. **エクスポート機能**: CSV/Excel ダウンロード

---

### C. 参考リンク

- **Netlify Functions**: https://docs.netlify.com/functions/overview/
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript/introduction
- **Alpine.js**: https://alpinejs.dev/
- **Chart.js**: https://www.chartjs.org/

---

**Netlify側ドキュメント終了**

このファイルは Netlify 側システムの完全なリファレンスです。
変更があった場合は、このファイルも合わせて更新してください。
