const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { calculateCommissions } = require('./utils/referral-commission');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
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

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
        // Verify webhook signature
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            webhookSecret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
        };
    }

    try {
        // ────────────────────────────────────────────────────────────────
        // 冪等性チェック（二重処理防止）
        //
        // このハンドラー（Netlify）は代理店コミッション計算を担当する。
        // Render側ハンドラーはユーザーサブスク更新・LINE通知を担当する。
        // 両者が同じStripeイベントを受信するため、ハンドラー名をサフィックス
        // として付加した複合キー "evt_xxx:netlify" で独立して重複制御する。
        // これにより、どちらか一方が先に処理してももう一方がスキップされない。
        //
        // 競合状態対策:
        //   SELECT → INSERT の間に別プロセスが INSERT する可能性があるため、
        //   INSERT の結果（error）を確認し、UNIQUE 違反ならスキップとする。
        // ────────────────────────────────────────────────────────────────
        const handlerEventId = `${stripeEvent.id}:netlify`;

        // 処理前にイベント記録を試みる（ON CONFLICT DO NOTHING 相当）
        const { error: insertError } = await supabase
            .from('stripe_events')
            .insert({
                event_id: handlerEventId,
                event_type: stripeEvent.type,
                processed_at: new Date().toISOString()
            });

        if (insertError) {
            // UNIQUE 制約違反 (23505) = 既に処理済み or 同時リクエストが先行
            if (insertError.code === '23505') {
                console.log(`Duplicate Stripe event ${stripeEvent.id} (netlify handler), skipping`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ received: true, duplicate: true })
                };
            }
            // その他のDBエラーはログに残して続行しない
            console.error(`Failed to record stripe event ${stripeEvent.id}:`, insertError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to record event for idempotency' })
            };
        }

        // Handle different event types
        switch (stripeEvent.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSuccess(stripeEvent.data.object);
                break;

            case 'checkout.session.completed':
                await handleCheckoutComplete(stripeEvent.data.object);
                break;

            case 'customer.created':
                await handleCustomerCreated(stripeEvent.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handleInvoicePayment(stripeEvent.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('Webhook processing error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Webhook processing failed' })
        };
    }
};

