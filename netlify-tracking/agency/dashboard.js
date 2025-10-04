function agencyDashboard() {
    return {
        // Authentication
        isAuthenticated: false,
        showRegister: false,
        loginForm: {
            email: '',
            password: '',
            remember: false
        },
        loginError: '',
        loading: false,

        // Registration form
        registerForm: {
            company_name: '',
            agency_name: '',
            address: '',
            contact_name: '',
            email: '',
            phone: '',
            password: '',
            password_confirm: '',
            agree_terms: false
        },
        registerError: '',
        registerSuccess: false,

        // Agency & User Info
        agencyInfo: {
            id: '',
            code: '',
            name: '',
            company_name: '',
            contact_email: '',
            contact_phone: '',
            commission_rate: 10
        },
        userInfo: {
            id: '',
            name: '',
            email: '',
            role: ''
        },

        // Dashboard state
        activeTab: 'create',
        stats: {
            totalLinks: 0,
            totalClicks: 0,
            totalConversions: 0,
            conversionRate: 0,
            monthlyCommission: 0,
            lastMonthCommission: 0,
            totalCommission: 0
        },

        // Create link form
        newLink: {
            name: '',
            utm_source: '',
            utm_medium: '',
            utm_campaign: '',
            utm_term: '',
            utm_content: '',
            line_friend_url: '',
            destination_url: ''
        },
        createdLink: '',

        // Data
        trackingLinks: [],
        analytics: [],
        commissions: [],
        topCampaigns: [],

        // Settings
        paymentInfo: {
            bank_name: '',
            branch_name: '',
            account_type: '普通',
            account_number: '',
            account_holder: ''
        },

        async init() {
            // Check for existing authentication
            const authToken = localStorage.getItem('agencyAuthToken');
            const agencyId = localStorage.getItem('agencyId');

            if (authToken && agencyId) {
                this.isAuthenticated = true;
                await this.loadDashboardData();
            }
        },

        async login() {
            this.loading = true;
            this.loginError = '';

            try {
                const response = await fetch('/.netlify/functions/agency-auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: this.loginForm.email,
                        password: this.loginForm.password
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    this.isAuthenticated = true;

                    // Store authentication info
                    localStorage.setItem('agencyAuthToken', result.token);
                    localStorage.setItem('agencyId', result.agency.id);

                    if (this.loginForm.remember) {
                        localStorage.setItem('rememberLogin', 'true');
                    }

                    // Set agency and user info
                    this.agencyInfo = result.agency;
                    this.userInfo = result.user;

                    await this.loadDashboardData();
                } else {
                    this.loginError = result.error || 'メールアドレスまたはパスワードが間違っています';
                }
            } catch (error) {
                this.loginError = 'ログインに失敗しました。しばらくしてから再度お試しください。';
                console.error('Login error:', error);
            } finally {
                this.loading = false;
            }
        },

        logout() {
            this.isAuthenticated = false;
            localStorage.removeItem('agencyAuthToken');
            localStorage.removeItem('agencyId');
            localStorage.removeItem('rememberLogin');
            this.loginForm = { email: '', password: '', remember: false };
            this.loginError = '';
        },

        async register() {
            this.loading = true;
            this.registerError = '';
            this.registerSuccess = false;

            // Validate form
            if (this.registerForm.password !== this.registerForm.password_confirm) {
                this.registerError = 'パスワードが一致しません';
                this.loading = false;
                return;
            }

            if (this.registerForm.password.length < 8) {
                this.registerError = 'パスワードは8文字以上で入力してください';
                this.loading = false;
                return;
            }

            if (!this.registerForm.agree_terms) {
                this.registerError = '利用規約に同意してください';
                this.loading = false;
                return;
            }

            try {
                const response = await fetch('/.netlify/functions/agency-register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        company_name: this.registerForm.company_name,
                        agency_name: this.registerForm.agency_name,
                        address: this.registerForm.address,
                        contact_name: this.registerForm.contact_name,
                        email: this.registerForm.email,
                        phone: this.registerForm.phone,
                        password: this.registerForm.password
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    this.registerSuccess = true;
                    this.registerError = '';

                    // 3秒後にログイン画面に移動
                    setTimeout(() => {
                        this.showRegister = false;
                        this.registerSuccess = false;
                        // ログインフォームにメールアドレスをセット
                        this.loginForm.email = this.registerForm.email;
                        // 登録フォームをリセット
                        this.registerForm = {
                            company_name: '',
                            agency_name: '',
                            address: '',
                            contact_name: '',
                            email: '',
                            phone: '',
                            password: '',
                            password_confirm: '',
                            agree_terms: false
                        };
                    }, 3000);
                } else {
                    this.registerError = result.error || '登録に失敗しました';
                }
            } catch (error) {
                this.registerError = '登録処理中にエラーが発生しました';
                console.error('Registration error:', error);
            } finally {
                this.loading = false;
            }
        },

        async loadDashboardData() {
            try {
                await Promise.all([
                    this.loadStats(),
                    this.loadTrackingLinks()
                ]);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            }
        },

        async loadStats() {
            try {
                const response = await fetch(`/.netlify/functions/agency-stats`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.stats = {
                        ...this.stats,
                        ...data
                    };
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        },

        async createLink() {
            this.loading = true;
            try {
                const response = await fetch('/.netlify/functions/agency-create-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    },
                    body: JSON.stringify(this.newLink)
                });

                if (response.ok) {
                    const data = await response.json();
                    this.createdLink = `https://taskmateai.net/t/${data.tracking_code}`;

                    // Reset form
                    this.newLink = {
                        name: '',
                        utm_source: '',
                        utm_medium: '',
                        utm_campaign: '',
                        utm_term: '',
                        utm_content: '',
                        line_friend_url: '',
                        destination_url: ''
                    };

                    await this.loadTrackingLinks();
                    await this.loadStats();

                    // Show success message
                    setTimeout(() => {
                        this.createdLink = '';
                    }, 10000);
                } else {
                    const error = await response.json();
                    alert('リンク作成エラー: ' + error.message);
                }
            } catch (error) {
                console.error('Error creating link:', error);
                alert('リンク作成に失敗しました');
            } finally {
                this.loading = false;
            }
        },

        resetForm() {
            this.newLink = {
                name: '',
                utm_source: '',
                utm_medium: '',
                utm_campaign: '',
                utm_term: '',
                utm_content: '',
                line_friend_url: '',
                destination_url: ''
            };
            this.createdLink = '';
        },

        async loadTrackingLinks() {
            try {
                const response = await fetch('/.netlify/functions/agency-links', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.trackingLinks = data.links || [];
                }
            } catch (error) {
                console.error('Error loading links:', error);
            }
        },

        async loadAnalytics() {
            try {
                const response = await fetch('/.netlify/functions/agency-analytics', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.analytics = data.analytics || [];
                    this.topCampaigns = data.topCampaigns || [];

                    // Initialize chart if needed
                    this.initPerformanceChart();
                }
            } catch (error) {
                console.error('Error loading analytics:', error);
            }
        },

        async loadCommissions() {
            try {
                const response = await fetch('/.netlify/functions/agency-commissions', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.commissions = data.commissions || [];
                }
            } catch (error) {
                console.error('Error loading commissions:', error);
            }
        },

        async saveSettings() {
            this.loading = true;
            try {
                const response = await fetch('/.netlify/functions/agency-settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    },
                    body: JSON.stringify({
                        agencyInfo: this.agencyInfo,
                        paymentInfo: this.paymentInfo
                    })
                });

                if (response.ok) {
                    alert('設定を保存しました');
                } else {
                    alert('設定の保存に失敗しました');
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                alert('設定の保存中にエラーが発生しました');
            } finally {
                this.loading = false;
            }
        },

        cancelSettings() {
            // Reload original data
            this.loadDashboardData();
        },

        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);

                // Show temporary success message
                const button = event.target.closest('button');
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> コピー済み！';
                button.classList.remove('bg-emerald-100', 'hover:bg-emerald-200');
                button.classList.add('bg-green-100');

                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.classList.remove('bg-green-100');
                    button.classList.add('bg-emerald-100', 'hover:bg-emerald-200');
                }, 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
                alert('コピーに失敗しました');
            }
        },

        getTrackingUrl(code) {
            return `https://taskmateai.net/t/${code}`;
        },

        formatDate(dateString) {
            return new Date(dateString).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        getStatusLabel(status) {
            const labels = {
                'pending': '確認中',
                'approved': '承認済',
                'paid': '支払済',
                'cancelled': 'キャンセル'
            };
            return labels[status] || status;
        },

        viewLinkDetails(link) {
            // Implementation for viewing detailed link analytics
            console.log('View details for:', link);
            // Could open a modal or navigate to detailed view
        },

        initPerformanceChart() {
            // Initialize chart using Chart.js or similar
            // This is a placeholder for chart initialization
            console.log('Initializing performance chart');
        }
    };
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('TaskMate AI Agency Dashboard loaded');
});