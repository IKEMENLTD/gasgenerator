/**
 * Deadline Alert System - Configuration
 */

const CONFIG = {
    // Google Apps Script Web App URL
    // デプロイ後にこのURLを更新してください
    API_URL: 'https://script.google.com/macros/s/AKfycbzO_aOtWS8cJjogiQkFHiJw1-c4SPC4guwyhqjCBv6TYdGKFzf9qfDW24U0vKxoAfjkMQ/exec',

    // ステータスオプション
    STATUS_OPTIONS: [
        { value: '進行中', label: '進行中', color: 'primary' },
        { value: '確認待ち', label: '確認待ち', color: 'warning' },
        { value: '完了', label: '完了', color: 'success' },
        { value: '納品済', label: '納品済', color: 'info' }
    ],

    // 優先度オプション
    PRIORITY_OPTIONS: [
        { value: '高', label: '高', color: 'danger' },
        { value: '中', label: '中', color: 'warning' },
        { value: '低', label: '低', color: 'success' }
    ],

    // アラートタイミング（日数）
    ALERT_DAYS: [7, 3, 1, 0, -1],

    // 日付フォーマット
    formatDate: function(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    },

    // 残り日数を計算
    getDaysRemaining: function(deadlineString) {
        if (!deadlineString) return null;
        const deadline = new Date(deadlineString);
        deadline.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    // 残り日数のラベルを取得
    getDaysRemainingLabel: function(days) {
        if (days === null) return '-';
        if (days < 0) return `${Math.abs(days)}日超過`;
        if (days === 0) return '本日';
        return `残り${days}日`;
    },

    // 残り日数に応じたクラスを取得
    getDaysRemainingClass: function(days) {
        if (days === null) return '';
        if (days < 0) return 'deadline-overdue';
        if (days <= 3) return 'deadline-urgent';
        return 'deadline-normal';
    },

    // ステータスのバッジクラスを取得
    getStatusBadgeClass: function(status) {
        const option = this.STATUS_OPTIONS.find(opt => opt.value === status);
        return option ? `badge-${option.color}` : 'badge-primary';
    },

    // 優先度のクラスを取得
    getPriorityClass: function(priority) {
        const option = this.PRIORITY_OPTIONS.find(opt => opt.value === priority);
        if (!option) return '';
        return `priority-${option.color === 'danger' ? 'high' : option.color === 'warning' ? 'medium' : 'low'}`;
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG.STATUS_OPTIONS);
Object.freeze(CONFIG.PRIORITY_OPTIONS);
Object.freeze(CONFIG.ALERT_DAYS);
