const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Simple admin authentication check
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer admin:')) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    if (event.httpMethod === 'GET') {
        try {
            // Fetch all agencies with owner information
            const { data: agencies, error } = await supabase
                .from('agencies')
                .select(`
                    *,
                    agency_users!inner(
                        name,
                        email
                    )
                `)
                .eq('agency_users.role', 'owner')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Format the response
            const formattedAgencies = agencies.map(agency => ({
                id: agency.id,
                code: agency.code,
                name: agency.name,
                company_name: agency.company_name,
                contact_email: agency.contact_email,
                contact_phone: agency.contact_phone,
                address: agency.address,
                status: agency.status || 'pending',
                commission_rate: agency.commission_rate,
                created_at: agency.created_at,
                owner_name: agency.agency_users[0]?.name || 'N/A',
                owner_email: agency.agency_users[0]?.email || agency.contact_email
            }));

            // Calculate statistics
            // 承認待ちにはpending, pending_line_verification, pending_friend_addを全て含める
            const pendingStatuses = ['pending', 'pending_line_verification', 'pending_friend_add'];
            const stats = {
                total: formattedAgencies.length,
                pending: formattedAgencies.filter(a => pendingStatuses.includes(a.status)).length,
                active: formattedAgencies.filter(a => a.status === 'active').length,
                rejected: formattedAgencies.filter(a => a.status === 'rejected').length,
                suspended: formattedAgencies.filter(a => a.status === 'suspended').length
            };

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    agencies: formattedAgencies,
                    stats
                })
            };

        } catch (error) {
            console.error('Error fetching agencies:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to fetch agencies' })
            };
        }
    }

    if (event.httpMethod === 'POST') {
        try {
            const { action, agencyId } = JSON.parse(event.body);

            if (!action || !agencyId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing action or agencyId' })
                };
            }

            let newStatus;
            switch (action) {
                case 'approve':
                    newStatus = 'active';
                    break;
                case 'reject':
                    newStatus = 'rejected';
                    break;
                case 'suspend':
                    newStatus = 'suspended';
                    break;
                case 'activate':
                    newStatus = 'active';
                    break;
                default:
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Invalid action' })
                    };
            }

            // Update agency status
            const { data, error } = await supabase
                .from('agencies')
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', agencyId)
                .select()
                .single();

            if (error) throw error;

            // If approving, also activate the owner user account
            if (action === 'approve') {
                await supabase
                    .from('agency_users')
                    .update({ is_active: true })
                    .eq('agency_id', agencyId)
                    .eq('role', 'owner');

                // Send approval notification email (non-blocking)
                try {
                    await sendApprovalEmail(data);
                } catch (emailError) {
                    console.error('Approval email failed (non-blocking):', emailError);
                }
            }

            // If rejecting or suspending, deactivate all user accounts
            if (action === 'reject' || action === 'suspend') {
                await supabase
                    .from('agency_users')
                    .update({ is_active: false })
                    .eq('agency_id', agencyId);
            }

            // Send notification emails (non-blocking)
            if (action === 'reject') {
                try {
                    await sendRejectionEmail(data);
                } catch (emailError) {
                    console.error('Rejection email failed (non-blocking):', emailError);
                }
            }

            if (action === 'suspend') {
                try {
                    await sendNotificationEmail(data, 'TaskMate AI 代理店アカウント一時停止のお知らせ', buildSuspensionEmailHtml(data));
                } catch (emailError) {
                    console.error('Suspension email failed (non-blocking):', emailError);
                }
            }

            if (action === 'activate') {
                try {
                    await sendNotificationEmail(data, 'TaskMate AI 代理店アカウント再開のお知らせ', buildReactivationEmailHtml(data));
                } catch (emailError) {
                    console.error('Reactivation email failed (non-blocking):', emailError);
                }
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    agency: data,
                    message: `代理店を${getActionMessage(action)}しました`
                })
            };

        } catch (error) {
            console.error('Error updating agency:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to update agency status' })
            };
        }
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};

function getActionMessage(action) {
    const messages = {
        'approve': '承認',
        'reject': '非承認',
        'suspend': '一時停止',
        'activate': '再開'
    };
    return messages[action] || action;
}

