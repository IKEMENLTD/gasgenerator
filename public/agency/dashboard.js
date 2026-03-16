console.log('📦 dashboard.js loading...');

function agencyDashboard() {
    console.log('🎯 agencyDashboard() function called');
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
        loginErrorData: null,  // エラー時のアクション情報を保存
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
            invitation_code: '',
            agree_terms: false
        },
        registerError: '',
        registerSuccess: false,
        showLineConfirmModal: false,
        pendingRegistrationData: null,

        // Agency & User Info
        agencyInfo: {
            id: '',
            code: '',
            name: '',
            company_name: '',
            contact_email: '',
            contact_phone: '',
            // 4段階代理店制度の情報
            level: 1,
            own_commission_rate: 20.00,
            parent_agency_id: null
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
            utm_content: ''
        },
        createdLink: '',

        // Data
        trackingLinks: [],
        analytics: [],
        commissions: [],
        topCampaigns: [],
        performanceChart: null, // Chart.js instance
        billingStats: {
            summary: {
                activeSubscribers: 0,
                totalConversions: 0,
                totalCommission: 0,
                paidCommission: 0,
                pendingCommission: 0,
                commissionRate: 0
            },
            billingUsers: [],
            lastUpdated: null
        },
        billingStatsInterval: null,

        // Referral users (from child agencies)
        referralUsers: [],
        referralSummary: {
            totalUsers: 0,
            activeSubscriptions: 0,
            totalReferralCommission: 0
        },

        // Settings
        paymentInfo: {
            bank_name: '',
            branch_name: '',
            account_type: '普通',
            account_number: '',
            account_holder: ''
        },

        // Password change modal
        changePasswordModal: false,
        changePasswordForm: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        },
        changePasswordError: '',
        changePasswordSuccess: false,
        showCurrentPassword: false,
        showNewPassword: false,
        showConfirmPassword: false,
        passwordStrength: 'weak',
        passwordStrengthLabel: '弱い',

        // Link details modal
        linkDetailsModal: false,
        selectedLink: null,
        linkVisits: [],
        loadingVisits: false,

        // 4段階代理店制度 - 階層情報
        referralInfo: {
            childAgencies: [],
            totalChildren: 0,
            hierarchyChain: []
        },

        // 4段階代理店制度 - コミッション履歴
        commissionHistory: [],
        loadingCommissions: false,

        // セッションタイムアウト管理
        inactivityTimer: null,
        INACTIVITY_TIMEOUT: 30 * 60 * 1000,  // 30分

        async init() {
            console.log('🚀 Agency Dashboard init() started');

            try {
                // LINE連携コールバックをチェック
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('code') && urlParams.has('state')) {
                    console.log('📞 LINE callback detected');
                    await this.handleLineCallback();
                    return; // コールバック処理後は通常の初期化をスキップ
                }

                // Cookie認証を優先、LocalStorageはフォールバック（下位互換性）
                // Cookieが設定されているかチェック（agencyIdで確認）
                const hasCookieAuth = document.cookie.includes('agencyId=');
                console.log('🍪 Cookie auth check:', hasCookieAuth);
                console.log('📋 All cookies:', document.cookie);

                // LocalStorageもチェック
                const authToken = localStorage.getItem('agencyAuthToken');
                const agencyId = localStorage.getItem('agencyId');
                console.log('💾 LocalStorage auth check:', {
                    hasToken: !!authToken,
                    hasAgencyId: !!agencyId
                });

                if (hasCookieAuth || (authToken && agencyId)) {
                    console.log('✅ User is authenticated, loading dashboard...');
                    this.isAuthenticated = true;

                    try {
                        await this.loadDashboardData();
                        console.log('✅ Dashboard data loaded successfully');

                        // 課金情報の自動更新を開始
                        this.startBillingStatsAutoRefresh();
                        console.log('✅ Billing stats auto-refresh started');

                        // セッションタイムアウト監視を開始
                        this.startInactivityTimer();
                        console.log('✅ Inactivity timer started');
                    } catch (dataError) {
                        console.error('❌ Error loading dashboard data:', dataError);
                        console.error('Error details:', {
                            message: dataError.message,
                            stack: dataError.stack
                        });
                        // エラーが起きてもログイン画面は表示する
                        this.isAuthenticated = false;
                    }
                } else {
                    console.log('ℹ️  User not authenticated, showing login screen');
                    this.isAuthenticated = false;
                }

                console.log('✅ Agency Dashboard init() completed');
            } catch (error) {
                console.error('❌❌❌ CRITICAL ERROR in init() ❌❌❌');
                console.error('Error type:', error.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);

                // エラーが起きてもログイン画面は表示する
                this.isAuthenticated = false;
            }
        },

        // セッションタイムアウト管理
        startInactivityTimer() {
            // 既存のタイマーをクリア
            this.clearInactivityTimer();

            // 非アクティビティタイマーをリセット
            this.resetInactivityTimer();

            // ユーザーアクティビティイベントを監視
            const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
            events.forEach(event => {
                document.addEventListener(event, this.resetInactivityTimer.bind(this), true);
            });
        },

        resetInactivityTimer() {
            // 既存のタイマーをクリア
            this.clearInactivityTimer();

            // 新しいタイマーを設定
            this.inactivityTimer = setTimeout(() => {
                this.handleSessionTimeout();
            }, this.INACTIVITY_TIMEOUT);
        },

        clearInactivityTimer() {
            if (this.inactivityTimer) {
                clearTimeout(this.inactivityTimer);
                this.inactivityTimer = null;
            }
        },

        handleSessionTimeout() {
            alert('非アクティブ状態が続いたため、セキュリティ上の理由からログアウトしました。\n再度ログインしてください。');
            this.logout();
        },

        async login() {
            console.log('=== 🔐 フロントエンド: ログイン処理開始 ===');
            console.log('入力メールアドレス:', this.loginForm.email);
            console.log('パスワード長:', this.loginForm.password ? this.loginForm.password.length : 0);

            this.loading = true;
            this.loginError = '';
            this.loginErrorData = null;  // エラーデータをリセット

            try{
                console.log('API呼び出し: /.netlify/functions/agency-auth');
                const response = await fetch('/.netlify/functions/agency-auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',  // Cookie認証のために必要
                    body: JSON.stringify({
                        email: this.loginForm.email,
                        password: this.loginForm.password
                    })
                });

                console.log('API応答ステータス:', response.status);
                console.log('API応答OK:', response.ok);

                const result = await response.json();
                console.log('API応答データ:', result);

                if (response.ok && result.success) {
                    console.log('✅ ログイン成功');
                    console.log('ユーザー情報:', result.user);
                    console.log('代理店情報:', result.agency);

                    this.isAuthenticated = true;

                    // HttpOnly Cookieが自動的に設定される
                    // LocalStorageは下位互換性のために保持（オプション）
                    // 注意: 将来的にはCookieのみに移行予定
                    console.log('LocalStorageに保存中...');
                    localStorage.setItem('agencyAuthToken', result.token);
                    localStorage.setItem('agencyId', result.agency.id);

                    if (this.loginForm.remember) {
                        localStorage.setItem('rememberLogin', 'true');
                        console.log('ログイン状態を記憶');
                    }

                    // Set agency and user info
                    this.agencyInfo = result.agency;
                    this.userInfo = result.user;

                    console.log('ダッシュボードデータ読み込み開始...');
                    await this.loadDashboardData();

                    console.log('課金情報の自動更新を開始');
                    this.startBillingStatsAutoRefresh();

                    console.log('セッションタイムアウト監視を開始');
                    this.startInactivityTimer();

                    console.log('=== ✅✅✅ ログイン処理完了 ✅✅✅ ===');
                } else {
                    console.error('❌ ログイン失敗');
                    console.error('ステータス:', response.status);
                    console.error('エラーメッセージ:', result.error);
                    console.error('エラー詳細データ:', result);

                    // エラーメッセージとアクション情報を保存
                    this.loginError = result.message || result.error || 'メールアドレスまたはパスワードが間違っています';
                    this.loginErrorData = result;  // アクション情報を含む完全なエラーデータを保存
                }
            } catch (error) {
                console.error('❌❌❌ ログイン処理でエラー発生 ❌❌❌');
                console.error('エラー詳細:', error);
                console.error('エラーメッセージ:', error.message);
                console.error('エラースタック:', error.stack);

                this.loginError = 'ログインに失敗しました。しばらくしてから再度お試しください。';
            } finally {
                console.log('ローディング終了');
                this.loading = false;
            }
        },

        logout() {
            // 自動更新を停止
            this.stopBillingStatsAutoRefresh();

            // セッションタイムアウト監視を停止
            this.clearInactivityTimer();

            this.isAuthenticated = false;
            localStorage.removeItem('agencyAuthToken');
            localStorage.removeItem('agencyId');
            localStorage.removeItem('rememberLogin');
            this.loginForm = { email: '', password: '', remember: false };
            this.loginError = '';

            // Cookieもクリア（ログアウトAPIを呼び出す）
            fetch('/.netlify/functions/agency-logout', {
                method: 'POST',
                credentials: 'include'
            }).catch(err => console.error('Logout error:', err));
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

            // パスワード強度チェック（強制）
            const passwordStrength = this.calculatePasswordStrength(this.registerForm.password);
            if (passwordStrength === 'weak') {
                this.registerError = 'パスワードが弱すぎます。英大文字、英小文字、数字、記号のうち2種類以上を組み合わせてください';
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
                        password: this.registerForm.password,
                        invitation_code: this.registerForm.invitation_code
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // LINE連携が必要な場合
                    if (result.requires_line_verification) {
                        // 登録データを保存して確認モーダルを表示
                        this.pendingRegistrationData = result;
                        this.registerSuccess = true;  // プログレスインジケーターを進める
                        this.showLineConfirmModal = true;  // 確認モーダルを表示
                    } else {
                        // 通常の登録完了（LINE連携なし）
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
                                invitation_code: '',
                                agree_terms: false
                            };
                        }, 3000);
                    }
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

        async proceedToLineAuth() {
            // 確認モーダルを閉じる
            this.showLineConfirmModal = false;
            this.loading = true;

            try {
                if (!this.pendingRegistrationData) {
                    this.registerError = '登録データが見つかりません。最初から登録をやり直してください。';
                    this.loading = false;
                    return;
                }

                // 登録トークンを保存
                localStorage.setItem('registrationToken', this.pendingRegistrationData.registration_token);

                // LINE Login URLを取得してリダイレクト
                const lineUrlResponse = await fetch('/.netlify/functions/agency-get-line-url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        registration_token: this.pendingRegistrationData.registration_token
                    })
                });

                if (lineUrlResponse.ok) {
                    const lineUrlData = await lineUrlResponse.json();
                    // stateとregistration_tokenをセッションストレージに保存
                    sessionStorage.setItem('lineAuthState', lineUrlData.state);
                    sessionStorage.setItem('lineAuthToken', lineUrlData.registration_token);

                    // LINE Loginページにリダイレクト
                    window.location.href = lineUrlData.line_login_url;
                } else {
                    this.registerError = 'LINE連携の準備に失敗しました。しばらくしてから再度お試しください。';
                    this.loading = false;
                }
            } catch (error) {
                console.error('Error proceeding to LINE auth:', error);
                this.registerError = 'LINE連携の準備中にエラーが発生しました。';
                this.loading = false;
            }
        },

        async handleLineCallback() {
            console.log('🔗 Handling LINE callback...');
            this.loading = true;

            try {
                // URLパラメータを取得
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const state = urlParams.get('state');

                console.log('LINE callback params:', { code: code ? 'present' : 'missing', state });

                // セッションストレージから保存した値を取得
                const savedState = sessionStorage.getItem('lineAuthState');
                const registrationToken = sessionStorage.getItem('lineAuthToken');

                console.log('Saved state:', savedState);
                console.log('Registration token:', registrationToken ? 'present' : 'missing');

                // CSRF保護: stateパラメータを検証
                if (!savedState || state !== savedState) {
                    console.error('❌ State mismatch! CSRF attack detected');
                    this.registerError = 'セキュリティエラー: 不正なリクエストです。最初から登録をやり直してください。';
                    this.isAuthenticated = false;
                    this.loading = false;
                    // URLをクリーンアップ
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                if (!registrationToken) {
                    console.error('❌ Registration token not found');
                    this.registerError = '登録情報が見つかりません。最初から登録をやり直してください。';
                    this.isAuthenticated = false;
                    this.loading = false;
                    // URLをクリーンアップ
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                // バックエンドに送信
                const callbackUrl = window.location.origin + window.location.pathname;
                const response = await fetch('/.netlify/functions/agency-complete-registration', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: code,
                        registration_token: registrationToken,
                        redirect_uri: callbackUrl
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    console.log('✅ Registration completed successfully');

                    // 友達追加が必要な場合はLINE公式アカウントにリダイレクト
                    if (result.requires_friend_add && result.line_official_url) {
                        console.log('🔄 Redirecting to LINE friend add page...');
                        console.log('LINE Official URL:', result.line_official_url);

                        // URLの有効性チェック（無効なフォールバックURLを検出）
                        if (result.line_official_url.includes('@xxx') ||
                            result.line_official_url.includes('@your-line-id') ||
                            !result.line_official_url.startsWith('https://line.me/')) {
                            console.error('❌ 無効なLINE URLが返されました:', result.line_official_url);
                            this.registerError = 'LINE友達追加機能の設定に問題があります。管理者にお問い合わせください。';
                            this.loading = false;

                            // セッションストレージをクリア
                            sessionStorage.removeItem('lineAuthState');
                            sessionStorage.removeItem('lineAuthToken');
                            return;
                        }

                        // 代理店コードを保存（友達追加完了後の確認用）
                        if (result.agency?.code) {
                            localStorage.setItem('agencyCode', result.agency.code);
                        }

                        // セッションストレージをクリア
                        sessionStorage.removeItem('lineAuthState');
                        sessionStorage.removeItem('lineAuthToken');

                        // URLをクリーンアップしてからリダイレクト
                        window.history.replaceState({}, document.title, window.location.pathname);

                        // LINE友達追加ページにリダイレクト
                        console.log('✅ 有効なLINE URLにリダイレクトします');

                        // リダイレクトが5秒以内に実行されない場合の警告（ユーザーがポップアップブロッカーを使用している可能性）
                        const redirectTimeout = setTimeout(() => {
                            console.warn('⚠️ リダイレクトに時間がかかっています');
                            alert('リダイレクトに失敗した場合は、下記URLを手動で開いてください:\n' + result.line_official_url);
                        }, 5000);

                        try {
                            window.location.href = result.line_official_url;
                            // リダイレクト成功した場合はタイムアウトをクリア
                            clearTimeout(redirectTimeout);
                        } catch (error) {
                            console.error('❌ リダイレクトエラー:', error);
                            clearTimeout(redirectTimeout);
                            this.registerError = 'LINE友達追加ページへの遷移に失敗しました。下記URLを手動で開いてください:\n' + result.line_official_url;
                            this.loading = false;
                        }
                        return;
                    }

                    // セッションストレージをクリア
                    sessionStorage.removeItem('lineAuthState');
                    sessionStorage.removeItem('lineAuthToken');

                    // 成功メッセージを表示（代理店コードを保存）
                    this.pendingRegistrationData = {
                        agency_code: result.agency?.code || localStorage.getItem('agencyCode') || 'AG...'
                    };
                    this.registerSuccess = true;
                    this.registerError = '';

                    // URLをクリーンアップ
                    window.history.replaceState({}, document.title, window.location.pathname);

                    // 3秒後にログイン画面に移動
                    setTimeout(() => {
                        this.showRegister = false;
                        this.registerSuccess = false;
                        this.pendingRegistrationData = null;
                        this.loading = false;
                        this.isAuthenticated = false;
                    }, 3000);
                } else {
                    console.error('❌ Registration completion failed:', result.error);
                    this.registerError = result.error || 'LINE連携に失敗しました。最初から登録をやり直してください。';
                    this.isAuthenticated = false;

                    // セッションストレージをクリア
                    sessionStorage.removeItem('lineAuthState');
                    sessionStorage.removeItem('lineAuthToken');

                    // URLをクリーンアップ
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (error) {
                console.error('❌ Error handling LINE callback:', error);
                this.registerError = 'LINE連携処理中にエラーが発生しました。最初から登録をやり直してください。';
                this.isAuthenticated = false;

                // セッションストレージをクリア
                sessionStorage.removeItem('lineAuthState');
                sessionStorage.removeItem('lineAuthToken');

                // URLをクリーンアップ
                window.history.replaceState({}, document.title, window.location.pathname);
            } finally {
                this.loading = false;
            }
        },

        async loadDashboardData() {
            console.log('📊 loadDashboardData() started');
            try {
                console.log('📥 Loading stats and tracking links in parallel...');
                await Promise.all([
                    this.loadStats(),
                    this.loadTrackingLinks()
                ]);
                console.log('✅ loadDashboardData() completed successfully');
            } catch (error) {
                console.error('❌ Error loading dashboard data:', error);
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack
                });
                throw error; // Re-throw to be caught by init()
            }
        },

        async loadStats() {
            console.log('📈 loadStats() started');
            try {
                const response = await fetch(`/.netlify/functions/agency-stats`, {
                    credentials: 'include',  // Cookie認証
                    headers: {
                        // Cookie優先、LocalStorageはフォールバック
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken') || ''}`,
                        'X-Agency-Id': localStorage.getItem('agencyId') || ''
                    }
                });

                console.log('📈 Stats response status:', response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log('📈 Stats data received:', data);
                    this.stats = {
                        ...this.stats,
                        ...data
                    };
                    console.log('✅ loadStats() completed');
                } else {
                    const errorText = await response.text();
                    console.error('❌ Stats response not OK:', response.status, errorText);
                    throw new Error(`Stats API returned ${response.status}: ${errorText}`);
                }
            } catch (error) {
                console.error('❌ Error loading stats:', error);
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack
                });
                throw error;
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
                        utm_content: ''
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
                utm_content: ''
            };
            this.createdLink = '';
        },

        async loadTrackingLinks() {
            console.log('🔗 loadTrackingLinks() started');
            try {
                const response = await fetch('/.netlify/functions/agency-links', {
                    credentials: 'include',  // Cookie認証
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                console.log('🔗 Links response status:', response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log('🔗 Links data received:', data);
                    this.trackingLinks = data.links || [];
                    console.log('✅ loadTrackingLinks() completed, loaded', this.trackingLinks.length, 'links');
                } else {
                    const errorText = await response.text();
                    console.error('❌ Links response not OK:', response.status, errorText);
                    throw new Error(`Links API returned ${response.status}: ${errorText}`);
                }
            } catch (error) {
                console.error('❌ Error loading links:', error);
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack
                });
                throw error;
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

                    // Update stats from commission summary
                    if (data.summary) {
                        this.stats.monthlyCommission = data.summary.currentMonth || 0;
                        // Note: lastMonthCommission and totalCommission are updated by loadStats()
                    }
                }
            } catch (error) {
                console.error('Error loading commissions:', error);
            }
        },

        async loadBillingStats() {
            try {
                const response = await fetch('/.netlify/functions/agency-billing-stats', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.billingStats = data;
                    console.log('Billing stats loaded:', data);
                } else {
                    console.error('Error loading billing stats:', await response.text());
                }
            } catch (error) {
                console.error('Error loading billing stats:', error);
            }
        },

        startBillingStatsAutoRefresh() {
            // 初回ロード
            this.loadBillingStats();
            this.loadReferralUsers();

            // 30秒ごとに自動更新（課金状況タブを開いている場合のみ）
            this.billingStatsInterval = setInterval(() => {
                if (this.activeTab === 'billing' && this.isAuthenticated) {
                    this.loadBillingStats();
                    this.loadReferralUsers();
                }
            }, 30000); // 30秒
        },

        stopBillingStatsAutoRefresh() {
            if (this.billingStatsInterval) {
                clearInterval(this.billingStatsInterval);
                this.billingStatsInterval = null;
            }
        },

        async loadReferralUsers() {
            try {
                const response = await fetch('/.netlify/functions/agency-referral-users', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.referralUsers = data.referralUsers || [];
                    this.referralSummary = data.summary || {
                        totalUsers: 0,
                        activeSubscriptions: 0,
                        totalReferralCommission: 0
                    };
                    console.log('Referral users loaded:', data);
                } else {
                    console.error('Error loading referral users:', await response.text());
                }
            } catch (error) {
                console.error('Error loading referral users:', error);
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

        async copyToClipboard(text, event) {
            try {
                // モダンブラウザのClipboard API
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    // フォールバック: 古いブラウザ対応
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();

                    try {
                        const successful = document.execCommand('copy');
                        if (!successful) {
                            throw new Error('execCommand failed');
                        }
                    } finally {
                        document.body.removeChild(textArea);
                    }
                }

                // Show temporary success message
                const button = event.target.closest('button');
                if (button) {
                    const originalHTML = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check"></i> コピー済み！';
                    button.classList.remove('bg-emerald-100', 'hover:bg-emerald-200', 'bg-emerald-600', 'hover:bg-emerald-700');
                    button.classList.add('bg-green-100');

                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                        button.classList.remove('bg-green-100');
                        button.classList.add('bg-emerald-100', 'hover:bg-emerald-200');
                    }, 2000);
                } else {
                    alert('クリップボードにコピーしました！');
                }
            } catch (error) {
                console.error('Failed to copy:', error);
                alert('コピーに失敗しました。\nエラー: ' + error.message);
            }
        },

        getTrackingUrl(code) {
            return `https://taskmateai.net/t/${code}`;
        },

        formatDate(dateString) {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        },

        formatDateTime(dateString) {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },

        getSubscriptionStatusLabel(status) {
            const labels = {
                'active': '課金中',
                'trialing': 'トライアル中',
                'past_due': '支払い期限切れ',
                'canceled': 'キャンセル済み',
                'incomplete': '未完了',
                'incomplete_expired': '期限切れ',
                'unpaid': '未払い',
                'free': '無料プラン'
            };
            return labels[status] || '不明';
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

        async viewLinkDetails(link) {
            console.log('📊 Opening link details for:', link);
            console.log('📊 Before change - linkDetailsModal:', this.linkDetailsModal);

            this.selectedLink = link;
            this.linkDetailsModal = true;
            this.loadingVisits = true;

            console.log('📊 After change - linkDetailsModal:', this.linkDetailsModal);
            console.log('📊 selectedLink:', this.selectedLink);

            try {
                console.log('📊 Calling loadLinkVisits with id:', link.id);
                await this.loadLinkVisits(link.id);
                console.log('📊 loadLinkVisits completed successfully');
            } catch (error) {
                console.error('❌ Error loading link visits:', error);
                console.error('❌ Error stack:', error.stack);
                alert('訪問履歴の読み込みに失敗しました: ' + error.message);
            } finally {
                this.loadingVisits = false;
                console.log('📊 Final state - linkDetailsModal:', this.linkDetailsModal);
            }
        },

        closeLinkDetailsModal() {
            this.linkDetailsModal = false;
            this.selectedLink = null;
            this.linkVisits = [];
            this.loadingVisits = false;
        },

        async loadLinkVisits(linkId) {
            console.log('📈 Loading visits for link ID:', linkId);

            try {
                const response = await fetch(`/.netlify/functions/agency-link-visits?link_id=${linkId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.linkVisits = data.visits || [];
                    console.log('✅ Loaded', this.linkVisits.length, 'visits');
                } else {
                    console.error('Failed to load visits:', await response.text());
                    this.linkVisits = [];
                }
            } catch (error) {
                console.error('Error loading link visits:', error);
                this.linkVisits = [];
            }
        },

        calculateCVR() {
            if (!this.selectedLink) return '0.00';

            const visits = this.selectedLink.visit_count || 0;
            const conversions = this.selectedLink.conversion_count || 0;

            if (visits === 0) return '0.00';

            return ((conversions / visits) * 100).toFixed(2);
        },

        calculateCommission() {
            if (!this.selectedLink) return '0';

            const conversions = this.selectedLink.conversion_count || 0;
            const commissionRate = this.agencyInfo.own_commission_rate || 20;
            // Premium: 10,000円/月, Professional: 50,000円/月（最低プランで概算）
            const baseMonthlyFee = 10000;

            const totalCommission = conversions * baseMonthlyFee * (commissionRate / 100);

            return totalCommission.toLocaleString('ja-JP');
        },

        async toggleLinkStatus(link) {
            if (!link) return;

            const newStatus = !link.is_active;
            const action = newStatus ? '有効化' : '無効化';

            if (!confirm(`「${link.name}」を${action}してもよろしいですか？`)) {
                return;
            }

            this.loading = true;

            try {
                const response = await fetch('/.netlify/functions/agency-toggle-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    },
                    body: JSON.stringify({
                        link_id: link.id,
                        is_active: newStatus
                    })
                });

                if (response.ok) {
                    // Update local state
                    link.is_active = newStatus;
                    this.selectedLink.is_active = newStatus;

                    // Refresh tracking links
                    await this.loadTrackingLinks();
                    await this.loadStats();

                    alert(`リンクを${action}しました`);
                } else {
                    const error = await response.json();
                    alert(`${action}に失敗しました: ` + (error.message || '不明なエラー'));
                }
            } catch (error) {
                console.error('Error toggling link status:', error);
                alert(`${action}処理中にエラーが発生しました`);
            } finally {
                this.loading = false;
            }
        },

        async deleteLinkWithConfirm(link) {
            if (!link) return;

            const confirmed = confirm(
                `「${link.name}」を削除してもよろしいですか？\n\n` +
                `この操作は取り消せません。\n` +
                `トラッキングコード: ${link.tracking_code}\n` +
                `クリック数: ${link.visit_count || 0}`
            );

            if (!confirmed) return;

            this.loading = true;

            try {
                const response = await fetch('/.netlify/functions/agency-delete-link', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    },
                    body: JSON.stringify({
                        link_id: link.id
                    })
                });

                if (response.ok) {
                    alert('リンクを削除しました');

                    // Close modal
                    this.closeLinkDetailsModal();

                    // Refresh data
                    await this.loadTrackingLinks();
                    await this.loadStats();
                } else {
                    const error = await response.json();
                    alert('削除に失敗しました: ' + (error.message || '不明なエラー'));
                }
            } catch (error) {
                console.error('Error deleting link:', error);
                alert('削除処理中にエラーが発生しました');
            } finally {
                this.loading = false;
            }
        },

        initPerformanceChart() {
            // Destroy existing chart instance
            if (this.performanceChart) {
                this.performanceChart.destroy();
            }

            // Get canvas element
            const canvas = document.getElementById('performanceChart');
            if (!canvas) {
                console.error('Canvas element #performanceChart not found');
                return;
            }

            // Ensure Chart.js is loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded');
                return;
            }

            // Prepare data
            const labels = this.analytics.map(a => {
                const date = new Date(a.date);
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            const visitData = this.analytics.map(a => a.visits);
            const conversionData = this.analytics.map(a => a.conversions);

            // Create chart
            this.performanceChart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'クリック数',
                            data: visitData,
                            borderColor: 'rgb(16, 185, 129)', // emerald-600
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'コンバージョン数',
                            data: conversionData,
                            borderColor: 'rgb(59, 130, 246)', // blue-500
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: {
                                size: 13
                            },
                            bodyFont: {
                                size: 12
                            },
                            padding: 10,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y;
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0,
                                font: {
                                    size: 11
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 0,
                                font: {
                                    size: 10
                                }
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });

            console.log('✅ Performance chart initialized with', this.analytics.length, 'data points');
        },

        openChangePasswordModal() {
            this.changePasswordModal = true;
            this.changePasswordForm = {
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            };
            this.changePasswordError = '';
            this.changePasswordSuccess = false;
            this.showCurrentPassword = false;
            this.showNewPassword = false;
            this.showConfirmPassword = false;
            this.passwordStrength = 'weak';
            this.passwordStrengthLabel = '弱い';
        },

        closeChangePasswordModal() {
            this.changePasswordModal = false;
            this.changePasswordForm = {
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            };
            this.changePasswordError = '';
            this.changePasswordSuccess = false;
        },

        // パスワード強度を計算（共通関数）
        calculatePasswordStrength(password) {
            if (!password || password.length === 0) {
                return 'weak';
            }

            let strength = 0;

            // 長さチェック
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;

            // 文字種チェック
            if (/[a-z]/.test(password)) strength++; // 小文字
            if (/[A-Z]/.test(password)) strength++; // 大文字
            if (/\d/.test(password)) strength++;    // 数字
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++; // 記号

            if (strength <= 2) {
                return 'weak';
            } else if (strength <= 4) {
                return 'medium';
            } else if (strength <= 5) {
                return 'strong';
            } else {
                return 'very-strong';
            }
        },

        checkPasswordStrength() {
            const password = this.changePasswordForm.newPassword;
            const strength = this.calculatePasswordStrength(password);

            this.passwordStrength = strength;

            const labels = {
                'weak': '弱い',
                'medium': '普通',
                'strong': '強い',
                'very-strong': '非常に強い'
            };

            this.passwordStrengthLabel = labels[strength] || '弱い';
        },

        async changePassword() {
            this.loading = true;
            this.changePasswordError = '';
            this.changePasswordSuccess = false;

            try {
                // バリデーション
                if (this.changePasswordForm.newPassword !== this.changePasswordForm.confirmPassword) {
                    this.changePasswordError = '新しいパスワードが一致しません';
                    this.loading = false;
                    return;
                }

                if (this.changePasswordForm.newPassword.length < 8) {
                    this.changePasswordError = 'パスワードは8文字以上で入力してください';
                    this.loading = false;
                    return;
                }

                if (this.changePasswordForm.currentPassword === this.changePasswordForm.newPassword) {
                    this.changePasswordError = '新しいパスワードは現在のパスワードと異なる必要があります';
                    this.loading = false;
                    return;
                }

                // パスワード強度チェック（強制）
                if (this.passwordStrength === 'weak') {
                    this.changePasswordError = 'パスワードが弱すぎます。「普通」以上の強度が必要です';
                    this.loading = false;
                    return;
                }

                // API呼び出し
                const response = await fetch('/.netlify/functions/agency-change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    },
                    body: JSON.stringify({
                        currentPassword: this.changePasswordForm.currentPassword,
                        newPassword: this.changePasswordForm.newPassword,
                        confirmPassword: this.changePasswordForm.confirmPassword
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    this.changePasswordSuccess = true;
                    this.changePasswordError = '';

                    // 3秒後にモーダルを閉じる
                    setTimeout(() => {
                        this.closeChangePasswordModal();
                    }, 3000);
                } else {
                    this.changePasswordError = result.error || 'パスワード変更に失敗しました';
                }
            } catch (error) {
                console.error('Password change error:', error);
                this.changePasswordError = 'パスワード変更処理中にエラーが発生しました';
            } finally {
                this.loading = false;
            }
        },

        // 4段階代理店制度 - 階層情報を読み込む
        async loadReferralInfo() {
            try {
                const response = await fetch('/.netlify/functions/agency-referral-info', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                const data = await response.json();
                this.referralInfo = data;
            } catch (error) {
                console.error('Error loading referral info:', error);
                this.referralInfo = {
                    childAgencies: [],
                    totalChildren: 0,
                    hierarchyChain: []
                };
                // 404エラーは正常（APIがまだ実装されていない場合）
                if (!error.message.includes('404')) {
                    console.warn('階層情報の読み込みに失敗しました:', error.message);
                }
            }
        },

        // 4段階代理店制度 - コミッション履歴を読み込む
        async loadCommissionHistory() {
            this.loadingCommissions = true;
            try {
                // TODO: Future feature - Commission distribution history
                // This will show detailed breakdown of commissions including:
                // - commission_type: 'own' vs 'referral'
                // - deal_amount: Total deal value
                // - closing_agency_name: Name of agency that closed the deal
                // - referral hierarchy (4-tier system)
                //
                // For now, this feature is not implemented.
                // The API endpoint would be: /.netlify/functions/agency-commission-details

                this.commissionHistory = [];

                /* Future implementation:
                const response = await fetch('/.netlify/functions/agency-commission-details', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agencyAuthToken')}`,
                        'X-Agency-Id': localStorage.getItem('agencyId')
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.commissionHistory = data.commissionDetails || [];
                }
                */
            } catch (error) {
                console.error('Error loading commission history:', error);
                this.commissionHistory = [];
                if (!error.message.includes('404')) {
                    console.warn('コミッション履歴の読み込みに失敗しました:', error.message);
                }
            } finally {
                this.loadingCommissions = false;
            }
        },

        // 4段階代理店制度 - 階層ラベルを取得
        getLevelLabel(level) {
            const labels = {
                1: '統括代理店',
                2: '正規代理店',
                3: '販売代理店',
                4: '営業代理店'
            };
            return labels[level] || '代理店';
        },

        // 4段階代理店制度 - コミッション種別ラベル
        getCommissionTypeLabel(type) {
            const labels = {
                'own': '自己報酬',
                'referral': 'リファラル報酬'
            };
            return labels[type] || type;
        },

        // 4段階代理店制度 - リファラルコミッション率を取得
        getReferralRate() {
            return 2.00; // 固定2%
        }
    };
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ TaskMate AI Agency Dashboard loaded');
    console.log('🔍 Checking if agencyDashboard is defined:', typeof window.agencyDashboard);
    console.log('🔍 Checking if Alpine is loaded:', typeof window.Alpine);
});

// Make agencyDashboard globally accessible
window.agencyDashboard = agencyDashboard;
console.log('✅ dashboard.js loaded, agencyDashboard registered globally');