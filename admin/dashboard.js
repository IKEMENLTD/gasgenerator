function adminDashboard() {
    return {
        // Authentication
        isAuthenticated: false,
        loginForm: {
            username: '',
            password: ''
        },
        loginError: '',
        loading: false,

        // SECURITY: Brute force protection
        loginAttempts: 0,
        maxLoginAttempts: 5,
        lockoutUntil: null,

        // Dashboard state
        activeTab: 'create',
        stats: {
            totalLinks: 0,
            totalVisits: 0,
            lineUsers: 0,
            conversionRate: 0
        },

        // Create link form
        newLink: {
            name: '',
            utm_source: '',
            utm_medium: '',
            utm_campaign: ''
        },
        createdLink: '',

        // Data
        trackingLinks: [],
        visits: [],
        lineUsers: [],

        // Agency management
        agencies: [],
        filteredAgencies: [],
        agencyFilter: 'all',
        agencyStats: {
            total: 0,
            pending: 0,
            active: 0,
            rejected: 0,
            suspended: 0
        },
        masterAgencyCode: '', // 運営の代理店コード

        // SECURITY: All configuration is now server-side via environment variables
        // No sensitive data should be stored client-side

        async init() {
            // SECURITY: Use sessionStorage instead of localStorage
            // Token is cleared when browser tab/window closes
            const authToken = sessionStorage.getItem('trackingAdminAuth');
            if (authToken) {
                // Validate token format before accepting
                if (this.isValidToken(authToken)) {
                    this.isAuthenticated = true;
                    await this.loadDashboardData();
                } else {
                    // Invalid token, clear it
                    sessionStorage.removeItem('trackingAdminAuth');
                }
            }
        },

        isValidToken(token) {
            // Basic token validation - should be non-empty string
            // Server-side validation is the primary security measure
            return typeof token === 'string' && token.length > 10 && token.length < 500;
        },

        async login() {
            // SECURITY: Check lockout status
            if (this.lockoutUntil && Date.now() < this.lockoutUntil) {
                const remainingSeconds = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
                this.loginError = `ログイン試行回数が上限に達しました。${remainingSeconds}秒後に再試行してください。`;
                return;
            }

            // SECURITY: Input validation
            const username = this.loginForm.username.trim();
            const password = this.loginForm.password;

            if (!username || username.length < 3 || username.length > 50) {
                this.loginError = 'ユーザー名は3〜50文字で入力してください';
                return;
            }

            if (!password || password.length < 8 || password.length > 100) {
                this.loginError = 'パスワードは8〜100文字で入力してください';
                return;
            }

            // SECURITY: Block common injection patterns
            const dangerousPattern = /[<>'";&|`$(){}[\]\\]/;
            if (dangerousPattern.test(username)) {
                this.loginError = 'ユーザー名に使用できない文字が含まれています';
                this.loginAttempts++;
                return;
            }

            this.loading = true;
            this.loginError = '';

            try {
                const response = await fetch('/.netlify/functions/validate-admin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // Reset attempts on successful login
                    this.loginAttempts = 0;
                    this.lockoutUntil = null;
                    this.isAuthenticated = true;
                    sessionStorage.setItem('trackingAdminAuth', result.token);
                    await this.loadDashboardData();
                } else {
                    // SECURITY: Increment failed attempts
                    this.loginAttempts++;
                    if (this.loginAttempts >= this.maxLoginAttempts) {
                        // Lock out for 5 minutes
                        this.lockoutUntil = Date.now() + (5 * 60 * 1000);
                        this.loginError = 'ログイン試行回数が上限に達しました。5分後に再試行してください。';
                    } else {
                        const remaining = this.maxLoginAttempts - this.loginAttempts;
                        this.loginError = `ユーザー名またはパスワードが間違っています（残り${remaining}回）`;
                    }
                }
            } catch (error) {
                this.loginError = 'ログイン失敗: サーバーに接続できません。';
                console.error('Authentication error:', error);
            } finally {
                this.loading = false;
            }
        },

        logout() {
            this.isAuthenticated = false;
            sessionStorage.removeItem('trackingAdminAuth');
            // SECURITY: Clear all sensitive data on logout
            this.loginForm = { username: '', password: '' };
            this.loginError = '';
            this.trackingLinks = [];
            this.visits = [];
            this.lineUsers = [];
            this.agencies = [];
            this.filteredAgencies = [];
        },

        async loadDashboardData() {
            try {
                await Promise.all([
                    this.loadStats(),
                    this.loadTrackingLinks(),
                    this.loadMasterAgencyCode()
                ]);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            }
        },

        async loadMasterAgencyCode() {
            try {
                // 運営の代理店コード（level=0または1の最上位代理店）を取得
                const response = await fetch('/.netlify/functions/get-master-agency');
                if (response.ok) {
                    const data = await response.json();
                    this.masterAgencyCode = data.code || '';
                }
            } catch (error) {
                console.error('Error loading master agency code:', error);
                // エラーの場合はデフォルト値を設定
                this.masterAgencyCode = '取得中...';
            }
        },

        async loadStats() {
            try {
                const response = await fetch('/.netlify/functions/get-tracking-stats', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.stats = data;
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        },

        async createTrackingLink() {
            this.loading = true;
            try {
                const response = await fetch('/.netlify/functions/create-tracking-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(this.newLink)
                });

                if (response.ok) {
                    const data = await response.json();
                    this.createdLink = `https://taskmateai.net/t/${data.tracking_code}`;
                    this.newLink = {
                        name: '',
                        utm_source: '',
                        utm_medium: '',
                        utm_campaign: ''
                    };
                    await this.loadTrackingLinks();
                    await this.loadStats();
                } else {
                    const error = await response.json();
                    alert('Error creating tracking link: ' + error.message);
                }
            } catch (error) {
                console.error('Error creating tracking link:', error);
                alert('Error creating tracking link: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        async loadTrackingLinks() {
            try {
                const response = await fetch('/.netlify/functions/get-tracking-stats?type=links');
                if (response.ok) {
                    const data = await response.json();
                    this.trackingLinks = data.links || [];
                }
            } catch (error) {
                console.error('Error loading tracking links:', error);
            }
        },

        async loadVisits() {
            try {
                const response = await fetch('/.netlify/functions/get-tracking-stats?type=visits');
                if (response.ok) {
                    const data = await response.json();
                    this.visits = data.visits || [];
                }
            } catch (error) {
                console.error('Error loading visits:', error);
            }
        },

        async loadLineUsers() {
            try {
                const response = await fetch('/.netlify/functions/get-tracking-stats?type=users');
                if (response.ok) {
                    const data = await response.json();
                    this.lineUsers = data.users || [];
                }
            } catch (error) {
                console.error('Error loading LINE users:', error);
            }
        },

        async copyToClipboard(text, event) {
            try {
                await navigator.clipboard.writeText(text);

                // Show temporary success message (XSS safe)
                const button = event.currentTarget;
                const originalContent = button.innerHTML;

                // Clear and rebuild safely
                button.textContent = '';
                const icon = document.createElement('i');
                icon.className = 'fas fa-check';
                const textNode = document.createTextNode(' コピー済み！');
                button.appendChild(icon);
                button.appendChild(textNode);

                button.classList.remove('bg-emerald-100', 'hover:bg-emerald-200', 'text-emerald-600');
                button.classList.add('bg-green-100', 'text-green-600');

                setTimeout(() => {
                    button.innerHTML = originalContent;
                    button.classList.remove('bg-green-100', 'text-green-600');
                    button.classList.add('bg-emerald-100', 'hover:bg-emerald-200', 'text-emerald-600');
                }, 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
                alert('Failed to copy to clipboard');
            }
        },

        // Agency management methods
        async loadAgencies() {
            this.loading = true;
            try {
                const response = await fetch('/.netlify/functions/admin-agencies', {
                    headers: {
                        'Authorization': `Bearer admin:${sessionStorage.getItem('trackingAdminAuth')}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.agencies = data.agencies || [];
                    this.agencyStats = data.stats || {
                        total: 0,
                        pending: 0,
                        active: 0,
                        rejected: 0,
                        suspended: 0
                    };
                    this.filterAgencies();
                }
            } catch (error) {
                console.error('Error loading agencies:', error);
            } finally {
                this.loading = false;
            }
        },

        filterAgencies() {
            if (this.agencyFilter === 'all') {
                this.filteredAgencies = this.agencies;
            } else {
                this.filteredAgencies = this.agencies.filter(agency =>
                    agency.status === this.agencyFilter
                );
            }
        },

        async approveAgency(agencyId) {
            if (!confirm('この代理店を承認しますか？')) return;
            await this.updateAgencyStatus(agencyId, 'approve');
        },

        async rejectAgency(agencyId) {
            if (!confirm('この代理店を非承認にしますか？')) return;
            await this.updateAgencyStatus(agencyId, 'reject');
        },

        async suspendAgency(agencyId) {
            if (!confirm('この代理店を一時停止しますか？')) return;
            await this.updateAgencyStatus(agencyId, 'suspend');
        },

        async activateAgency(agencyId) {
            if (!confirm('この代理店を再開しますか？')) return;
            await this.updateAgencyStatus(agencyId, 'activate');
        },

        async updateAgencyStatus(agencyId, action) {
            this.loading = true;
            try {
                const response = await fetch('/.netlify/functions/admin-agencies', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer admin:${sessionStorage.getItem('trackingAdminAuth')}`
                    },
                    body: JSON.stringify({
                        action,
                        agencyId
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    alert(result.message);
                    await this.loadAgencies();
                } else {
                    const error = await response.json();
                    alert('エラー: ' + error.error);
                }
            } catch (error) {
                console.error('Error updating agency status:', error);
                alert('ステータス更新に失敗しました');
            } finally {
                this.loading = false;
            }
        },

        viewAgencyDetails(agency) {
            // SECURITY: Escape all user-provided data before display
            const escapeText = (str) => {
                if (!str) return 'N/A';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
            };

            const details = [
                '代理店詳細:',
                `コード: ${escapeText(agency.code)}`,
                `会社名: ${escapeText(agency.company_name)}`,
                `代理店名: ${escapeText(agency.name)}`,
                `担当者: ${escapeText(agency.owner_name)}`,
                `メール: ${escapeText(agency.contact_email)}`,
                `電話: ${escapeText(agency.contact_phone)}`,
                `住所: ${escapeText(agency.address)}`,
                `手数料率: ${Number(agency.commission_rate) || 0}%`,
                `ステータス: ${escapeText(this.getStatusLabel(agency.status))}`,
                `登録日: ${escapeText(this.formatDate(agency.created_at))}`
            ].join('\n');

            alert(details);
        },

        getStatusLabel(status) {
            const labels = {
                'pending': '承認待ち',
                'active': '承認済み',
                'rejected': '非承認',
                'suspended': '一時停止'
            };
            return labels[status] || status;
        },

        formatDate(dateString) {
            return new Date(dateString).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };
}

// Utility functions
function generateTrackingCode() {
    return Math.random().toString(36).substring(2, 8) +
           Math.random().toString(36).substring(2, 8);
}


// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('TaskMate AI Tracking Dashboard loaded');
});