async function sendApprovalEmail(agency) {
    if (!agency.contact_email) {
        console.log('No contact_email for agency:', agency.name);
        return;
    }

    const emailHtml = buildApprovalEmailHtml(agency);
    const subject = 'TaskMate AI 代理店パートナー承認完了のお知らせ';

    // Resend API (優先)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
        const fromAddress = 'TaskMate AI <noreply@taskmateai.net>';
        console.log('Sending approval email via Resend to:', agency.contact_email);
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [agency.contact_email],
                subject: subject,
                html: emailHtml
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Resend API error ${response.status}: ${errorBody}`);
        }
        console.log('Approval email sent via Resend to:', agency.contact_email);
        return;
    }

    // SendGrid API (フォールバック)
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (sendgridKey) {
        const fromEmail = process.env.EMAIL_FROM || 'noreply@taskmateai.net';
        console.log('Sending approval email via SendGrid to:', agency.contact_email);
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sendgridKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: agency.contact_email }] }],
                from: { email: fromEmail, name: 'TaskMate AI' },
                subject: subject,
                content: [{ type: 'text/html', value: emailHtml }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`SendGrid API error ${response.status}: ${errorBody}`);
        }
        console.log('Approval email sent via SendGrid to:', agency.contact_email);
        return;
    }

    console.log('No email API key set - skipping email for:', agency.name);
}

async function sendRejectionEmail(agency) {
    if (!agency.contact_email) {
        console.log('No contact_email for agency:', agency.name);
        return;
    }

    const emailHtml = buildRejectionEmailHtml(agency);
    const subject = 'TaskMate AI 代理店パートナー申請の審査結果について';

    // Resend API (優先)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
        const fromAddress = 'TaskMate AI <noreply@taskmateai.net>';
        console.log('Sending rejection email via Resend to:', agency.contact_email);
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [agency.contact_email],
                subject: subject,
                html: emailHtml
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Resend API error ${response.status}: ${errorBody}`);
        }
        console.log('Rejection email sent via Resend to:', agency.contact_email);
        return;
    }

    // SendGrid API (フォールバック)
    const sendgridKey = process.env.SENDGRID_API_KEY;
    if (sendgridKey) {
        const fromEmail = process.env.EMAIL_FROM || 'noreply@taskmateai.net';
        console.log('Sending rejection email via SendGrid to:', agency.contact_email);
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sendgridKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: agency.contact_email }] }],
                from: { email: fromEmail, name: 'TaskMate AI' },
                subject: subject,
                content: [{ type: 'text/html', value: emailHtml }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`SendGrid API error ${response.status}: ${errorBody}`);
        }
        console.log('Rejection email sent via SendGrid to:', agency.contact_email);
        return;
    }

    console.log('No email API key set - skipping rejection email for:', agency.name);
}

function buildRejectionEmailHtml(agency) {
    const agencyName = agency.name || '(未設定)';
    const contactEmail = agency.contact_email || '';

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>代理店申請 審査結果のお知らせ - TaskMate AI</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
<tr><td align="center" style="padding:32px 16px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background-color:#1a1a2e;padding:40px 48px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;line-height:1.3;">TaskMate AI</td></tr>
<tr><td style="padding-top:8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td style="width:40px;height:1px;background-color:#3b5bdb;"></td>
<td style="padding:0 12px;font-size:12px;font-weight:600;color:#8a8ab0;letter-spacing:3px;text-transform:uppercase;">Agency Partner Program</td>
<td style="width:40px;height:1px;background-color:#3b5bdb;"></td>
</tr>
</table>
</td></tr>
</table>
</td>
</tr>

<!-- Accent line -->
<tr><td style="height:3px;background:linear-gradient(90deg,#3b5bdb,#5f7de8,#3b5bdb);"></td></tr>

<!-- Greeting & Result -->
<tr>
<td style="padding:48px 48px 32px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:20px;font-weight:700;color:#1a1a2e;line-height:1.4;padding-bottom:24px;">代理店パートナー申請の審査結果について</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;padding-bottom:16px;">${agencyName} 御中</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;padding-bottom:16px;">この度は、TaskMate AI 代理店パートナープログラムへお申し込みいただき、誠にありがとうございます。貴社のご関心に深く感謝申し上げます。</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;padding-bottom:16px;">慎重かつ総合的な審査を行いました結果、誠に恐縮ではございますが、今回は代理店パートナーとしての承認を見送らせていただくこととなりました。</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;">ご期待に沿えず大変申し訳ございませんが、何卒ご理解賜りますようお願い申し上げます。</td></tr>
</table>
</td>
</tr>

<!-- Status Box -->
<tr>
<td style="padding:0 48px 32px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fc;border-radius:6px;border:1px solid #e8eaf0;">
<tr><td style="padding:24px 28px 12px 28px;font-size:13px;font-weight:700;color:#1a1a2e;letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid #e8eaf0;">申請情報</td></tr>
<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:16px 28px 0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:4px;">代理店名</td></tr>
<tr><td style="font-size:15px;color:#333333;font-weight:600;">${agencyName}</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 28px 0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:4px;">連絡先メールアドレス</td></tr>
<tr><td style="font-size:15px;color:#333333;">${contactEmail}</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 28px 20px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:4px;">審査結果</td></tr>
<tr><td><span style="display:inline-block;background-color:#fbe9e7;color:#c62828;font-size:13px;font-weight:700;padding:4px 14px;border-radius:12px;letter-spacing:0.5px;">非承認</span></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:0 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background-color:#e8eaf0;"></td></tr></table></td></tr>

<!-- Re-application Section -->
<tr>
<td style="padding:40px 48px 40px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:18px;font-weight:700;color:#1a1a2e;padding-bottom:8px;line-height:1.4;">再申請について</td></tr>
<tr><td style="font-size:14px;color:#666666;padding-bottom:24px;line-height:1.6;">今回の結果にかかわらず、条件を改善いただいたうえでの再申請を歓迎しております。</td></tr>

<tr><td style="padding-bottom:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2ff;border-radius:6px;border-left:4px solid #3b5bdb;">
<tr><td style="padding:24px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:15px;font-weight:700;color:#1a1a2e;padding-bottom:12px;line-height:1.4;">再申請のご案内</td></tr>
<tr><td style="padding-bottom:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="28" valign="top" style="font-size:14px;color:#3b5bdb;font-weight:700;padding-top:2px;">1.</td>
<td style="font-size:14px;color:#555555;line-height:1.7;padding-bottom:8px;">再申請に期間の制限はございません。準備が整いましたらいつでもお申し込みいただけます。</td>
</tr>
</table>
</td></tr>
<tr><td style="padding-bottom:12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="28" valign="top" style="font-size:14px;color:#3b5bdb;font-weight:700;padding-top:2px;">2.</td>
<td style="font-size:14px;color:#555555;line-height:1.7;padding-bottom:8px;">事業内容や販売体制等について変更・改善がございましたら、その旨を添えてお申し込みください。</td>
</tr>
</table>
</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="28" valign="top" style="font-size:14px;color:#3b5bdb;font-weight:700;padding-top:2px;">3.</td>
<td style="font-size:14px;color:#555555;line-height:1.7;">ご不明な点がございましたら、下記サポート窓口までお気軽にお問い合わせください。</td>
</tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>

</table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:0 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background-color:#e8eaf0;"></td></tr></table></td></tr>

<!-- Support -->
<tr>
<td style="padding:40px 48px 40px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td style="text-align:center;">
<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#1a1a2e;line-height:1.4;">お問い合わせ</p>
<p style="margin:0 0 20px;font-size:14px;color:#555555;line-height:1.7;">審査結果に関するご質問やご相談がございましたら、<br>サポート窓口までお気軽にご連絡ください。</p>
<a href="https://ikemen.ltd/contact/" style="display:inline-block;background-color:#3b5bdb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 36px;border-radius:6px;letter-spacing:0.5px;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">サポートに問い合わせる</a>
<p style="margin:12px 0 0;font-size:12px;color:#999999;">https://ikemen.ltd/contact/</p>
</td></tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#1a1a2e;border-radius:0 0 8px 8px;">
<tr><td style="padding:32px 48px;text-align:center;">
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#ffffff;line-height:1.5;">TaskMate AI</p>
<p style="margin:0 0 16px;font-size:12px;color:#a0a0b8;line-height:1.5;">Google Apps Script 自動化プラットフォーム</p>
<p style="margin:0 0 8px;font-size:12px;color:#a0a0b8;line-height:1.5;">IKEMEN LTD. All rights reserved.</p>
<p style="margin:0;font-size:11px;color:#6b6b88;line-height:1.5;">このメールは代理店パートナー審査結果の通知として自動送信されています。</p>
</td></tr>
</table>
</td>
</tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}

