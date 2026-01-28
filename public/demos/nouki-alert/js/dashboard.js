/**
 * Dashboard Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
    await loadDashboard();
});

/**
 * Load all dashboard data
 */
async function loadDashboard() {
    try {
        const data = await API.getDashboard();

        // Update statistics
        updateStats(data.stats);

        // Update urgent/overdue list
        renderUrgentList(data.urgentProjects);

        // Update weekly list
        renderWeeklyList(data.weeklyProjects);

        // Update recent projects table
        renderRecentTable(data.recentProjects);

    } catch (error) {
        console.error('Dashboard load error:', error);
        Toast.error('データの読み込みに失敗しました');

        // Show demo data for testing without API
        loadDemoData();
    }
}

/**
 * Update statistics cards
 */
function updateStats(stats) {
    document.getElementById('statTotal').textContent = stats.activeCount || 0;
    document.getElementById('statOverdue').textContent = stats.overdueCount || 0;
    document.getElementById('statUrgent').textContent = stats.weeklyCount || 0;
    document.getElementById('statCompleted').textContent = stats.completedCount || 0;
}

/**
 * Render urgent/overdue projects list
 */
function renderUrgentList(projects) {
    const container = document.getElementById('urgentList');

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <p class="empty-text">緊急案件はありません</p>
            </div>
        `;
        return;
    }

    const html = `
        <ul class="alert-list">
            ${projects.map(project => {
                const days = CONFIG.getDaysRemaining(project.deadline);
                const isOverdue = days < 0;
                const alertClass = isOverdue ? 'urgent' : 'warning';
                const icon = isOverdue ? '🚨' : '⚠️';

                return `
                    <li class="alert-item ${alertClass}">
                        <span class="alert-icon">${icon}</span>
                        <div class="alert-content">
                            <div class="alert-title">${escapeHtml(project.name)}</div>
                            <div class="alert-meta">
                                ${escapeHtml(project.client)} / ${escapeHtml(project.staff)} /
                                納期: ${CONFIG.formatDate(project.deadline)}
                            </div>
                        </div>
                        <span class="badge ${isOverdue ? 'badge-danger' : 'badge-warning'}">
                            ${CONFIG.getDaysRemainingLabel(days)}
                        </span>
                    </li>
                `;
            }).join('')}
        </ul>
    `;

    container.innerHTML = html;
}

/**
 * Render weekly deadline list
 */
function renderWeeklyList(projects) {
    const container = document.getElementById('weeklyList');

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <p class="empty-text">今週納期の案件はありません</p>
            </div>
        `;
        return;
    }

    const html = `
        <ul class="alert-list">
            ${projects.map(project => {
                const days = CONFIG.getDaysRemaining(project.deadline);
                const isToday = days === 0;
                const alertClass = isToday ? 'warning' : 'info';
                const icon = isToday ? '📌' : '📋';

                return `
                    <li class="alert-item ${alertClass}">
                        <span class="alert-icon">${icon}</span>
                        <div class="alert-content">
                            <div class="alert-title">${escapeHtml(project.name)}</div>
                            <div class="alert-meta">
                                ${escapeHtml(project.client)} / ${escapeHtml(project.staff)}
                            </div>
                        </div>
                        <span class="badge ${isToday ? 'badge-warning' : 'badge-info'}">
                            ${CONFIG.getDaysRemainingLabel(days)}
                        </span>
                    </li>
                `;
            }).join('')}
        </ul>
    `;

    container.innerHTML = html;
}

/**
 * Render recent projects table
 */
function renderRecentTable(projects) {
    const container = document.getElementById('recentTable');

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <p class="empty-text">案件がありません</p>
            </div>
        `;
        return;
    }

    const html = `
        <table class="soft-table">
            <thead>
                <tr>
                    <th>案件名</th>
                    <th>クライアント</th>
                    <th>担当者</th>
                    <th>納期</th>
                    <th>残り日数</th>
                    <th>ステータス</th>
                    <th>優先度</th>
                </tr>
            </thead>
            <tbody>
                ${projects.map(project => {
                    const days = CONFIG.getDaysRemaining(project.deadline);
                    const daysClass = CONFIG.getDaysRemainingClass(days);
                    const statusClass = CONFIG.getStatusBadgeClass(project.status);
                    const priorityClass = CONFIG.getPriorityClass(project.priority);

                    return `
                        <tr>
                            <td><strong>${escapeHtml(project.name)}</strong></td>
                            <td>${escapeHtml(project.client)}</td>
                            <td>${escapeHtml(project.staff)}</td>
                            <td>${CONFIG.formatDate(project.deadline)}</td>
                            <td class="${daysClass}">${CONFIG.getDaysRemainingLabel(days)}</td>
                            <td><span class="badge ${statusClass}">${escapeHtml(project.status)}</span></td>
                            <td class="${priorityClass}">${escapeHtml(project.priority)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

/**
 * Load demo data when API is not available
 */
function loadDemoData() {
    const demoStats = {
        activeCount: 12,
        overdueCount: 2,
        weeklyCount: 5,
        completedCount: 8
    };

    const today = new Date();
    const demoProjects = [
        {
            id: '1',
            name: 'Webサイトリニューアル',
            client: '株式会社ABC',
            staff: '田中太郎',
            deadline: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: '進行中',
            priority: '高'
        },
        {
            id: '2',
            name: 'ロゴデザイン制作',
            client: 'DEF商事',
            staff: '鈴木花子',
            deadline: today.toISOString().split('T')[0],
            status: '確認待ち',
            priority: '高'
        },
        {
            id: '3',
            name: '動画編集案件',
            client: 'GHI株式会社',
            staff: '佐藤次郎',
            deadline: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: '進行中',
            priority: '中'
        },
        {
            id: '4',
            name: 'パンフレット制作',
            client: 'JKL出版',
            staff: '田中太郎',
            deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: '進行中',
            priority: '低'
        },
        {
            id: '5',
            name: 'SNS広告バナー',
            client: 'MNO広告',
            staff: '鈴木花子',
            deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: '進行中',
            priority: '中'
        }
    ];

    // Update stats
    updateStats(demoStats);

    // Filter urgent projects (overdue or within 3 days)
    const urgentProjects = demoProjects.filter(p => {
        const days = CONFIG.getDaysRemaining(p.deadline);
        return days <= 3;
    });
    renderUrgentList(urgentProjects);

    // Filter weekly projects (within 7 days, not overdue)
    const weeklyProjects = demoProjects.filter(p => {
        const days = CONFIG.getDaysRemaining(p.deadline);
        return days >= 0 && days <= 7;
    });
    renderWeeklyList(weeklyProjects);

    // Show all as recent
    renderRecentTable(demoProjects);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
