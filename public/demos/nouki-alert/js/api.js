/**
 * Deadline Alert System - DEMO Mock API
 * サンプルデータを返すデモ版
 */

// サンプルデータ
const MOCK_DATA = {
    projects: [
        {
            id: 'P001',
            projectName: 'ABCコーポレーション ホームページ制作',
            clientName: 'ABCコーポレーション',
            deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2日超過
            status: '進行中',
            priority: '高',
            staff: '田中太郎',
            description: 'コーポレートサイトのフルリニューアル'
        },
        {
            id: 'P002',
            projectName: 'XYZ株式会社 ECサイト構築',
            clientName: 'XYZ株式会社',
            deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 明日
            status: '確認待ち',
            priority: '高',
            staff: '鈴木花子',
            description: 'Shopifyを使ったECサイト構築'
        },
        {
            id: 'P003',
            projectName: 'DEF商事 LP制作',
            clientName: 'DEF商事',
            deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3日後
            status: '進行中',
            priority: '中',
            staff: '田中太郎',
            description: '新商品プロモーション用LP'
        },
        {
            id: 'P004',
            projectName: 'GHIクリニック 予約システム',
            clientName: 'GHIクリニック',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1週間後
            status: '進行中',
            priority: '中',
            staff: '佐藤次郎',
            description: 'オンライン予約システムの開発'
        },
        {
            id: 'P005',
            projectName: 'JKL不動産 物件検索機能',
            clientName: 'JKL不動産',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2週間後
            status: '進行中',
            priority: '低',
            staff: '鈴木花子',
            description: '物件検索機能の追加開発'
        },
        {
            id: 'P006',
            projectName: 'MNO食品 採用サイト',
            clientName: 'MNO食品',
            deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5日超過
            status: '進行中',
            priority: '高',
            staff: '佐藤次郎',
            description: '採用特設サイトの制作'
        }
    ],
    staff: [
        { id: 'S001', name: '田中太郎', email: 'tanaka@example.com', role: 'ディレクター' },
        { id: 'S002', name: '鈴木花子', email: 'suzuki@example.com', role: 'デザイナー' },
        { id: 'S003', name: '佐藤次郎', email: 'sato@example.com', role: 'エンジニア' }
    ]
};

const API = {
    async request(action, data) {
        // デモ用：少し遅延を入れてリアルな動作を再現
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true };
    },

    async getProjects(filter) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { data: MOCK_DATA.projects };
    },

    async getProject(id) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const project = MOCK_DATA.projects.find(p => p.id === id);
        return { data: project };
    },

    async createProject(project) {
        await new Promise(resolve => setTimeout(resolve, 500));
        Toast.success('【デモ】案件を登録しました（実際には保存されません）');
        return { success: true, id: 'DEMO_' + Date.now() };
    },

    async updateProject(id, updates) {
        await new Promise(resolve => setTimeout(resolve, 500));
        Toast.success('【デモ】案件を更新しました（実際には保存されません）');
        return { success: true };
    },

    async deleteProject(id) {
        await new Promise(resolve => setTimeout(resolve, 500));
        Toast.success('【デモ】案件を削除しました（実際には保存されません）');
        return { success: true };
    },

    async updateStatus(id, status) {
        await new Promise(resolve => setTimeout(resolve, 300));
        Toast.success('【デモ】ステータスを更新しました（実際には保存されません）');
        return { success: true };
    },

    async getStaff() {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { data: MOCK_DATA.staff };
    },

    async createStaff(staff) {
        await new Promise(resolve => setTimeout(resolve, 500));
        Toast.success('【デモ】担当者を登録しました（実際には保存されません）');
        return { success: true, id: 'DEMO_S_' + Date.now() };
    },

    async updateStaff(id, updates) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
    },

    async deleteStaff(id) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
    },

    async getDashboard() {
        await new Promise(resolve => setTimeout(resolve, 500));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekLater = new Date(today);
        weekLater.setDate(weekLater.getDate() + 7);

        const activeProjects = MOCK_DATA.projects.filter(p => p.status !== '完了' && p.status !== '納品済');
        const overdueProjects = activeProjects.filter(p => new Date(p.deadline) < today);
        const urgentProjects = activeProjects.filter(p => {
            const deadline = new Date(p.deadline);
            return deadline >= today && deadline <= weekLater;
        });

        return {
            stats: {
                total: activeProjects.length,
                overdue: overdueProjects.length,
                urgent: urgentProjects.length,
                completed: 3 // 今月完了数（サンプル）
            },
            overdueProjects: overdueProjects,
            urgentProjects: urgentProjects.concat(overdueProjects).slice(0, 5)
        };
    },

    async getAlertSettings() {
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
            data: {
                emailEnabled: true,
                slackEnabled: false,
                alertDays: [7, 3, 1, 0]
            }
        };
    },

    async updateAlertSettings(settings) {
        await new Promise(resolve => setTimeout(resolve, 500));
        Toast.success('【デモ】設定を保存しました（実際には保存されません）');
        return { success: true };
    }
};

// Toast通知
var Toast = {
    container: null,

    init: function() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show: function(message, type, duration) {
        type = type || 'success';
        duration = duration || 3000;
        this.init();

        var toast = document.createElement('div');
        toast.className = 'toast ' + type;

        var icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '!';
        toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-message">' + message + '</span>';

        this.container.appendChild(toast);

        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(function() { toast.remove(); }, 300);
        }, duration);
    },

    success: function(message) { this.show(message, 'success'); },
    error: function(message) { this.show(message, 'error'); },
    warning: function(message) { this.show(message, 'warning'); }
};

// Loading表示
var Loading = {
    show: function(container) {
        var html = '<div class="loading-state" style="text-align:center;padding:40px;"><div class="loading-spinner"></div><p style="margin-top:15px;color:var(--text-light);">読み込み中...</p></div>';
        if (typeof container === 'string') {
            document.querySelector(container).innerHTML = html;
        } else {
            container.innerHTML = html;
        }
    },
    hide: function(container) {
        var el = typeof container === 'string'
            ? document.querySelector(container + ' .loading-state')
            : container.querySelector('.loading-state');
        if (el) el.remove();
    }
};

// 空状態表示
var EmptyState = {
    show: function(container, message, icon) {
        message = message || 'データがありません';
        icon = icon || '📋';
        var html = '<div class="empty-state"><div class="empty-icon">' + icon + '</div><p class="empty-text">' + message + '</p></div>';
        if (typeof container === 'string') {
            document.querySelector(container).innerHTML = html;
        } else {
            container.innerHTML = html;
        }
    }
};