function buildApprovalEmailHtml(agency) {
    const agencyName = agency.name || '(未設定)';
    const agencyCode = agency.code || '(未設定)';
    const contactEmail = agency.contact_email || '';

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>代理店承認完了のお知らせ - TaskMate AI</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
<tr><td align="center" style="padding:32px 16px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background-color:#1a1a2e;padding:40px 48px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;line-height:1.3;">TaskMate AI</td></tr>
<tr><td style="padding-top:8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td style="width:40px;height:1px;background-color:#3b5bdb;"></td>
<td style="padding:0 12px;font-size:12px;font-weight:600;color:#8a8ab0;letter-spacing:3px;text-transform:uppercase;">Agency Partner Program</td>
<td style="width:40px;height:1px;background-color:#3b5bdb;"></td>
</tr>
</table>
</td></tr>
</table>
</td>
</tr>

<!-- Accent line -->
<tr><td style="height:3px;background:linear-gradient(90deg,#3b5bdb,#5f7de8,#3b5bdb);"></td></tr>

<!-- Greeting -->
<tr>
<td style="padding:48px 48px 32px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:20px;font-weight:700;color:#1a1a2e;line-height:1.4;padding-bottom:24px;">代理店パートナー承認のお知らせ</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;padding-bottom:16px;">${agencyName} 御中</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;padding-bottom:16px;">この度は、TaskMate AI 代理店パートナープログラムへお申し込みいただき、誠にありがとうございます。</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;padding-bottom:16px;">厳正なる審査の結果、貴社を正式な代理店パートナーとして承認いたしましたことをお知らせいたします。本日より、144種類の業務自動化システムを貴社のお客様へご提案いただけます。</td></tr>
<tr><td style="font-size:15px;color:#333333;line-height:1.8;">貴社とのパートナーシップを通じて、より多くの企業様の業務効率化に貢献できることを心より楽しみにしております。</td></tr>
</table>
</td>
</tr>

<!-- Account Info -->
<tr>
<td style="padding:0 48px 32px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fc;border-radius:6px;border:1px solid #e8eaf0;">
<tr><td style="padding:24px 28px 12px 28px;font-size:13px;font-weight:700;color:#1a1a2e;letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid #e8eaf0;">アカウント情報</td></tr>
<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:16px 28px 0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:4px;">代理店名</td></tr>
<tr><td style="font-size:15px;color:#333333;font-weight:600;">${agencyName}</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 28px 0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:4px;">代理店コード</td></tr>
<tr><td style="font-size:15px;color:#3b5bdb;font-weight:700;font-family:'Courier New',Courier,monospace;letter-spacing:1px;">${agencyCode}</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 28px 0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:4px;">ログインメール</td></tr>
<tr><td style="font-size:15px;color:#333333;">${contactEmail}</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 28px 20px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:4px;">ステータス</td></tr>
<tr><td><span style="display:inline-block;background-color:#e8f5e9;color:#2e7d32;font-size:13px;font-weight:700;padding:4px 14px;border-radius:12px;letter-spacing:0.5px;">承認済み</span></td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</td>
</tr>

<!-- Login CTA -->
<tr>
<td style="padding:0 48px 40px 48px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="background-color:#3b5bdb;border-radius:6px;">
<a href="https://taskmateai.net/agency/" target="_blank" style="display:inline-block;padding:16px 48px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.5px;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">代理店ポータルにログイン</a>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding-top:12px;font-size:12px;color:#999999;">https://taskmateai.net/agency/</td></tr>
</table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:0 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background-color:#e8eaf0;"></td></tr></table></td></tr>

<!-- First 3 Steps -->
<tr>
<td style="padding:40px 48px 48px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:18px;font-weight:700;color:#1a1a2e;padding-bottom:8px;line-height:1.4;">はじめの3ステップ</td></tr>
<tr><td style="font-size:14px;color:#666666;padding-bottom:28px;line-height:1.6;">承認完了後、以下の手順でお客様への紹介を開始いただけます。</td></tr>

<!-- Step 1 -->
<tr><td style="padding-bottom:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="48" valign="top" style="padding-right:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:44px;height:44px;background-color:#3b5bdb;border-radius:50%;text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:#ffffff;line-height:44px;">1</td></tr></table>
</td>
<td valign="top">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:15px;font-weight:700;color:#1a1a2e;padding-bottom:4px;line-height:1.4;">代理店ポータルにログイン</td></tr>
<tr><td style="font-size:14px;color:#555555;line-height:1.7;">申請時に登録したメールアドレスとパスワードで代理店ポータルにログインしてください。ダッシュボードから各種機能をご利用いただけます。</td></tr>
</table>
</td>
</tr>
</table>
</td></tr>

<!-- Connector -->
<tr><td style="padding:0 0 24px 21px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:2px;height:16px;background-color:#d0d7e8;"></td></tr></table></td></tr>

<!-- Step 2 -->
<tr><td style="padding-bottom:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="48" valign="top" style="padding-right:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:44px;height:44px;background-color:#3b5bdb;border-radius:50%;text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:#ffffff;line-height:44px;">2</td></tr></table>
</td>
<td valign="top">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:15px;font-weight:700;color:#1a1a2e;padding-bottom:4px;line-height:1.4;">トラッキングリンクを作成</td></tr>
<tr><td style="font-size:14px;color:#555555;line-height:1.7;padding-bottom:10px;">ポータルの「リンク作成」タブから、貴社専用のトラッキングリンクを生成してください。お客様の流入経路を正確に計測し、成果報酬の対象となります。</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f8;border-radius:4px;border-left:3px solid #3b5bdb;">
<tr><td style="padding:10px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:11px;color:#888899;font-weight:600;letter-spacing:0.5px;padding-bottom:2px;">リンク形式</td></tr>
<tr><td style="font-size:14px;color:#3b5bdb;font-family:'Courier New',Courier,monospace;font-weight:600;">https://taskmateai.net/t/{コード}</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</td>
</tr>
</table>
</td></tr>

<!-- Connector -->
<tr><td style="padding:0 0 24px 21px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:2px;height:16px;background-color:#d0d7e8;"></td></tr></table></td></tr>

<!-- Step 3 -->
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="48" valign="top" style="padding-right:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:44px;height:44px;background-color:#3b5bdb;border-radius:50%;text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:#ffffff;line-height:44px;">3</td></tr></table>
</td>
<td valign="top">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:15px;font-weight:700;color:#1a1a2e;padding-bottom:4px;line-height:1.4;">お客様にリンクを共有して紹介開始</td></tr>
<tr><td style="font-size:14px;color:#555555;line-height:1.7;">作成したトラッキングリンクをお客様にご案内ください。リンク経由でお客様がTaskMate AIに登録されると、貴社の成果として自動的に記録されます。訪問状況はポータルの「訪問分析」タブからリアルタイムで確認いただけます。</td></tr>
</table>
</td>
</tr>
</table>
</td></tr>

</table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:0 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background-color:#e8eaf0;"></td></tr></table></td></tr>

<!-- Customer Templates Section -->
<tr>
<td style="padding:40px 48px 48px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:18px;font-weight:700;color:#1a1a2e;padding-bottom:8px;line-height:1.4;">お客様へのご案内テンプレート</td></tr>
<tr><td style="font-size:14px;color:#666666;padding-bottom:24px;line-height:1.6;">以下のテンプレートをコピーし、変数部分をご自身の情報に置き換えてご利用ください。</td></tr>

<!-- Variable guide -->
<tr><td style="padding-bottom:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2ff;border-radius:6px;border-left:4px solid #3b5bdb;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1a1a2e;">テンプレートの使い方</p>
<p style="margin:0;font-size:13px;color:#555555;line-height:1.7;">下記の変数をご自身の情報に置き換えてご利用ください。<br>
<span style="display:inline-block;margin-top:4px;font-family:monospace;font-size:12px;color:#3b5bdb;background:#e8ecfa;padding:2px 6px;border-radius:3px;">{顧客名}</span>
<span style="display:inline-block;margin-top:4px;font-family:monospace;font-size:12px;color:#3b5bdb;background:#e8ecfa;padding:2px 6px;border-radius:3px;">{あなたのトラッキングリンク}</span>
<span style="display:inline-block;margin-top:4px;font-family:monospace;font-size:12px;color:#3b5bdb;background:#e8ecfa;padding:2px 6px;border-radius:3px;">{あなたの名前}</span>
<span style="display:inline-block;margin-top:4px;font-family:monospace;font-size:12px;color:#3b5bdb;background:#e8ecfa;padding:2px 6px;border-radius:3px;">{あなたの会社名}</span>
</p>
</td></tr>
</table>
</td></tr>

<!-- Pattern 1: Formal -->
<tr><td style="padding-bottom:4px;"><span style="display:inline-block;background-color:#1a1a2e;color:#ffffff;font-size:11px;font-weight:700;padding:5px 14px;border-radius:4px 4px 0 0;letter-spacing:0.5px;">パターン1: 新規法人向け（フォーマル）</span></td></tr>
<tr><td style="padding-bottom:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e0e0e0;border-radius:0 6px 6px 6px;">
<tr><td style="padding:28px;font-size:14px;color:#333333;line-height:1.85;">
<p style="margin:0 0 20px;">件名: 【ご案内】業務効率を大幅に改善するAI自動化サービスのご紹介</p>
<p style="margin:0 0 20px;">{顧客名} 御中</p>
<p style="margin:0 0 16px;">平素より大変お世話になっております。<br>{あなたの会社名}の{あなたの名前}でございます。</p>
<p style="margin:0 0 16px;">本日は、貴社の業務効率化にお役立ていただけるサービスをご案内させていただきたく、ご連絡を差し上げました。</p>
<p style="margin:0 0 16px;">「TaskMate AI」は、Google Apps Script（GAS）を活用した業務自動化プラットフォームです。日報作成、請求書発行、勤怠集計、顧客管理、契約更新リマインドなど、144種類の自動化システムを取り揃えており、貴社の業務課題に合わせて最適なシステムをご提案いたします。</p>
<p style="margin:0 0 16px;">導入企業様からは「月あたり40時間以上の工数削減につながった」というお声もいただいております。Google Workspace（Gmail、スプレッドシート、カレンダー等）との連携を前提に設計されているため、既存の業務環境をそのままお使いいただけます。</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr><td style="background-color:#f0f2ff;border-radius:6px;padding:20px;">
<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1a1a2e;">詳細のご確認はこちら</p>
<p style="margin:0 0 8px;font-size:13px;color:#333333;line-height:1.7;">サービス紹介ページ:<br><span style="color:#3b5bdb;">{あなたのトラッキングリンク}</span></p>
<p style="margin:0;font-size:13px;color:#333333;line-height:1.7;">144種類のシステムカタログ:<br><a href="https://taskmate-system-catalog.netlify.app" style="color:#3b5bdb;text-decoration:underline;">https://taskmate-system-catalog.netlify.app</a></p>
</td></tr>
</table>
<p style="margin:0 0 16px;">ご興味をお持ちいただけましたら、オンラインでのデモンストレーションや個別のご相談も承っております。ご都合のよろしい日時をお知らせいただけましたら幸いです。</p>
<p style="margin:0 0 16px;">何卒よろしくお願い申し上げます。</p>
<p style="margin:0;">──────────────────<br>{あなたの名前}<br>{あなたの会社名}<br>──────────────────</p>
</td></tr>
</table>
</td></tr>

<!-- Pattern 2: Casual -->
<tr><td style="padding-bottom:4px;"><span style="display:inline-block;background-color:#1a1a2e;color:#ffffff;font-size:11px;font-weight:700;padding:5px 14px;border-radius:4px 4px 0 0;letter-spacing:0.5px;">パターン2: 既存取引先・知人向け（カジュアル）</span></td></tr>
<tr><td style="padding-bottom:32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e0e0e0;border-radius:0 6px 6px 6px;">
<tr><td style="padding:28px;font-size:14px;color:#333333;line-height:1.85;">
<p style="margin:0 0 20px;">件名: 業務の手間を減らせるサービス、ご紹介させてください</p>
<p style="margin:0 0 20px;">{顧客名} 様</p>
<p style="margin:0 0 16px;">いつもお世話になっております。{あなたの名前}です。</p>
<p style="margin:0 0 16px;">突然ですが、「毎月同じ作業に時間を取られている」「スプレッドシートの手入力が多い」といったお悩みはありませんか？</p>
<p style="margin:0 0 16px;">最近、自信を持っておすすめできるサービスを見つけましたので共有させてください。「TaskMate AI」というサービスで、Google Apps Scriptを使った業務自動化を手軽に導入できるものです。</p>
<p style="margin:0 0 12px;">具体的には、こんなことが自動化できます。</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 8px;">
<tr><td style="padding:3px 0;font-size:14px;color:#333333;line-height:1.7;">- 日報・月報の自動集計と配信</td></tr>
<tr><td style="padding:3px 0;font-size:14px;color:#333333;line-height:1.7;">- 請求書の自動生成と送付</td></tr>
<tr><td style="padding:3px 0;font-size:14px;color:#333333;line-height:1.7;">- 契約更新や期限のリマインド通知</td></tr>
<tr><td style="padding:3px 0;font-size:14px;color:#333333;line-height:1.7;">- 勤怠データの集計から給与計算への連携</td></tr>
<tr><td style="padding:3px 0;font-size:14px;color:#333333;line-height:1.7;">- その他、全144種類のシステムに対応</td></tr>
</table>
<p style="margin:0 0 16px;">今お使いのGmail・スプレッドシート・カレンダーをそのまま活かせるので、新しいツールの学習コストもかかりません。</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr><td style="background-color:#f0f2ff;border-radius:6px;padding:20px;">
<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1a1a2e;">詳しくはこちらをご覧ください</p>
<p style="margin:0 0 8px;font-size:13px;color:#333333;line-height:1.7;">サービス紹介: <span style="color:#3b5bdb;">{あなたのトラッキングリンク}</span></p>
<p style="margin:0;font-size:13px;color:#333333;line-height:1.7;">システム一覧: <a href="https://taskmate-system-catalog.netlify.app" style="color:#3b5bdb;text-decoration:underline;">https://taskmate-system-catalog.netlify.app</a></p>
</td></tr>
</table>
<p style="margin:0 0 16px;">「うちの業務だとどう使える？」という相談も大歓迎ですので、気軽にご連絡ください。</p>
<p style="margin:0;">{あなたの名前}（{あなたの会社名}）</p>
</td></tr>
</table>
</td></tr>

<!-- Pattern 3: LINE/Chat -->
<tr><td style="padding-bottom:4px;"><span style="display:inline-block;background-color:#1a1a2e;color:#ffffff;font-size:11px;font-weight:700;padding:5px 14px;border-radius:4px 4px 0 0;letter-spacing:0.5px;">パターン3: LINE / チャット用（短文）</span></td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e0e0e0;border-radius:0 6px 6px 6px;">
<tr><td style="padding:28px;font-size:14px;color:#333333;line-height:1.85;">
<p style="margin:0 0 16px;">{顧客名}さん、お疲れさまです。{あなたの名前}です。</p>
<p style="margin:0 0 16px;">日報作成やデータ集計など、毎日の定型業務を自動化できるサービスがあります。GoogleスプレッドシートやGmailと連携して、144種類の業務を自動化できる「TaskMate AI」というサービスです。</p>
<p style="margin:0 0 8px;">詳細はこちら:</p>
<p style="margin:0 0 6px;"><span style="color:#3b5bdb;">{あなたのトラッキングリンク}</span></p>
<p style="margin:0 0 16px;"><a href="https://taskmate-system-catalog.netlify.app" style="color:#3b5bdb;text-decoration:underline;">https://taskmate-system-catalog.netlify.app</a>（システム一覧）</p>
<p style="margin:0;">興味があれば詳しくご説明しますので、お気軽にご連絡ください。</p>
</td></tr>
</table>
</td></tr>

</table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:0 48px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background-color:#e8eaf0;"></td></tr></table></td></tr>

<!-- Commission Table -->
<tr>
<td style="padding:40px 48px 40px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td style="padding-bottom:16px;"><h2 style="margin:0;font-size:18px;font-weight:700;color:#1a1a2e;line-height:1.4;">4段階コミッション制度</h2></td></tr>
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;">
<tr>
<th style="background-color:#1a1a2e;color:#ffffff;font-size:13px;font-weight:600;padding:12px 14px;text-align:center;border-right:1px solid #2a2a4e;">レベル</th>
<th style="background-color:#1a1a2e;color:#ffffff;font-size:13px;font-weight:600;padding:12px 14px;text-align:left;border-right:1px solid #2a2a4e;">名称</th>
<th style="background-color:#1a1a2e;color:#ffffff;font-size:13px;font-weight:600;padding:12px 14px;text-align:center;border-right:1px solid #2a2a4e;">自己報酬率</th>
<th style="background-color:#1a1a2e;color:#ffffff;font-size:13px;font-weight:600;padding:12px 14px;text-align:center;">傘下報酬</th>
</tr>
<tr>
<td style="background-color:#ffffff;font-size:14px;color:#333333;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;font-weight:600;">Lv.1</td>
<td style="background-color:#ffffff;font-size:14px;color:#333333;padding:11px 14px;text-align:left;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">統括代理店</td>
<td style="background-color:#ffffff;font-size:14px;color:#3b5bdb;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;font-weight:700;">20%</td>
<td style="background-color:#ffffff;font-size:14px;color:#333333;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;">2%</td>
</tr>
<tr>
<td style="background-color:#f8f9fa;font-size:14px;color:#333333;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;font-weight:600;">Lv.2</td>
<td style="background-color:#f8f9fa;font-size:14px;color:#333333;padding:11px 14px;text-align:left;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">正規代理店</td>
<td style="background-color:#f8f9fa;font-size:14px;color:#3b5bdb;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;font-weight:700;">18%</td>
<td style="background-color:#f8f9fa;font-size:14px;color:#333333;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;">2%</td>
</tr>
<tr>
<td style="background-color:#ffffff;font-size:14px;color:#333333;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;font-weight:600;">Lv.3</td>
<td style="background-color:#ffffff;font-size:14px;color:#333333;padding:11px 14px;text-align:left;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">販売代理店</td>
<td style="background-color:#ffffff;font-size:14px;color:#3b5bdb;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;border-right:1px solid #e0e0e0;font-weight:700;">16%</td>
<td style="background-color:#ffffff;font-size:14px;color:#333333;padding:11px 14px;text-align:center;border-bottom:1px solid #e0e0e0;">2%</td>
</tr>
<tr>
<td style="background-color:#f8f9fa;font-size:14px;color:#333333;padding:11px 14px;text-align:center;border-right:1px solid #e0e0e0;font-weight:600;">Lv.4</td>
<td style="background-color:#f8f9fa;font-size:14px;color:#333333;padding:11px 14px;text-align:left;border-right:1px solid #e0e0e0;">営業代理店</td>
<td style="background-color:#f8f9fa;font-size:14px;color:#3b5bdb;padding:11px 14px;text-align:center;border-right:1px solid #e0e0e0;font-weight:700;">14%</td>
<td style="background-color:#f8f9fa;font-size:14px;color:#999999;padding:11px 14px;text-align:center;">-</td>
</tr>
</table>
</td></tr>
<tr><td style="padding-top:14px;"><p style="margin:0;font-size:13px;color:#666666;line-height:1.7;">傘下に代理店を紹介すると、傘下代理店の売上に対して2%の追加報酬が発生します。昇格条件等の詳細はポータルでご確認ください。</p></td></tr>
</table>
</td>
</tr>

<!-- Reference Links -->
<tr>
<td style="padding:0 48px 40px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#f8f9fa;border-radius:6px;">
<tr><td style="padding:24px 28px;">
<h3 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1a1a2e;">参考リンク</h3>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr><td style="padding:6px 0;font-size:14px;color:#333333;line-height:1.6;"><span style="color:#666666;">代理店ポータル:</span> <a href="https://taskmateai.net/agency/" style="color:#3b5bdb;text-decoration:none;">taskmateai.net/agency/</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#333333;line-height:1.6;"><span style="color:#666666;">TaskMate AI LP:</span> <a href="https://taskmateai.net" style="color:#3b5bdb;text-decoration:none;">taskmateai.net</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#333333;line-height:1.6;"><span style="color:#666666;">システムカタログ:</span> <a href="https://taskmate-system-catalog.netlify.app" style="color:#3b5bdb;text-decoration:none;">taskmate-system-catalog.netlify.app</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#333333;line-height:1.6;"><span style="color:#666666;">サポート:</span> <a href="https://ikemen.ltd/contact/" style="color:#3b5bdb;text-decoration:none;">ikemen.ltd/contact/</a></td></tr>
</table>
</td></tr>
</table>
</td>
</tr>

<!-- Support -->
<tr>
<td style="padding:0 48px 40px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #e0e0e0;">
<tr><td style="padding-top:24px;text-align:center;">
<p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">ご不明な点がございましたら、お気軽にサポート窓口までお問い合わせください。</p>
<a href="https://ikemen.ltd/contact/" style="display:inline-block;background-color:#3b5bdb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:4px;">サポートに問い合わせる</a>
</td></tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#1a1a2e;border-radius:0 0 8px 8px;">
<tr><td style="padding:32px 48px;text-align:center;">
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#ffffff;line-height:1.5;">TaskMate AI</p>
<p style="margin:0 0 16px;font-size:12px;color:#a0a0b8;line-height:1.5;">Google Apps Script 自動化プラットフォーム</p>
<p style="margin:0 0 8px;font-size:12px;color:#a0a0b8;line-height:1.5;">IKEMEN LTD. All rights reserved.</p>
<p style="margin:0;font-size:11px;color:#6b6b88;line-height:1.5;">このメールは代理店パートナー承認時に自動送信されています。</p>
</td></tr>
</table>
</td>
</tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}

