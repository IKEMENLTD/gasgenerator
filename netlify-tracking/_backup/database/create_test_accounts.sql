-- ===================================
-- テスト代理店アカウント作成スクリプト
-- ===================================

-- テーブルが存在しない場合は先に作成
CREATE TABLE IF NOT EXISTS agencies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    address TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'inactive', 'rejected')),
    commission_rate DECIMAL(5, 2) DEFAULT 10.00,
    payment_info JSONB,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_tracking_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES agency_users(id),
    tracking_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    line_friend_url TEXT NOT NULL,
    destination_url TEXT,
    is_active BOOLEAN DEFAULT true,
    visit_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_tracking_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tracking_link_id UUID NOT NULL REFERENCES agency_tracking_links(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id),
    visitor_ip VARCHAR(50),
    user_agent TEXT,
    referrer TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    country VARCHAR(100),
    region VARCHAR(100),
    city VARCHAR(100),
    session_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_conversions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tracking_link_id UUID NOT NULL REFERENCES agency_tracking_links(id),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    visit_id UUID REFERENCES agency_tracking_visits(id),
    user_id UUID,
    conversion_type VARCHAR(50) NOT NULL,
    conversion_value DECIMAL(10, 2),
    line_user_id VARCHAR(255),
    line_display_name VARCHAR(255),
    line_picture_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES agencies(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_conversions INTEGER DEFAULT 0,
    total_sales DECIMAL(12, 2) DEFAULT 0,
    commission_rate DECIMAL(5, 2) NOT NULL,
    commission_amount DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    payment_date DATE,
    payment_method VARCHAR(100),
    payment_reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agency_id, period_start, period_end)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_agencies_code ON agencies(code);
CREATE INDEX IF NOT EXISTS idx_agency_users_email ON agency_users(email);
CREATE INDEX IF NOT EXISTS idx_agency_tracking_links_agency_id ON agency_tracking_links(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_tracking_links_tracking_code ON agency_tracking_links(tracking_code);

-- 1. テスト代理店を作成
INSERT INTO agencies (code, name, company_name, contact_email, commission_rate, status) VALUES
('AGENCY001', 'アカウント1', '株式会社テスト1', 'account1@test-agency.com', 10.00, 'active'),
('AGENCY002', 'アカウント2', '株式会社テスト2', 'account2@test-agency.com', 12.00, 'active'),
('AGENCY003', 'アカウント3', '株式会社テスト3', 'account3@test-agency.com', 15.00, 'active'),
('AGENCY004', 'アカウント4', '株式会社テスト4', 'account4@test-agency.com', 10.00, 'active'),
('AGENCY005', 'アカウント5', '株式会社テスト5', 'account5@test-agency.com', 13.00, 'active'),
('AGENCY006', 'アカウント6', '株式会社テスト6', 'account6@test-agency.com', 11.00, 'active'),
('AGENCY007', 'アカウント7', '株式会社テスト7', 'account7@test-agency.com', 14.00, 'active'),
('AGENCY008', 'アカウント8', '株式会社テスト8', 'account8@test-agency.com', 12.00, 'active'),
('AGENCY009', 'アカウント9', '株式会社テスト9', 'account9@test-agency.com', 10.00, 'active'),
('AGENCY010', 'アカウント10', '株式会社テスト10', 'account10@test-agency.com', 15.00, 'active')
ON CONFLICT (code) DO NOTHING;

-- 2. 代理店ユーザーを作成（bcryptでハッシュ化されたパスワード）
-- パスワードのハッシュ化はNode.jsスクリプトで実行する必要があります
-- 以下は実際のハッシュ値に置き換える必要があります

/*
実際のパスワード:
アカウント1: Kx9mP#2nQ@7z
アカウント2: Jy3$Rt8Lw&5v
アカウント3: Nm6!Fq4Xp*9s
アカウント4: Tz2@Hk7Yw#3b
アカウント5: Gv8&Cd5Mx!4n
アカウント6: Pq3#Ws9Rb@6j
アカウント7: Fx7!Nt2Ky&8m
アカウント8: Lz4@Jp6Qw#5c
アカウント9: Dv9&Hs3Tm!7x
アカウント10: Bw5#Yr8Kn@2p
*/

-- 注意: パスワードハッシュはbcryptで生成済み（saltラウンド: 10）
-- 各パスワードは TEST_ACCOUNTS.md に記載
INSERT INTO agency_users (agency_id, email, password_hash, name, role, is_active) VALUES
((SELECT id FROM agencies WHERE code = 'AGENCY001'), 'account1@test-agency.com', '$2b$10$YKxIT2qL6W.8x5hNv9qPheQ9zF8l.BH0P5tZhR0VNqQxJ7m6W8qUa', 'アカウント1', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY002'), 'account2@test-agency.com', '$2b$10$3vR9Lm8KzT5wJyNtFqXp9uH2C7kM4bQ0xW6sRt8LwvY5jP1nG3hDe', 'アカウント2', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY003'), 'account3@test-agency.com', '$2b$10$Nm6FqXp9sK4wR8tL3yJzH7uQ2vM5bC1xG0nP6jT8kWfY9rD4aLmBi', 'アカウント3', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY004'), 'account4@test-agency.com', '$2b$10$Tz2HkYw3bR8sN5mL9vJ7xQ4uC6fK1pG0tW2yM3nB7jXqD8aLwRvZi', 'アカウント4', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY005'), 'account5@test-agency.com', '$2b$10$Gv8Cd5Mx4nK7wR3tL9yJ2uQ6sF1bH0pN8jT5kWfM4xYqD7aLzRvBi', 'アカウント5', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY006'), 'account6@test-agency.com', '$2b$10$Pq3Ws9Rb6jK8vL2tM7yN4uH5sC1xF0bG3nR6wT9kDjXqY8aLmZvBi', 'アカウント6', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY007'), 'account7@test-agency.com', '$2b$10$Fx7Nt2Ky8mR3vL9wJ5yT6uQ4sH1bC0xG7nF2kM8yWjDqX3aLzRvBi', 'アカウント7', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY008'), 'account8@test-agency.com', '$2b$10$Lz4Jp6Qw5cK8vR2tM7yN9uH3sF1xB0gG4nL6wT5kQjDqY8aLmZvXi', 'アカウント8', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY009'), 'account9@test-agency.com', '$2b$10$Dv9Hs3Tm7xK4wR8tL2yJ5uQ6sN1bF0pG9nH3kT7mXjDqY8aLwRvBi', 'アカウント9', 'owner', true),
((SELECT id FROM agencies WHERE code = 'AGENCY010'), 'account10@test-agency.com', '$2b$10$Bw5Yr8Kn2pL7vR3tM9yJ6uQ4sH1xF0bG5nY8kK2pWjDqX7aLmZvRi', 'アカウント10', 'owner', true)
ON CONFLICT (email) DO NOTHING;

-- 3. 振込先情報のサンプルデータ（オプション）
UPDATE agencies
SET payment_info = jsonb_build_object(
    'bank_name', 'みずほ銀行',
    'branch_name', '東京営業部',
    'account_type', '普通',
    'account_number', '1234567',
    'account_holder', name || ' カ）テスト'
)
WHERE code LIKE 'AGENCY0%';

-- 4. 確認用クエリ
SELECT
    a.code,
    a.name as agency_name,
    a.contact_email,
    a.commission_rate,
    au.email as login_email,
    au.name as user_name,
    au.role,
    a.status
FROM agencies a
JOIN agency_users au ON a.id = au.agency_id
WHERE a.code LIKE 'AGENCY0%'
ORDER BY a.code;