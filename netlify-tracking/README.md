# TaskMate AI - Comprehensive Tracking Management System

A production-ready tracking and analytics system built for Netlify with LINE integration, Supabase backend, and comprehensive admin dashboard.

## Features

### 🔗 Tracking System
- Generate unique tracking links with UTM parameters
- Capture referrer source, IP, user agent, and timestamp data
- Automatic redirect to LINE friend URLs
- Real-time visit analytics

### 👥 LINE Integration
- Automatic user profile collection when users add LINE friend
- Link tracking data with LINE user IDs
- Welcome message automation
- Conversion funnel analysis

### 📊 Admin Dashboard
- Secure login authentication
- Tracking link generation and management
- Real-time statistics and analytics
- User information display
- Visit tracking and conversion metrics

### 🗄️ Database Management
- Supabase integration with optimized schema
- Row Level Security (RLS) policies
- Analytics views and functions
- Automated triggers and indexing

## Quick Setup

### 1. Prerequisites
- Netlify account
- Supabase account
- LINE Developers account
- Node.js 18+ (for local development)

### 2. Database Setup
1. Create a new Supabase project
2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL Editor
3. Note your Supabase URL and anon key

### 3. LINE Bot Setup
1. Create a LINE Channel in the LINE Developers Console
2. Get your Channel Secret and Channel Access Token
3. Set up webhook URL: `https://your-domain.netlify.app/.netlify/functions/line-webhook`

### 4. Environment Variables
Copy `.env.example` to your Netlify environment variables:

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
LINE_CHANNEL_SECRET=your-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-access-token

# Admin Access
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Site Configuration
DEFAULT_LINE_FRIEND_URL=https://line.me/R/ti/p/@your-line-id
```

### 5. Deploy to Netlify
1. Connect this repository to your Netlify account
2. Set the build command: `npm install` (optional)
3. Set the publish directory: `.`
4. Add all environment variables
5. Deploy!

## Usage

### Admin Dashboard
Access your admin dashboard at: `https://your-domain.netlify.app/admin`

**Default Login:**
- Username: admin
- Password: (set in environment variables)

### Creating Tracking Links
1. Log in to the admin dashboard
2. Go to "Create Link" tab
3. Fill in:
   - Campaign name
   - UTM parameters (optional)
   - LINE friend URL
4. Copy the generated tracking link: `https://your-domain.netlify.app/t/[tracking_code]`

### Tracking Flow
1. User clicks tracking link
2. Visit data is captured and stored
3. User is redirected to LINE friend URL
4. When user adds LINE friend, profile is linked to visit
5. Conversion is tracked and displayed in analytics

## File Structure

```
netlify-tracking/
├── admin/
│   ├── index.html              # Admin dashboard interface
│   └── dashboard.js            # Dashboard logic and API calls
├── t/
│   └── index.html              # Tracking redirect page
├── netlify/
│   └── functions/
│       ├── create-tracking-link.js    # Create new tracking links
│       ├── get-tracking-stats.js      # Fetch analytics data
│       ├── track-visit.js             # Record visit data
│       └── line-webhook.js            # LINE bot webhook handler
├── netlify.toml                # Netlify configuration
├── package.json                # Dependencies
├── supabase-schema.sql         # Database schema
├── .env.example                # Environment variables template
└── README.md                   # This file
```

## API Endpoints

### Netlify Functions
- `/.netlify/functions/create-tracking-link` - Create new tracking links
- `/.netlify/functions/get-tracking-stats` - Get analytics data
- `/.netlify/functions/track-visit` - Record visit data
- `/.netlify/functions/line-webhook` - LINE webhook handler

### Admin Dashboard Routes
- `/admin` - Admin login and dashboard
- `/t/[tracking_code]` - Tracking redirect

## Database Schema

### Tables
- `tracking_links` - Tracking link configurations
- `tracking_visits` - Visit records with analytics data
- `line_users` - LINE user profiles and status

### Views
- `tracking_stats` - Conversion analytics per link
- `recent_activity` - Combined activity feed

## Security Features

- Row Level Security (RLS) on all tables
- CORS headers properly configured
- Admin authentication required
- LINE webhook signature verification
- IP-based duplicate visit prevention
- Rate limiting ready (configurable)

## Customization

### Admin Credentials
Update credentials in your Netlify environment variables:
```bash
ADMIN_USERNAME=your-username
ADMIN_PASSWORD=your-secure-password
```

### Styling
The admin dashboard uses Tailwind CSS via CDN. Customize styles by editing the HTML classes in `admin/index.html`.

### LINE Bot Messages
Customize welcome and auto-response messages in `netlify/functions/line-webhook.js`.

### Analytics
Add additional tracking parameters by modifying the tracking functions and database schema.

## Monitoring and Analytics

### Built-in Analytics
- Total tracking links
- Total visits
- LINE user conversions
- Conversion rates
- UTM parameter tracking
- Referrer analysis

### Dashboard Views
- Real-time statistics
- Link performance
- Visit analytics
- User profiles
- Conversion funnel

## Troubleshooting

### Common Issues

1. **Tracking links not working**
   - Check if tracking code exists in database
   - Verify netlify.toml redirect rules
   - Check function logs

2. **LINE webhook not receiving events**
   - Verify webhook URL is correct
   - Check LINE channel secret and token
   - Verify SSL certificate

3. **Admin dashboard login failing**
   - Check environment variables are set
   - Verify admin credentials
   - Clear browser cache

4. **Database connection issues**
   - Verify Supabase URL and keys
   - Check RLS policies
   - Ensure schema is properly created

### Logging
Check Netlify function logs for detailed error information:
1. Go to Netlify dashboard
2. Select your site
3. Go to Functions tab
4. Check individual function logs

## Performance Optimization

### Database
- Indexes on frequently queried columns
- Efficient RLS policies
- Analytics views for complex queries

### Frontend
- CDN for assets
- Minimal JavaScript loading
- Optimized redirect flow

### Functions
- Connection pooling ready
- Error handling with graceful degradation
- Efficient data queries

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Netlify function logs
3. Check Supabase dashboard for database issues
4. Verify LINE webhook configuration

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**TaskMate AI** - Efficient tracking and user management system
🚀 Built with Netlify, Supabase, and LINE Messaging API