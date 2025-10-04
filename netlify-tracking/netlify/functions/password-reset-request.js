const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SendGridを使う場合（オプション）
// const sgMail = require('@sendgrid/mail');
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

    try {
        const { email } = JSON.parse(event.body);

        if (!email) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'メールアドレスを入力してください'
                })
            };
        }

        // ユーザーの確認
        const { data: user, error: userError } = await supabase
            .from('agency_users')
            .select('id, name, email, agency_id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            // セキュリティのため、ユーザーが存在しない場合も成功を返す
            console.log('User not found:', email);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'パスワードリセットメールを送信しました（該当するアカウントが存在する場合）'
                })
            };
        }

        // トークン生成
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1時間有効

        // 既存の未使用トークンを無効化
        await supabase
            .from('password_reset_tokens')
            .update({ used: true })
            .eq('agency_user_id', user.id)
            .eq('used', false);

        // 新しいトークンを保存
        const { error: tokenError } = await supabase
            .from('password_reset_tokens')
            .insert({
                agency_user_id: user.id,
                token: hashedToken,
                expires_at: expiresAt.toISOString()
            });

        if (tokenError) {
            console.error('Token creation error:', tokenError);
            throw tokenError;
        }

        // リセットURL
        const resetUrl = `${process.env.APP_URL || 'https://taskmateai.net'}/agency/reset-password.html?token=${resetToken}`;

        // メール送信オプション1: SendGrid（要設定）
        if (process.env.SENDGRID_API_KEY) {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);

            const msg = {
                to: email,
                from: process.env.EMAIL_FROM || 'noreply@taskmateai.net',
                subject: 'パスワードリセットのご案内 - TaskMate AI',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #10b981;">パスワードリセット</h2>
                        <p>${user.name} 様</p>
                        <p>パスワードリセットのリクエストを受け付けました。</p>
                        <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
                        <p style="margin: 30px 0;">
                            <a href="${resetUrl}"
                               style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                パスワードをリセット
                            </a>
                        </p>
                        <p>または、以下のURLをブラウザにコピーしてください：</p>
                        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                        <p style="color: #666; font-size: 14px; margin-top: 30px;">
                            ※このリンクは1時間有効です。<br>
                            ※心当たりがない場合は、このメールを無視してください。
                        </p>
                    </div>
                `,
                text: `
                    パスワードリセット

                    ${user.name} 様

                    パスワードリセットのリクエストを受け付けました。
                    以下のURLにアクセスして、新しいパスワードを設定してください：

                    ${resetUrl}

                    このリンクは1時間有効です。
                    心当たりがない場合は、このメールを無視してください。
                `
            };

            await sgMail.send(msg);
            console.log('Password reset email sent to:', email);

        } else {
            // メール送信オプション2: コンソールに表示（開発用）
            console.log('=== PASSWORD RESET LINK ===');
            console.log('Email:', email);
            console.log('Reset URL:', resetUrl);
            console.log('Token:', resetToken);
            console.log('Expires at:', expiresAt);
            console.log('===========================');

            // 本番環境ではSendGridまたは他のメールサービスを設定してください

            // データベースにリセットURLを保存（一時的な解決策）
            await supabase
                .from('password_reset_tokens')
                .update({
                    reset_url: resetUrl,
                    plain_token: resetToken // 開発用：平文トークンも保存
                })
                .eq('token', hashedToken);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'パスワードリセットの案内を送信しました',
                // メール送信が設定されていない場合はトークンを返す
                ...(!process.env.SENDGRID_API_KEY ? {
                    token: resetToken,
                    resetUrl
                } : {})
            })
        };

    } catch (error) {
        console.error('Password reset error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'パスワードリセット処理中にエラーが発生しました'
            })
        };
    }
};