async function sendNotificationEmail(agency, subject, emailHtml) {
    if (!agency.contact_email) {
        console.log('No contact_email for agency:', agency.name);
        return;
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
        const fromAddress = 'TaskMate AI <noreply@taskmateai.net>';
        console.log('Sending "' + subject + '" via Resend to:', agency.contact_email);
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + resendKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [agency.contact_email],
                subject: subject,
                html: emailHtml
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error('Resend API error ' + response.status + ': ' + errorBody);
        }
        console.log('"' + subject + '" sent via Resend to:', agency.contact_email);
        return;
    }

    console.log('No email API key set - skipping email for:', agency.name);
}

function buildSuspensionEmailHtml(agency) {
    return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>代理店アカウント一時停止のお知らせ</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background-color:#1a1a2e;padding:32px 40px;text-align:center;"><div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">TaskMate AI</div><div style="font-size:12px;color:#8b8ba3;letter-spacing:1.5px;text-transform:uppercase;padding-top:6px;">Agency Partner Program</div></td></tr>
<tr><td style="padding:32px 40px 0;text-align:center;"><span style="display:inline-block;background-color:#fff3e0;border:1px solid #ffcc80;border-radius:4px;padding:8px 20px;font-size:13px;font-weight:600;color:#e65100;letter-spacing:0.5px;">ACCOUNT SUSPENDED</span></td></tr>
<tr><td style="padding:28px 40px 0;"><p style="margin:0;font-size:16px;color:#333333;line-height:1.8;">${agency.name} 御中</p></td></tr>
<tr><td style="padding:20px 40px 0;"><p style="margin:0;font-size:15px;color:#333333;line-height:1.8;">平素よりTaskMate AI代理店パートナープログラムをご利用いただき、誠にありがとうございます。</p><p style="margin:16px 0 0;font-size:15px;color:#333333;line-height:1.8;">運営方針に基づく判断により、貴社の代理店アカウントを一時停止とさせていただきましたことをお知らせいたします。</p></td></tr>
<tr><td style="padding:24px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e8e8ed;"></td></tr></table></td></tr>
<tr><td style="padding:0 40px;"><p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1a1a2e;">一時停止中の影響</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fa;border-radius:6px;border-left:3px solid #3b5bdb;"><tr><td style="padding:20px 24px;"><p style="margin:0 0 10px;font-size:14px;color:#333333;line-height:1.6;"><span style="display:inline-block;width:6px;height:6px;background-color:#3b5bdb;border-radius:50%;margin-right:10px;vertical-align:middle;"></span>代理店ポータルへのアクセスが制限されます</p><p style="margin:0 0 10px;font-size:14px;color:#333333;line-height:1.6;"><span style="display:inline-block;width:6px;height:6px;background-color:#3b5bdb;border-radius:50%;margin-right:10px;vertical-align:middle;"></span>発行済みトラッキングリンクが無効となります</p><p style="margin:0;font-size:14px;color:#333333;line-height:1.6;"><span style="display:inline-block;width:6px;height:6px;background-color:#3b5bdb;border-radius:50%;margin-right:10px;vertical-align:middle;"></span>コミッションの計算・発生が停止されます</p></td></tr></table></td></tr>
<tr><td style="padding:24px 40px 0;"><p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1a1a2e;">再開について</p><p style="margin:0;font-size:14px;color:#333333;line-height:1.8;">一時停止は永久的な措置ではございません。条件が整い次第、アカウントの再開を検討いたします。再開の際には、ご登録のメールアドレス（${agency.contact_email}）宛に改めてご連絡いたします。</p></td></tr>
<tr><td style="padding:24px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e8e8ed;"></td></tr></table></td></tr>
<tr><td style="padding:0 40px;"><p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1a2e;">お問い合わせ</p><p style="margin:0 0 16px;font-size:14px;color:#333333;line-height:1.8;">本件に関するご不明点やご質問がございましたら、下記よりお気軽にお問い合わせください。</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><a href="https://ikemen.ltd/contact/" target="_blank" style="display:inline-block;background-color:#3b5bdb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:5px;">お問い合わせフォーム</a></td></tr></table></td></tr>
<tr><td style="padding:28px 40px 0;"><p style="margin:0;font-size:14px;color:#666666;line-height:1.8;">ご不便をおかけいたしますが、何卒ご理解のほどよろしくお願い申し上げます。</p></td></tr>
<tr><td style="padding:32px 0 0;"></td></tr>
<tr><td style="background-color:#1a1a2e;padding:24px 40px;text-align:center;"><p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#ffffff;">TaskMate AI</p><p style="margin:0 0 12px;font-size:11px;color:#8b8ba3;">IKEMEN LTD.</p><p style="margin:0;font-size:11px;color:#5c5c7a;line-height:1.6;">このメールはTaskMate AI代理店パートナープログラムに<br>ご登録いただいている方にお送りしています。</p></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildReactivationEmailHtml(agency) {
    return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>代理店アカウント再開のお知らせ</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background-color:#1a1a2e;padding:32px 40px;text-align:center;"><div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">TaskMate AI</div><div style="font-size:13px;color:#a0a0b8;letter-spacing:1.5px;text-transform:uppercase;padding-top:6px;">Agency Partner Program</div></td></tr>
<tr><td style="background-color:#3b5bdb;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:40px 40px 0;">
<p style="margin:0 0 24px;font-size:16px;color:#333333;line-height:1.8;">${agency.name} 御中</p>
<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e;line-height:1.4;">代理店アカウント再開のお知らせ</h2>
<p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.8;">平素よりTaskMate AIをご利用いただき、誠にありがとうございます。</p>
<p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.8;">一時停止期間中はご不便をおかけいたしましたことを、心よりお詫び申し上げます。このたび、貴社の代理店パートナーアカウントが正式に<span style="font-weight:700;color:#3b5bdb;">再開（再有効化）</span>されましたことをお知らせいたします。</p>
<p style="margin:0 0 32px;font-size:15px;color:#333333;line-height:1.8;">貴社との協業を再開できますことを、チーム一同大変嬉しく思っております。</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8f9fc;border-radius:6px;border-left:4px solid #3b5bdb;">
<tr><td style="padding:24px 28px;">
<p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1a1a2e;">再開後にご利用いただける機能</p>
<p style="margin:0 0 10px;font-size:14px;color:#333333;line-height:1.7;"><span style="color:#3b5bdb;font-weight:700;">1.</span> <span style="font-weight:600;color:#1a1a2e;">代理店ポータルへのアクセス復活</span><br><span style="font-size:13px;color:#666666;">ダッシュボード、訪問分析、LINEユーザー管理など全機能をご利用いただけます。</span></p>
<p style="margin:0 0 10px;font-size:14px;color:#333333;line-height:1.7;"><span style="color:#3b5bdb;font-weight:700;">2.</span> <span style="font-weight:600;color:#1a1a2e;">トラッキングリンクの再有効化</span><br><span style="font-size:13px;color:#666666;">停止期間中に無効化されていたリンクが再び有効になりました。新規リンクの作成も可能です。</span></p>
<p style="margin:0;font-size:14px;color:#333333;line-height:1.7;"><span style="color:#3b5bdb;font-weight:700;">3.</span> <span style="font-weight:600;color:#1a1a2e;">コミッション計算の再開</span><br><span style="font-size:13px;color:#666666;">本日以降の成約分よりコミッションの計算・積算が再開されます。</span></p>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:32px 40px;text-align:center;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#3b5bdb;border-radius:6px;"><a href="https://taskmateai.net/agency/" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">代理店ポータルにログイン</a></td></tr></table><p style="margin:12px 0 0;font-size:12px;color:#999999;">${agency.contact_email} でログインしてください</p></td></tr>
<tr><td style="padding:0 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid #e8e8ed;"></td></tr></table></td></tr>
<tr><td style="padding:24px 40px 32px;"><p style="margin:0 0 12px;font-size:14px;color:#333333;line-height:1.8;">ご不明な点やお困りのことがございましたら、お気軽にお問い合わせください。</p><a href="https://ikemen.ltd/contact/" target="_blank" style="font-size:14px;color:#3b5bdb;font-weight:600;text-decoration:none;">お問い合わせフォーム &rarr;</a></td></tr>
<tr><td style="background-color:#1a1a2e;padding:28px 40px;text-align:center;"><p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#ffffff;">TaskMate AI</p><p style="margin:0 0 12px;font-size:12px;color:#a0a0b8;">IKEMEN LTD.</p><p style="margin:0;font-size:11px;color:#666680;line-height:1.6;">このメールはTaskMate AI代理店パートナープログラムに<br>ご登録いただいている方にお送りしています。</p></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}