async function handlePaymentSuccess(paymentIntent) {
    console.log('Processing successful payment:', paymentIntent.id);

    // payment_intent_idベースの重複チェック（checkout.session.completedとpayment_intent.succeededの二重発火防止）
    const { data: existingConversion } = await supabase
        .from('agency_conversions')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle();

    if (existingConversion) {
        console.log(`Payment ${paymentIntent.id} already recorded as conversion ${existingConversion.id}, skipping`);
        return;
    }

    // Extract metadata for tracking attribution
    const metadata = paymentIntent.metadata || {};
    const {
        line_user_id,
        tracking_code,
        session_id,
        agency_id,
        user_id
    } = metadata;

    try {
        // Find the tracking link and agency
        let agencyData = null;
        let trackingLink = null;
        let resolvedLineUserId = line_user_id || null;

        if (tracking_code) {
            const { data: link } = await supabase
                .from('agency_tracking_links')
                .select(`
                    *,
                    agencies (*)
                `)
                .eq('tracking_code', tracking_code)
                .maybeSingle();

            if (link) {
                trackingLink = link;
                agencyData = link.agencies;
            }
        } else if (agency_id) {
            const { data: agency } = await supabase
                .from('agencies')
                .select('*')
                .eq('id', agency_id)
                .maybeSingle();

            agencyData = agency;
        }

        // フォールバック: metadataにagency情報がない場合、LINE user IDから逆引き
        // Stripe Payment Linkはclient_reference_idにLINE user IDを含む
        if (!agencyData && resolvedLineUserId) {
            console.log('Fallback: Looking up agency from LINE user ID:', resolvedLineUserId);

            const { data: visitData } = await supabase
                .from('agency_tracking_visits')
                .select(`
                    id,
                    session_id,
                    tracking_link_id,
                    agency_id,
                    agency_tracking_links (
                        *,
                        agencies (*)
                    )
                `)
                .eq('line_user_id', resolvedLineUserId)
                .not('agency_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (visitData && visitData.agency_tracking_links) {
                trackingLink = visitData.agency_tracking_links;
                agencyData = visitData.agency_tracking_links.agencies;
                console.log('Fallback success: Found agency', agencyData?.name, 'from visit history');
            }
        }

        if (!agencyData) {
            console.log('No agency attribution found for payment');
            return;
        }

        // Find the visit record if session_id exists
        let visitId = null;
        if (session_id) {
            const { data: visit } = await supabase
                .from('agency_tracking_visits')
                .select('id')
                .eq('session_id', session_id)
                .maybeSingle();

            if (visit) {
                visitId = visit.id;
            }
        }

        // Record the conversion
        const { data: conversion, error: conversionError } = await supabase
            .from('agency_conversions')
            .insert({
                tracking_link_id: trackingLink?.id,
                agency_id: agencyData.id,
                visit_id: visitId,
                user_id: user_id || null,
                conversion_type: 'stripe_payment',
                conversion_value: getAmountInCurrency(paymentIntent.amount, paymentIntent.currency), // Convert from cents to currency
                line_user_id: line_user_id || null,
                stripe_payment_intent_id: paymentIntent.id,
                metadata: {
                    stripe_payment_intent_id: paymentIntent.id,
                    stripe_customer_id: paymentIntent.customer,
                    currency: paymentIntent.currency,
                    payment_method: paymentIntent.payment_method_types[0],
                    description: paymentIntent.description,
                    timestamp: new Date().toISOString()
                }
            })
            .select()
            .single();

        if (conversionError) {
            console.error('Error recording conversion:', conversionError);
            return;
        }

        // Update tracking link conversion count if applicable
        if (trackingLink) {
            await supabase
                .from('agency_tracking_links')
                .update({
                    conversion_count: trackingLink.conversion_count + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', trackingLink.id);
        }

        // Calculate and update commission (own_commission_rateを優先、旧commission_rateはフォールバック)
        const effectiveRate = agencyData.own_commission_rate || agencyData.commission_rate || 20;
        const commissionAmount = (getAmountInCurrency(paymentIntent.amount, paymentIntent.currency)) * (effectiveRate / 100);

        // Get or create current month's commission record
        const currentDate = new Date();
        const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const { data: existingCommission } = await supabase
            .from('agency_commissions')
            .select('*')
            .eq('agency_id', agencyData.id)
            .gte('period_start', periodStart.toISOString())
            .lte('period_end', periodEnd.toISOString())
            .single();

        if (existingCommission) {
            // Update existing commission record
            await supabase
                .from('agency_commissions')
                .update({
                    total_conversions: existingCommission.total_conversions + 1,
                    total_sales: existingCommission.total_sales + (getAmountInCurrency(paymentIntent.amount, paymentIntent.currency)),
                    commission_amount: existingCommission.commission_amount + commissionAmount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingCommission.id);
        } else {
            // Create new commission record
            await supabase
                .from('agency_commissions')
                .insert({
                    agency_id: agencyData.id,
                    period_start: periodStart.toISOString(),
                    period_end: periodEnd.toISOString(),
                    total_conversions: 1,
                    total_sales: getAmountInCurrency(paymentIntent.amount, paymentIntent.currency),
                    commission_rate: effectiveRate,
                    commission_amount: commissionAmount,
                    status: 'pending'
                });
        }

        console.log(`Conversion recorded for agency ${agencyData.name}: ¥${getAmountInCurrency(paymentIntent.amount, paymentIntent.currency)}`);

        // 親代理店リファラルコミッション計算（2%固定）
        if (conversion && conversion.id) {
            try {
                const result = await calculateCommissions(
                    supabase,
                    getAmountInCurrency(paymentIntent.amount, paymentIntent.currency), // 円単位
                    agencyData.id,
                    conversion.id
                );
                console.log(`Referral commissions calculated: ${result.distributions.length} distributions, total: ¥${result.totalCommission}`);
            } catch (commErr) {
                // リファラルコミッション計算失敗は致命的でない（直接コミッションは既に記録済み）
                console.error('Referral commission calculation failed (non-fatal):', commErr.message);
            }
        }

    } catch (error) {
        console.error('Error processing payment conversion:', error);
    }
}

async function handleCheckoutComplete(session) {
    console.log('Processing checkout completion:', session.id);

    const metadata = session.metadata || {};
    // client_reference_idにはBase64エンコードされたLINE user IDが入る
    const clientRefId = session.client_reference_id;
    let lineUserId = null;

    if (clientRefId) {
        try {
            // Base64デコードを試行（エンコードされている場合）
            const decoded = Buffer.from(clientRefId, 'base64').toString('utf-8');
            lineUserId = decoded.startsWith('U') && decoded.length > 20 ? decoded : clientRefId;
        } catch {
            lineUserId = clientRefId;
        }
    }

    // metadata にagency情報がある場合、またはclient_reference_idからLINE user IDが取れる場合に処理
    const hasAgencyMeta = metadata.tracking_code || metadata.agency_id;

    if (hasAgencyMeta || lineUserId) {
        try {
            const paymentIntent = session.payment_intent
                ? await stripe.paymentIntents.retrieve(session.payment_intent)
                : { id: session.id, amount: session.amount_total, currency: session.currency, customer: session.customer, payment_method_types: ['card'], description: 'Checkout session' };

            await handlePaymentSuccess({
                ...paymentIntent,
                metadata: {
                    ...paymentIntent.metadata,
                    ...metadata,
                    line_user_id: metadata.line_user_id || lineUserId
                }
            });
        } catch (err) {
            console.error('Error processing checkout completion:', err);
        }
    }
}

async function handleCustomerCreated(customer) {
    console.log('New customer created:', customer.id);

    // Store customer information if there's LINE user attribution
    const metadata = customer.metadata || {};

    if (metadata.line_user_id && metadata.agency_id) {
        // Update user record with Stripe customer ID
        await supabase
            .from('users')
            .update({
                stripe_customer_id: customer.id,
                metadata: {
                    stripe_customer_created: new Date().toISOString(),
                    agency_id: metadata.agency_id
                }
            })
            .eq('line_user_id', metadata.line_user_id);
    }
}

async function handleInvoicePayment(invoice) {
    console.log('Invoice payment succeeded:', invoice.id);

    // Handle subscription or recurring payments
    if (invoice.subscription && invoice.metadata) {
        const metadata = invoice.metadata;

        if (metadata.tracking_code || metadata.agency_id) {
            await handlePaymentSuccess({
                id: invoice.payment_intent,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                customer: invoice.customer,
                payment_method_types: ['card'],
                description: `Invoice ${invoice.number}`,
                metadata
            });
        }
    }
}

// JPY等のゼロデシマル通貨はそのまま、USD等は100で割る
function getAmountInCurrency(amount, currency) {
    const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'bif', 'clp', 'djf', 'gnf', 'kmf', 'mga', 'pyg', 'rwf', 'ugx', 'xaf', 'xof', 'xpf'];
    if (zeroDecimalCurrencies.includes((currency || 'jpy').toLowerCase())) {
        return amount;
    }
    return amount / 100;
}