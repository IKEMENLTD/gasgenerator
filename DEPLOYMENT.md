# TaskMate - Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Required Services Setup
- [ ] **Supabase Project**: Create new project and get credentials
- [ ] **LINE Developers**: Register bot and get channel tokens  
- [ ] **Anthropic Account**: Get Claude API key
- [ ] **Vercel Account**: Ready for deployment

### 2. Database Setup
```bash
# Connect to Supabase and run:
psql -h <your-host> -U postgres -d <your-db>
\i scripts/setup-database.sql
```

### 3. Environment Variables
Copy and configure:
```bash
cp .env.example .env.local
```

Required variables:
- `LINE_CHANNEL_ACCESS_TOKEN` - From LINE Developers Console
- `LINE_CHANNEL_SECRET` - From LINE Developers Console  
- `ANTHROPIC_API_KEY` - From Anthropic Console
- `SUPABASE_URL` - From Supabase Project Settings
- `SUPABASE_ANON_KEY` - From Supabase Project API Settings
- `SUPABASE_SERVICE_ROLE_KEY` - From Supabase Project API Settings
- `CRON_SECRET` - Generate random secure string

## 🚀 Deployment Steps

### Option 1: Automated Setup
```bash
# Run pre-deployment checks
./scripts/deploy/pre-deploy.sh

# Setup Vercel environment
./scripts/deploy/setup-env.sh

# Deploy
vercel --prod
```

### Option 2: Manual Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Initialize project
vercel

# Add environment variables
vercel env add LINE_CHANNEL_ACCESS_TOKEN
vercel env add LINE_CHANNEL_SECRET
vercel env add ANTHROPIC_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add CRON_SECRET

# Deploy
vercel --prod
```

## 🔧 Post-Deployment Configuration

### 1. LINE Bot Webhook Setup
1. Go to LINE Developers Console
2. Navigate to your bot's Messaging API settings
3. Set Webhook URL: `https://your-app.vercel.app/api/webhook`
4. Verify webhook endpoint
5. Enable "Use webhook" toggle

### 2. Test Basic Functionality
```bash
# Test webhook endpoint
curl -X POST https://your-app.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check cron endpoints (with CRON_SECRET)
curl -X GET https://your-app.vercel.app/api/cron/process-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. Monitor Initial Deployment
- Check Vercel function logs
- Monitor Supabase database connections
- Test LINE bot responses
- Verify Claude API calls

## 📊 System Architecture Overview

```
┌─────────────────┐
│  LINE Platform  │
└─────────┬───────┘
          │ Webhook
          ▼
┌─────────────────┐    ┌──────────────────┐
│ Vercel Function │───▶│   Supabase DB    │
│   (Webhook)     │    │                  │
└─────────┬───────┘    └──────────────────┘
          │                      ▲
          ▼ Queue Job             │
┌─────────────────┐              │
│ Vercel Cron Job │              │
│ (Queue Processor)│──────────────┘
└─────────┬───────┘
          │ API Call
          ▼
┌─────────────────┐
│   Claude AI     │
└─────────────────┘
```

## 🔍 Troubleshooting

### Common Issues

#### Webhook Signature Validation Failed
- Check LINE_CHANNEL_SECRET is correctly set
- Verify request headers include x-line-signature

#### Database Connection Error  
- Confirm Supabase credentials
- Check if database tables exist
- Verify RLS policies are properly configured

#### Claude API Rate Limits
- Monitor usage in dashboard
- Check ANTHROPIC_API_KEY validity
- Review usage tracking logs

#### Cron Jobs Not Running
- Verify CRON_SECRET is set
- Check Vercel deployment includes cron configuration
- Monitor function timeout limits

### Health Check Endpoints
- `GET /api/health` - General system health
- `GET /api/cron/process-queue` - Queue processor status  
- `GET /api/cron/cleanup` - Cleanup job status

## 📈 Monitoring & Maintenance

### Key Metrics to Monitor
- Webhook response times
- Queue processing latency  
- Claude API usage and costs
- Database query performance
- Error rates and failure reasons

### Regular Maintenance Tasks
- Monitor Supabase database size
- Review Claude API usage costs
- Check cron job execution logs
- Update dependencies regularly

## 🔐 Security Considerations

- Rotate CRON_SECRET periodically
- Monitor webhook endpoint for suspicious activity
- Review Supabase RLS policies
- Keep dependencies updated
- Monitor API key usage

## 📞 Support

For deployment issues:
1. Check Vercel function logs
2. Review Supabase dashboard  
3. Monitor LINE Developers Console
4. Check Claude API dashboard

System is ready for production deployment! 🎉