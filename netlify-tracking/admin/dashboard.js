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
            utm_campaign: '',
            line_friend_url: ''
        },
        createdLink: '',

        // Data
        trackingLinks: [],
        visits: [],
        lineUsers: [],

        // Configuration
        config: {
            supabaseUrl: 'https://your-project.supabase.co',
            supabaseKey: 'your-anon-key',
            adminCredentials: {
                username: 'admin',
                password: 'TaskMate2024Admin!'
            }
        },

        async init() {
            // Check for existing authentication
            const authToken = localStorage.getItem('trackingAdminAuth');
            if (authToken) {
                this.isAuthenticated = true;
                await this.loadDashboardData();
            }
        },

        async login() {
            this.loading = true;
            this.loginError = '';

            try {
                // Simple credential check (in production, use proper authentication)
                if (
                    this.loginForm.username === this.config.adminCredentials.username &&
                    this.loginForm.password === this.config.adminCredentials.password
                ) {
                    this.isAuthenticated = true;
                    localStorage.setItem('trackingAdminAuth', 'authenticated');
                    await this.loadDashboardData();
                } else {
                    this.loginError = 'Invalid credentials';
                }
            } catch (error) {
                this.loginError = 'Login failed: ' + error.message;
            } finally {
                this.loading = false;
            }
        },

        logout() {
            this.isAuthenticated = false;
            localStorage.removeItem('trackingAdminAuth');
            this.loginForm = { username: '', password: '' };
            this.loginError = '';
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
                        utm_campaign: '',
                        line_friend_url: ''
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

        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);

                // Show temporary success message
                const button = event.target;
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                button.classList.remove('bg-blue-100', 'hover:bg-blue-200', 'text-blue-600');
                button.classList.add('bg-green-100', 'text-green-600');

                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('bg-green-100', 'text-green-600');
                    button.classList.add('bg-blue-100', 'hover:bg-blue-200', 'text-blue-600');
                }, 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
                alert('Failed to copy to clipboard');
            }
        }
    };
}

// Utility functions
function generateTrackingCode() {
    return Math.random().toString(36).substring(2, 8) +
           Math.random().toString(36).substring(2, 8);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('TaskMate AI Tracking Dashboard loaded');
});