// UI交互模块

// DOM元素
let loading, repoList, reportInfo, darkModeToggle;

// 初始化UI模块
export function initUI() {
    // 获取DOM元素
    loading = document.getElementById('loading');
    repoList = document.getElementById('repo-list');
    reportInfo = document.getElementById('report-info');
    darkModeToggle = document.getElementById('dark-mode-toggle');
    
    console.log('darkModeToggle:', darkModeToggle);
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // 检查夜间模式偏好
    checkDarkModePreference();
}

// 显示加载指示器
export function showLoading() {
    if (loading) {
        loading.style.display = 'block';
    }
    if (repoList) {
        repoList.innerHTML = '';
    }
}

// 隐藏加载指示器
export function hideLoading() {
    if (loading) {
        loading.style.display = 'none';
    }
}

// 显示报告信息
export function showReportInfo(metadata) {
    if (reportInfo) {
        reportInfo.innerHTML = `
            <strong>报告标题：</strong> ${metadata.report_title} <br>
            <strong>生成时间：</strong> ${metadata.generation_date} <br>
            <strong>项目总数：</strong> ${metadata.total_repositories} 个
        `;
    }
}

// 导出DOM元素供其他模块使用
export { repoList, reportInfo };

// Toast 工具函数
export function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    // 创建 toast 元素
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast fade`;
    toast.role = 'alert';
    toast.ariaLive = 'assertive';
    toast.ariaAtomic = 'true';

    // 根据类型设置不同的样式
    let bgColor, textColor, borderColor, iconClass;
    switch (type) {
        case 'success':
            bgColor = 'bg-success';
            textColor = 'text-white';
            borderColor = 'border-success';
            iconClass = 'fa-check-circle';
            break;
        case 'error':
            bgColor = 'bg-danger';
            textColor = 'text-white';
            borderColor = 'border-danger';
            iconClass = 'fa-exclamation-circle';
            break;
        case 'warning':
            bgColor = 'bg-warning';
            textColor = 'text-dark'; // 警告信息始终使用黑色文字，确保在任何模式下都清晰可见
            borderColor = 'border-warning';
            iconClass = 'fa-exclamation-triangle';
            break;
        case 'info':
        default:
            bgColor = 'bg-info';
            textColor = 'text-white';
            borderColor = 'border-info';
            iconClass = 'fa-info-circle';
            break;
    }
    
    // 检查当前是否为日间模式（通过检查body是否有dark类）
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    // 在日间模式下，确保所有提示都有黑色文字，以便在浅色背景下清晰可见
    if (!isDarkMode) {
        // 对于非警告类型的提示，在日间模式下使用黑色文字
        if (type !== 'warning') {
            textColor = 'text-dark';
        }
    }

    // 构建 toast HTML
    toast.innerHTML = `
        <div class="toast-header ${bgColor} ${textColor} ${borderColor}">
            <i class="fas ${iconClass} me-2"></i>
            <strong class="me-auto">提示</strong>
            <small class="text-muted">刚刚</small>
            <button type="button" class="btn-close ${textColor === 'text-white' ? 'btn-close-white' : ''}" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body ${textColor === 'text-white' ? 'text-white' : ''}">
            ${message}
        </div>
    `;

    // 添加到容器
    toastContainer.appendChild(toast);

    // 配置 Bootstrap Toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: duration
    });

    // 显示 toast
    bsToast.show();

    // 移除过期的 toast
    setTimeout(() => {
        toast.remove();
    }, duration + 500);
}

// Confirm Toast 工具函数
export function showConfirmToast(message, onConfirm, onCancel, duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    // 创建 confirm toast 元素
    const toastId = `confirm-toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast fade`;
    toast.role = 'alert';
    toast.ariaLive = 'assertive';
    toast.ariaAtomic = 'true';

    // 构建 confirm toast HTML
    toast.innerHTML = `
        <div class="toast-header bg-warning text-dark border-warning">
            <i class="fas fa-question-circle me-2"></i>
            <strong class="me-auto">确认</strong>
            <small class="text-muted">刚刚</small>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            <p class="mb-3">${message}</p>
            <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-sm btn-secondary" id="${toastId}-cancel">取消</button>
                <button type="button" class="btn btn-sm btn-primary" id="${toastId}-confirm">确认</button>
            </div>
        </div>
    `;

    // 添加到容器
    toastContainer.appendChild(toast);

    // 配置 Bootstrap Toast（不自动隐藏）
    const bsToast = new bootstrap.Toast(toast, {
        autohide: false
    });

    // 显示 toast
    bsToast.show();

    // 绑定按钮事件
    const confirmBtn = document.getElementById(`${toastId}-confirm`);
    const cancelBtn = document.getElementById(`${toastId}-cancel`);

    confirmBtn.addEventListener('click', () => {
        bsToast.hide();
        if (onConfirm) onConfirm();
        setTimeout(() => toast.remove(), 500);
    });

    cancelBtn.addEventListener('click', () => {
        bsToast.hide();
        if (onCancel) onCancel();
        setTimeout(() => toast.remove(), 500);
    });

    // 如果用户不操作，超时后自动取消
    setTimeout(() => {
        if (toast.isConnected) {
            bsToast.hide();
            setTimeout(() => toast.remove(), 500);
            if (onCancel) onCancel();
        }
    }, duration);
}

// 检查用户的夜间模式偏好
export function checkDarkModePreference() {
    console.log('检查夜间模式偏好...');
    const savedDarkMode = localStorage.getItem('dark-mode');
    console.log('savedDarkMode:', savedDarkMode);
    if (savedDarkMode === 'true' || (!savedDarkMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        console.log('启用夜间模式');
        enableDarkMode();
    }
}

// 切换夜间模式
export function toggleDarkMode() {
    if (document.body.classList.contains('dark-mode')) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
    
    // 重新渲染图表以更新颜色
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection && dashboardSection.style.display === 'block') {
        // 尝试重新获取统计数据以更新图表
        if (window.getStatistics) {
            window.getStatistics();
        }
    }
}

// 启用夜间模式
export function enableDarkMode() {
    document.body.classList.add('dark-mode');
    localStorage.setItem('dark-mode', 'true');
    if (darkModeToggle) {
        darkModeToggle.innerHTML = '<i class="fa fa-sun-o"></i>';
    }
}

// 禁用夜间模式
export function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('dark-mode', 'false');
    if (darkModeToggle) {
        darkModeToggle.innerHTML = '<i class="fa fa-moon-o"></i>';
    }
}

// 获取当前模式的文字颜色
export function getChartTextColor() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    return isDarkMode ? '#ffffff' : '#1e293b';
}

// 获取当前模式的网格线颜色
export function getChartGridColor() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    return isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
}

// 生成趋势徽章
export function getTrendBadge(trend) {
    if (!trend) return '';
    
    if (trend.is_new) {
        return '<span class="badge bg-success trend-badge"><i class="fa fa-star"></i> 新上榜</span>';
    } else {
        let badgeClass = 'bg-secondary';
        let icon = 'fa fa-minus';
        let text = '稳定';
        
        if (trend.status === 'rising') {
            badgeClass = 'bg-success';
            icon = 'fa fa-arrow-up';
            text = '上升';
        } else if (trend.status === 'falling') {
            badgeClass = 'bg-danger';
            icon = 'fa fa-arrow-down';
            text = '下降';
        } else if (trend.status === 'stable') {
            // 明确处理稳定状态
            badgeClass = 'bg-secondary';
            icon = 'fa fa-minus';
            text = '稳定';
        }
        
        return `<span class="badge ${badgeClass} trend-badge"><i class="fa ${icon}"></i> ${text}</span>`;
    }
}

// 获取语言对应的颜色
export function getLanguageColor(language) {
    const colors = {
        'JavaScript': '#f1e05a',
        'TypeScript': '#2b7489',
        'Python': '#3572A5',
        'Java': '#b07219',
        'C++': '#f34b7d',
        'C#': '#178600',
        'PHP': '#4F5D95',
        'Go': '#00ADD8',
        'Rust': '#dea584',
        'Swift': '#ffac45',
        'Kotlin': '#F18E33',
        'Ruby': '#701516',
        'Shell': '#89e051',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'SCSS': '#c6538c',
        'Vue': '#41b883',
        'React': '#61dafb',
        'Django': '#092e20',
        'Angular': '#dd0031'
    };
    return colors[language] || '#6e6e6e';
}
