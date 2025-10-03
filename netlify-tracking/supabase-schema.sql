-- TaskMate AI Tracking System Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tracking_links table
CREATE TABLE tracking_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tracking_code VARCHAR(50) UNIQUE NOT NULL,
    line_friend_url TEXT NOT NULL,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create tracking_visits table
CREATE TABLE tracking_visits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tracking_link_id UUID NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
    line_user_id UUID REFERENCES line_users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    screen_resolution VARCHAR(50),
    language VARCHAR(10),
    timezone VARCHAR(50),
    session_id VARCHAR(255),
    visited_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create line_users table
CREATE TABLE line_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    line_user_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    picture_url TEXT,
    status_message TEXT,
    language VARCHAR(10),
    is_friend BOOLEAN DEFAULT true,
    last_activity TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_tracking_links_code ON tracking_links(tracking_code);
CREATE INDEX idx_tracking_links_active ON tracking_links(is_active);
CREATE INDEX idx_tracking_visits_link_id ON tracking_visits(tracking_link_id);
CREATE INDEX idx_tracking_visits_user_id ON tracking_visits(line_user_id);
CREATE INDEX idx_tracking_visits_ip ON tracking_visits(ip_address);
CREATE INDEX idx_tracking_visits_date ON tracking_visits(visited_at);
CREATE INDEX idx_line_users_line_id ON line_users(line_user_id);
CREATE INDEX idx_line_users_friend ON line_users(is_friend);
CREATE INDEX idx_line_users_activity ON line_users(last_activity);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_tracking_links_updated_at
    BEFORE UPDATE ON tracking_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_users_updated_at
    BEFORE UPDATE ON line_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for analytics
CREATE VIEW tracking_stats AS
SELECT
    tl.id as link_id,
    tl.name,
    tl.tracking_code,
    tl.utm_source,
    tl.utm_medium,
    tl.utm_campaign,
    COUNT(tv.id) as total_visits,
    COUNT(DISTINCT tv.ip_address) as unique_visitors,
    COUNT(tv.line_user_id) as conversions,
    CASE
        WHEN COUNT(tv.id) > 0
        THEN ROUND((COUNT(tv.line_user_id)::numeric / COUNT(tv.id)::numeric) * 100, 2)
        ELSE 0
    END as conversion_rate,
    tl.created_at
FROM tracking_links tl
LEFT JOIN tracking_visits tv ON tl.id = tv.tracking_link_id
WHERE tl.is_active = true
GROUP BY tl.id, tl.name, tl.tracking_code, tl.utm_source, tl.utm_medium, tl.utm_campaign, tl.created_at
ORDER BY tl.created_at DESC;

-- Create view for recent activity
CREATE VIEW recent_activity AS
SELECT
    'visit' as activity_type,
    tv.id,
    tl.name as link_name,
    tv.ip_address,
    tv.user_agent,
    tv.utm_source,
    tv.visited_at as activity_time,
    lu.display_name as user_name,
    CASE WHEN tv.line_user_id IS NOT NULL THEN true ELSE false END as converted
FROM tracking_visits tv
JOIN tracking_links tl ON tv.tracking_link_id = tl.id
LEFT JOIN line_users lu ON tv.line_user_id = lu.id
UNION ALL
SELECT
    'user_join' as activity_type,
    lu.id,
    'LINE Friend Add' as link_name,
    null as ip_address,
    null as user_agent,
    null as utm_source,
    lu.created_at as activity_time,
    lu.display_name as user_name,
    true as converted
FROM line_users lu
WHERE lu.is_friend = true
ORDER BY activity_time DESC
LIMIT 100;

-- Row Level Security (RLS) Policies
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access (for functions)
CREATE POLICY "Allow public read access" ON tracking_links
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON tracking_links
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access" ON tracking_visits
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON tracking_visits
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON tracking_visits
    FOR UPDATE USING (true);

CREATE POLICY "Allow public read access" ON line_users
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON line_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON line_users
    FOR UPDATE USING (true);

-- Insert sample data for testing
INSERT INTO tracking_links (name, tracking_code, line_friend_url, utm_source, utm_medium, utm_campaign) VALUES
('Summer Campaign 2024', 'summer24', 'https://line.me/R/ti/p/@your-line-id', 'facebook', 'social', 'summer_2024'),
('Google Ads Test', 'googlead1', 'https://line.me/R/ti/p/@your-line-id', 'google', 'cpc', 'brand_awareness'),
('Email Newsletter', 'email001', 'https://line.me/R/ti/p/@your-line-id', 'email', 'newsletter', 'monthly_update');

-- Create function to get tracking statistics
CREATE OR REPLACE FUNCTION get_tracking_overview()
RETURNS TABLE (
    total_links bigint,
    total_visits bigint,
    total_users bigint,
    conversion_rate numeric
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM tracking_links WHERE is_active = true) as total_links,
        (SELECT COUNT(*) FROM tracking_visits) as total_visits,
        (SELECT COUNT(*) FROM line_users WHERE is_friend = true) as total_users,
        CASE
            WHEN (SELECT COUNT(*) FROM tracking_visits) > 0
            THEN ROUND(
                ((SELECT COUNT(*) FROM line_users WHERE is_friend = true)::numeric /
                 (SELECT COUNT(*) FROM tracking_visits)::numeric) * 100, 2
            )
            ELSE 0
        END as conversion_rate;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Comments for documentation
COMMENT ON TABLE tracking_links IS 'Stores tracking link configurations for campaigns';
COMMENT ON TABLE tracking_visits IS 'Records each visit to tracking links with analytics data';
COMMENT ON TABLE line_users IS 'Stores LINE user profiles and friend status';
COMMENT ON VIEW tracking_stats IS 'Analytics view showing conversion statistics per tracking link';
COMMENT ON VIEW recent_activity IS 'Combined view of recent visits and user joins for activity feed';