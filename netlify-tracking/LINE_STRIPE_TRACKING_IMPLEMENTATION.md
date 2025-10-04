# LINE Friend URL & Stripe Payment Tracking System

## Overview

This enhanced tracking system enables agencies to track clicks from LINE friend URLs, monitor Stripe payments made within LINE, and attribute these payments back to the agency that generated the tracking link for commission calculation.

## System Architecture

### 1. Data Flow

```
Agency creates tracking link → User clicks link → Session tracked → User adds LINE friend → User makes Stripe payment → Commission calculated
```

### 2. Core Components

#### A. Database Schema (Stripe Integration)
- **stripe_payments**: Records all Stripe payment events
- **user_sessions**: Enhanced session tracking with LINE and Stripe attribution
- **conversion_funnels**: Tracks user journey through conversion steps
- **agency_conversions**: Links conversions to agencies with commission data

#### B. API Functions
- **track-redirect.js**: Handles tracking link redirects to LINE friend URL
- **stripe-webhook.js**: Processes Stripe payment webhooks
- **track-session.js**: Manages user session tracking
- **line-webhook.js**: Enhanced LINE webhook with payment attribution
- **agency-commission.js**: Commission calculation and reporting

## Implementation Guide

### Step 1: Database Setup

Execute the Stripe integration schema:

```sql
-- Apply the schema from database/stripe-integration-schema.sql
-- This adds Stripe payment tracking, user sessions, and conversion funnels
```

### Step 2: Environment Variables

Add these environment variables to your Netlify deployment:

```bash
# Existing variables
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
JWT_SECRET=your_jwt_secret

# New Stripe variables
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Step 3: URL Routing Configuration

Update your `_redirects` file to handle tracking links:

```
# Tracking redirects
/t/:code   /.netlify/functions/track-redirect   200
/track/:code   /.netlify/functions/track-redirect   200

# API endpoints
/api/stripe/webhook   /.netlify/functions/stripe-webhook   200
/api/track/session   /.netlify/functions/track-session   200
/api/agency/commission   /.netlify/functions/agency-commission   200
```

### Step 4: Stripe Webhook Configuration

1. In your Stripe Dashboard, create a webhook endpoint:
   - URL: `https://your-domain.netlify.app/api/stripe/webhook`
   - Events to send:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `customer.created`

2. Copy the webhook signing secret to your environment variables.

## Usage Instructions

### For Agencies

#### 1. Create Tracking Links

Use the existing agency dashboard or API to create tracking links:

```javascript
POST /api/agency/create-link
{
  "name": "Campaign Name",
  "line_friend_url": "https://lin.ee/4NLfSqH",
  "utm_source": "facebook",
  "utm_medium": "social",
  "utm_campaign": "summer2024"
}
```

Response:
```javascript
{
  "success": true,
  "id": "uuid",
  "tracking_code": "ABC123XY",
  "tracking_url": "https://your-domain.netlify.app/t/ABC123XY"
}
```

#### 2. Share Tracking Links

Agencies share the tracking URL (`https://your-domain.netlify.app/t/ABC123XY`) instead of the direct LINE friend URL.

#### 3. Monitor Conversions

Access commission data via API:

```javascript
GET /api/agency/commission?period=current_month
Authorization: Bearer JWT_TOKEN
X-Agency-Id: agency_uuid
```

### For Your Stripe Integration

#### 1. Include Tracking Metadata

When creating Stripe payment intents for LINE users, include tracking metadata:

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'jpy',
  customer: customerId,
  metadata: {
    line_user_id: 'U1234567890abcdef',
    session_id: 'session_id_from_cookie',
    tracking_code: 'ABC123XY' // if available
  }
});
```

#### 2. Link LINE Users to Stripe Customers

When a LINE user initiates a payment, link their LINE ID to the Stripe customer:

```javascript
const customer = await stripe.customers.create({
  email: 'user@example.com',
  metadata: {
    line_user_id: 'U1234567890abcdef',
    session_id: 'session_id_from_cookie'
  }
});
```

## Tracking Flow Details

### 1. Initial Visit
1. User clicks agency tracking link: `https://your-domain.netlify.app/t/ABC123XY`
2. System records visit in `agency_tracking_visits`
3. Creates session in `user_sessions`
4. Records funnel step: 'visit'
5. Redirects to LINE friend URL with tracking parameters

### 2. LINE Friend Addition
1. User adds LINE friend via the redirected URL
2. LINE webhook receives follow event
3. System links LINE user to session via `linkUserToTracking()`
4. Records funnel step: 'line_friend'
5. Creates agency conversion record for LINE friend

### 3. Stripe Payment
1. User makes payment through your LINE integration
2. Stripe webhook receives payment event
3. System finds agency attribution via session/LINE user ID
4. Records payment in `stripe_payments`
5. Records funnel step: 'payment'
6. Creates agency conversion record with commission calculation

## Commission Calculation

### Base Commission Structure
- Commission rates are set per agency in the `agencies` table
- Payments are tracked in cents for precision
- Commission = (Payment Amount × Agency Commission Rate) / 100

### Example Calculation
```
Payment: ¥2,000 (200,000 cents)
Agency Commission Rate: 15%
Commission Amount: ¥300 (30,000 cents)
```

### Commission Status Flow
1. **pending**: Initial state when payment is recorded
2. **approved**: Admin approves commission for payment
3. **paid**: Commission has been paid to agency

## Analytics & Reporting

### Conversion Funnel Analysis
Track user journey through these steps:
- **visit**: User clicks tracking link
- **line_friend**: User adds LINE friend
- **payment**: User completes Stripe payment

### Key Metrics
- Visit-to-LINE conversion rate
- LINE-to-payment conversion rate
- Overall conversion rate
- Average payment value
- Commission totals by period

### API Endpoints for Analytics

```javascript
// Get agency performance overview
GET /api/agency/commission?period=current_month

// Get detailed conversion funnel
GET /api/agency/stats?include=funnel

// Get payment history
GET /api/agency/commission?period=custom&start_date=2024-01-01&end_date=2024-01-31
```

## Testing the Implementation

### 1. Test Tracking Link Creation
```bash
curl -X POST https://your-domain.netlify.app/api/agency/create-link \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "X-Agency-Id: YOUR_AGENCY_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "line_friend_url": "https://lin.ee/4NLfSqH"
  }'
```

### 2. Test Tracking Redirect
Visit the generated tracking URL in a browser and verify:
- Redirect to LINE friend URL works
- Session is created in database
- Visit is recorded

### 3. Test Stripe Webhook
Use Stripe CLI to forward webhook events:
```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

### 4. Test LINE Webhook
Send a test follow event to your LINE webhook endpoint.

## Security Considerations

### 1. Webhook Verification
- Stripe webhook signatures are verified
- LINE webhook signatures are verified
- JWT tokens are validated for agency access

### 2. Data Protection
- Row Level Security (RLS) enforced on all agency tables
- Agencies can only access their own data
- Sensitive data is stored in JSONB metadata fields

### 3. Rate Limiting
Consider implementing rate limiting on:
- Tracking link creation
- Webhook endpoints
- Commission calculation requests

## Performance Optimization

### 1. Database Indexes
All critical queries are indexed:
- Session lookups by session_id and line_user_id
- Payment lookups by stripe_payment_intent_id
- Agency data filtering

### 2. Caching Strategy
Consider implementing caching for:
- Agency commission rates
- Frequently accessed conversion data
- Analytics aggregations

### 3. Background Processing
For high-volume scenarios, consider moving these to background jobs:
- Commission calculations
- Analytics aggregations
- Notification sending

## Troubleshooting

### Common Issues

1. **Payments not attributed to agencies**
   - Check session tracking is working
   - Verify Stripe metadata includes correct identifiers
   - Ensure LINE user linking is functioning

2. **LINE webhook not working**
   - Verify webhook URL is accessible
   - Check LINE channel secret is correct
   - Review webhook signature verification

3. **Commission calculations incorrect**
   - Verify agency commission rates are set
   - Check payment amounts are in correct currency
   - Review date range calculations

### Debug Tools

```javascript
// Check session data
GET /api/track/session?session_id=SESSION_ID

// Verify payment attribution
SELECT * FROM stripe_payments WHERE stripe_payment_intent_id = 'pi_xxx';

// Check conversion funnel
SELECT * FROM conversion_funnels WHERE session_id = 'SESSION_UUID';
```

## Future Enhancements

### 1. Real-time Notifications
- Email notifications for new conversions
- Slack/Discord webhook integration
- Push notifications for mobile apps

### 2. Advanced Analytics
- A/B testing for tracking links
- Cohort analysis
- Predictive conversion modeling

### 3. Multi-currency Support
- Handle payments in different currencies
- Currency conversion for commission calculations
- Localized reporting

### 4. Enhanced Attribution
- Multi-touch attribution models
- Cross-device tracking
- Offline conversion tracking

This implementation provides a comprehensive foundation for tracking LINE friend additions and Stripe payments with proper agency attribution and commission calculation.