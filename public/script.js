// DOM 元素
const loading = document.getElementById('loading');
const latestSection = document.getElementById('latest-section');
const aiInterpretBtn = document.getElementById('ai-interpret-btn');
const aiInterpretationDiv = document.getElementById('ai-interpretation');
const aiInterpretationContent = document.getElementById('ai-interpretation-content');
// AI解读模态框元素
const aiInterpretationModal = new bootstrap.Modal(document.getElementById('ai-interpretation-modal'));
const aiInterpretationModalContent = document.getElementById('ai-interpretation-modal-content');

// 存储当前显示的仓库数据
let currentRepositories = [];

// 智谱大模型配置
const ZHIPU_API_NAME = "glm-4.6v-flash";
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_API_KEY = "bd26af9692eba948a3d17f18c7f5c8ac.GkfrAPF60E9Md9xg";

// 调用智谱大模型进行文字解读
async function callZhipuModel(prompt, model = ZHIPU_API_NAME) {
    try {
        // 构建请求头
        const headers = {
            "Authorization": `Bearer ${ZHIPU_API_KEY}`,
            "Content-Type": "application/json"
        };
        
        // 构建请求数据
        const data = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一位专业的AI助手，擅长GitHub项目分析和技术趋势解读。请根据提供的GitHub热门项目标题和描述，进行功能分类，提供应用建议和趋势解读。分析需要专业、简洁、有洞察力。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": false  // 非流式响应
        };
        
        // 发送请求
        const response = await fetch(ZHIPU_API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        // 解析响应
        const result = await response.json();
        
        // 返回解读结果
        return result["choices"][0]["message"]["content"];
        
    } catch (error) {
        return `调用失败: ${error.message}`;
    }
}
// 管理员相关元素
const loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const adminLogoutItem = document.getElementById('admin-logout-item');
const adminUsername = document.getElementById('admin-username');

// 认证状态管理
let isAuthenticated = false;
let adminUser = null;

// 检查认证状态
function checkAuthStatus() {
    const authData = sessionStorage.getItem('admin-auth');
    console.log('从sessionStorage获取的认证数据:', authData);
    if (authData) {
        try {
            const data = JSON.parse(authData);
            console.log('解析后的认证数据:', data);
            // 确保认证数据有效
            if (data.authenticated && data.username) {
                // 兼容处理：如果没有password字段，仍然将用户视为已认证
                // 但需要在需要密码的地方（如数据更新）提示用户重新登录
                isAuthenticated = data.authenticated;
                adminUser = data.username;
                console.log('认证状态设置为:', isAuthenticated, '管理员用户:', adminUser);
                console.log('认证数据中是否包含密码:', !!data.password);
            } else {
                console.error('认证数据不完整或无效:', data);
                sessionStorage.removeItem('admin-auth');
                isAuthenticated = false;
                adminUser = null;
            }
        } catch (e) {
            console.error('认证数据解析失败:', e);
            sessionStorage.removeItem('admin-auth');
            isAuthenticated = false;
            adminUser = null;
        }
    } else {
        // 未登录状态
        console.log('sessionStorage中没有认证数据');
        isAuthenticated = false;
        adminUser = null;
    }
    // 无论是否登录，都更新UI
    updateAuthUI();
}

// 更新认证相关UI
function updateAuthUI() {
    if (isAuthenticated && adminUser) {
        adminLoginBtn.style.display = 'none';
        adminLogoutItem.style.display = 'block';
        
        // 只有当adminUsername元素存在时才设置textContent
        if (adminUsername) {
            adminUsername.textContent = adminUser;
        }
        
        // 登录后显示更新按钮
        if (document.getElementById('update-data-btn')) {
            document.getElementById('update-data-btn').style.display = 'block';
        }
        // 登录后显示历史数据导航标签
        if (document.getElementById('history-link')) {
            document.getElementById('history-link').parentElement.style.display = 'block';
        }
    } else {
        adminLoginBtn.style.display = 'block';
        adminLogoutItem.style.display = 'none';
        
        // 未登录时隐藏更新按钮
        if (document.getElementById('update-data-btn')) {
            document.getElementById('update-data-btn').style.display = 'none';
        }
        // 未登录时隐藏历史数据导航标签
        if (document.getElementById('history-link')) {
            document.getElementById('history-link').parentElement.style.display = 'none';
        }
    }
}

// 保存认证状态
function saveAuthStatus(username, password) {
    const authData = {
        authenticated: true,
        username: username,
        password: password
    };
    sessionStorage.setItem('admin-auth', JSON.stringify(authData));
    isAuthenticated = true;
    adminUser = username;
    updateAuthUI();
}

// 清除认证状态
function clearAuthStatus() {
    sessionStorage.removeItem('admin-auth');
    isAuthenticated = false;
    adminUser = null;
    updateAuthUI();
}

// 登录表单提交处理
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // 获取错误元素（确保DOM已加载）
    const loginError = document.getElementById('login-error');
    if (loginError) {
        loginError.classList.add('d-none');
    }

    try {
        const credentials = btoa(`${username}:${password}`);
        const response = await fetch('http://localhost:8000/api/auth/login', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('登录成功，保存认证状态:', username, password);
            saveAuthStatus(username, password); // 保存用户名和密码
            loginModal.hide();
            loginForm.reset();
            showToast('登录成功！', 'success');
            // 登录成功后检查认证状态
            console.log('登录后的认证状态:', isAuthenticated, '管理员用户:', adminUser);
            
            // 显示更新按钮（如果在仪表盘或历史数据页面）
            if (document.querySelector('#update-data-btn')) {
                document.querySelector('#update-data-btn').style.display = 'block';
            }
        } else {
            if (loginError) {
                loginError.textContent = '用户名或密码错误';
                loginError.classList.remove('d-none');
            }
        }
    } catch (error) {
        console.error('登录错误:', error);
        if (loginError) {
            loginError.textContent = '登录失败，请稍后重试';
            loginError.classList.remove('d-none');
        }
    }
});

// 登出按钮点击处理
adminLogoutBtn.addEventListener('click', () => {
    clearAuthStatus();
    showToast('已成功登出', 'success');
});

// 爬取数据功能（需要管理员权限）
async function crawlTrendingData() {
    if (!isAuthenticated) {
        showToast('请先登录管理员账号', 'warning');
        loginModal.show();
        return;
    }

    showConfirmToast('确定要爬取数据吗？这个过程可能需要几分钟时间。', async () => {
        // 显示进度条
        const progressDiv = document.getElementById('crawl-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressMessage = document.getElementById('progress-message');
        
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', '0');
        }
        if (progressMessage) {
            progressMessage.textContent = '准备开始爬取...';
        }

        try {
            // 获取管理员凭据
            const authData = sessionStorage.getItem('admin-auth');
            const credentials = JSON.parse(authData);
            
            // 检查是否包含密码
            if (!credentials.password) {
                console.error('认证数据中没有密码，需要重新登录');
                showToast('请重新登录以获取最新数据', 'warning');
                loginModal.show();
                
                // 隐藏进度条
                if (progressDiv) {
                    progressDiv.style.display = 'none';
                }
                return;
            }
            
            // 构建Basic Auth凭据
            const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
            
            // 开始轮询进度
            const progressInterval = setInterval(async () => {
                try {
                    const progressResponse = await fetch('http://localhost:8000/api/update/trending/update/progress', {
                        headers: {
                            'Authorization': `Basic ${basicAuth}`
                        }
                    });
                    
                    if (progressResponse.ok) {
                        const progressData = await progressResponse.json();
                        
                        if (progressBar) {
                            const progress = Math.min(100, Math.round((progressData.completed / progressData.total) * 100));
                            progressBar.style.width = `${progress}%`;
                            progressBar.setAttribute('aria-valuenow', progress);
                        }
                        
                        if (progressMessage) {
                            progressMessage.textContent = progressData.message || '爬取中...';
                        }
                        
                        if (progressData.status === 'completed' || progressData.status === 'failed') {
                            clearInterval(progressInterval);
                            
                            if (progressData.status === 'failed') {
                                showToast(`爬取失败: ${progressData.message}`, 'error');
                            }
                        }
                    }
                } catch (error) {
                    console.error('获取进度失败:', error);
                }
            }, 1000);

            // 发送爬取请求
            const response = await fetch('http://localhost:8000/api/update/trending/update', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/json'
                }
            });

            // 停止轮询
            clearInterval(progressInterval);
            
            const data = await response.json();
            
            // 隐藏进度条
            if (progressDiv) {
                progressDiv.style.display = 'none';
            }

            if (response.ok) {
                if (data.success) {
                    showToast('数据爬取成功！', 'success');
                    // 重新加载页面数据
                    if (document.querySelector('#latest-link').classList.contains('active')) {
                        getLatestTrendingData();
                    } else if (document.querySelector('#dashboard-link').classList.contains('active')) {
                        getStatistics();
                    } else if (document.querySelector('#history-link').classList.contains('active')) {
                        getHistoryList();
                    }
                } else {
                    // 后端返回了成功的HTTP状态码，但数据中包含错误信息
                    showToast(`爬取失败: ${data.message || data.error || '未知错误'}`, 'error');
                }
            } else {
                // 如果返回401状态码，显示需要登录的提示
                if (response.status === 401) {
                    showToast('爬取失败：请先登录管理员账号', 'warning');
                    loginModal.show();
                } else {
                    showToast(`爬取失败: ${data.detail || data.message || data.error || '未知错误'}`, 'error');
                }
            }
        } catch (error) {
            console.error('爬取数据错误:', error);
            // 隐藏进度条
            const progressDiv = document.getElementById('crawl-progress');
            if (progressDiv) {
                progressDiv.style.display = 'none';
            }
            showToast('爬取数据失败，请稍后重试', 'error');
        }
    });
}

// 页面加载时检查认证状态
checkAuthStatus();

// 更新数据按钮事件监听已在DOMContentLoaded中处理

// 夜间模式功能 - 元素将在DOMContentLoaded中获取
let darkModeToggle;

// 检查用户的夜间模式偏好
function checkDarkModePreference() {
    console.log('检查夜间模式偏好...');
    const savedDarkMode = localStorage.getItem('dark-mode');
    console.log('savedDarkMode:', savedDarkMode);
    if (savedDarkMode === 'true' || (!savedDarkMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        console.log('启用夜间模式');
        enableDarkMode();
    }
}

// 切换夜间模式
function toggleDarkMode() {
    if (document.body.classList.contains('dark-mode')) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

// 启用夜间模式
function enableDarkMode() {
    document.body.classList.add('dark-mode');
    localStorage.setItem('dark-mode', 'true');
    if (darkModeToggle) {
        darkModeToggle.innerHTML = '<i class="fa fa-sun-o"></i>';
    }
}

// 禁用夜间模式
function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('dark-mode', 'false');
    if (darkModeToggle) {
        darkModeToggle.innerHTML = '<i class="fa fa-moon-o"></i>';
    }
}

// 检查夜间模式偏好将在DOMContentLoaded中调用

// Toast 工具函数
function showToast(message, type = 'info', duration = 3000) {
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
            textColor = 'text-dark';
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
function showConfirmToast(message, onConfirm, onCancel, duration = 5000) {
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
    
const dashboardSection = document.getElementById('dashboard-section');
const historySection = document.getElementById('history-section');
const latestLink = document.getElementById('latest-link');
const dashboardLink = document.getElementById('dashboard-link');
const historyLink = document.getElementById('history-link');
const repoList = document.getElementById('repo-list');
const historyList = document.getElementById('history-list');
const reportInfo = document.getElementById('report-info');
const repoModal = new bootstrap.Modal(document.getElementById('repo-modal'));
const repoModalBody = document.getElementById('repo-modal-body');
const repoVisitBtn = document.getElementById('repo-visit-btn');
    
// 仪表盘相关元素
const totalWeeksEl = document.getElementById('total-weeks');
const totalUniqueProjectsEl = document.getElementById('total-unique-projects');
const totalUniqueTechnologiesEl = document.getElementById('total-unique-technologies');
const totalUniqueLanguagesEl = document.getElementById('total-unique-languages');
const projectRankingsEl = document.getElementById('project-rankings');
    
// 图表实例
let weeklyProjectsChart, topLanguagesChart, topTechnologiesChart, projectCountsChart;

// 显示加载指示器
function showLoading() {
    loading.style.display = 'block';
    repoList.innerHTML = '';
}

// 隐藏加载指示器
function hideLoading() {
    loading.style.display = 'none';
}

// 显示报告信息
function showReportInfo(metadata) {
    reportInfo.innerHTML = `
        <strong>报告标题：</strong> ${metadata.report_title} <br>
        <strong>生成时间：</strong> ${metadata.generation_date} <br>
        <strong>项目总数：</strong> ${metadata.total_repositories} 个
    `;
}

// 生成趋势徽章
function getTrendBadge(trend) {
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
        }
        
        return `<span class="badge ${badgeClass} trend-badge"><i class="fa ${icon}"></i> ${text}</span>`;
    }
}

// 生成项目卡片
function generateRepoCard(repo, index) {
    const trendBadge = getTrendBadge(repo.trend);
    const hasImage = repo.images && repo.images.representative_image && repo.images.representative_image.filename;
    // 可以在此添加特定项目的图片显示控制
    const shouldShowImage = hasImage && repo.name !== '1code' && repo.name !== 'openwork'; // 不显示1code和openwork项目的图片
    
    return `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="repo-card p-0">
                ${shouldShowImage ? `<img src="/images/${repo.full_name.replace('/', '-')}-${repo.images.representative_image.filename}" alt="${repo.name}" class="repo-image w-100">` : ''}
                <div class="p-4">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="card-title mb-0">${index + 1}. <a href="${repo.html_url}" target="_blank" class="text-decoration-none repo-name">${repo.name}</a></h5>
                        ${trendBadge}
                    </div>
                    <p class="card-text repo-description mb-3">${repo.description || '暂无描述'}</p>
                    <div class="d-flex flex-wrap gap-3 mb-3">
                        <span class="repo-meta"><i class="fa fa-star stars-count"></i> ${repo.stars.toLocaleString()}</span>
                        <span class="repo-meta"><i class="fa fa-code-fork forks-count"></i> ${repo.forks.toLocaleString()}</span>
                        ${repo.primary_language ? `<span class="repo-meta"><span class="language-dot" style="background-color: ${getLanguageColor(repo.primary_language)}"></span>${repo.primary_language}</span>` : ''}
                    </div>
                    <button class="btn btn-primary btn-sm w-100" onclick="showRepoDetail(${JSON.stringify(repo).replace(/"/g, '&quot;')})"><i class="fa fa-info-circle"></i> 查看详情</button>
                </div>
            </div>
        </div>
    `;
}

// 生成仓库详情
function generateRepoDetail(repo) {
    const trendBadge = getTrendBadge(repo.trend);
    const hasImage = repo.images && repo.images.representative_image && repo.images.representative_image.filename;
    
    let detailHtml = `
        <h3>${repo.name}</h3>
        <div class="mb-3">
            ${trendBadge}
            <a href="${repo.html_url}" target="_blank" class="btn btn-sm btn-outline-primary ms-2"><i class="fa fa-external-link"></i> 访问 GitHub</a>
        </div>
        ${hasImage ? `<img src="/images/${repo.full_name.replace('/', '-')}-${repo.images.representative_image.filename}" alt="${repo.name}" class="img-fluid rounded mb-4">` : ''}
        <h5>项目简介</h5>
        <p>${repo.description || '暂无描述'}</p>
        
        <h5>项目统计</h5>
        <ul class="list-unstyled">
            <li><strong>Stars：</strong> <span class="stars-count">${repo.stars.toLocaleString()}</span></li>
            <li><strong>Forks：</strong> <span class="forks-count">${repo.forks.toLocaleString()}</span></li>
            <li><strong>Watchers：</strong> ${repo.watchers_count?.toLocaleString() || 'N/A'}</li>
            <li><strong>主要语言：</strong> ${repo.primary_language || 'Unknown'}</li>
            <li><strong>创建时间：</strong> ${new Date(repo.created_at).toLocaleDateString()}</li>
            <li><strong>更新时间：</strong> ${new Date(repo.updated_at).toLocaleDateString()}</li>
        </ul>
    `;
    
    // 添加AI总结
    if (repo.ai_summary && repo.ai_summary.summary) {
        detailHtml += `
            <h5>AI 总结</h5>
            <p>${repo.ai_summary.summary}</p>
        `;
        
        if (repo.ai_summary.highlights && repo.ai_summary.highlights.length > 0) {
            detailHtml += `
                <h6>核心特性</h6>
                <ul>
                    ${repo.ai_summary.highlights.map(h => `<li>${h}</li>`).join('')}
                </ul>
            `;
        }
    }
    
    // 添加技术栈
    if (repo.tech_stack && repo.tech_stack.length > 0) {
        detailHtml += `
            <h5>技术栈</h5>
            <div class="d-flex flex-wrap gap-2">
                ${repo.tech_stack.map(tech => `<span class="badge bg-secondary">${tech}</span>`).join('')}
            </div>
        `;
    }
    
    return detailHtml;
}

// 显示项目详情
function showRepoDetail(repo) {
    repoModalBody.innerHTML = generateRepoDetail(repo);
    repoVisitBtn.href = repo.html_url;
    repoVisitBtn.style.display = 'block'; // 显示访问按钮
    repoModal.show();
}

// 获取最新趋势数据
async function getLatestTrendingData() {
    showLoading();
    
    try {
        // 添加随机参数避免浏览器缓存
        const url = `http://localhost:8000/api/trending/latest?_=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-cache' });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                const { metadata, repositories } = result.data;
                showReportInfo(metadata);
                
                // 存储当前仓库数据
                currentRepositories = repositories;
                
                // 显示报告信息
                reportInfo.style.display = 'block';
                
                // 生成项目卡片
                repoList.innerHTML = repositories.map((repo, index) => generateRepoCard(repo, index)).join('');
            } else {
                repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取数据失败：${result.error || '未知错误'}</div></div>`;
                reportInfo.style.display = 'none';
                currentRepositories = [];
            }
        } else {
            const result = await response.json();
            repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-warning">获取数据失败：${result.detail || `HTTP ${response.status}`}</div></div>`;
            reportInfo.style.display = 'none';
            currentRepositories = [];
        }
    } catch (error) {
        repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取数据失败：${error.message}</div></div>`;
        reportInfo.style.display = 'none';
        currentRepositories = [];
    } finally {
        hideLoading();
    }
}

// 全局变量用于管理历史数据
let allHistoryData = [];
let selectedItems = new Set();
    
// 获取历史数据列表
async function getHistoryList() {
    // 检查认证状态
    if (!isAuthenticated) {
        hideLoading();
        showToast('请先登录管理员账号', 'warning');
        loginModal.show();
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch('http://localhost:8000/api/trending/history', { cache: 'no-cache' });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                allHistoryData = result.data;
                renderHistoryTable(allHistoryData);
            } else {
                historyList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取历史数据失败：${result.error || '未知错误'}</div></div>`;
            }
        } else {
            // 如果返回401状态码，显示需要登录的提示
            if (response.status === 401) {
                historyList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-warning">获取历史数据失败：请先登录管理员账号</div></div>`;
            } else {
                const result = await response.json();
                historyList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-warning">获取历史数据失败：${result.detail || `HTTP ${response.status}`}</div></div>`;
            }
        }
    } catch (error) {
        historyList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取历史数据失败：${error.message}</div></div>`;
    } finally {
        hideLoading();
    }
}
    
// 渲染历史数据表
function renderHistoryTable(history) {
    // 生成统计信息
    const stats = `
        <div class="alert alert-info mb-4 d-flex justify-content-between align-items-center">
            <div>
                <strong>历史数据统计：</strong>共 ${history.length} 条记录
            </div>
            <div class="col-md-4">
                <div class="search-box input-group">
                    <input type="text" class="form-control" id="history-search" placeholder="搜索历史数据...">
                    <button class="btn btn-outline-secondary" id="search-btn">
                        <i class="fa fa-search"></i>
                    </button>
                    <button class="btn btn-outline-secondary clear-btn" id="clear-search" style="display: none;">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 生成表格
    const table = `
        <div class="table-responsive">
            <table class="table table-striped table-bordered table-hover">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="select-all"></th>
                        <th>序号</th>
                        <th>报告标题</th>
                        <th>生成时间</th>
                        <th>项目总数</th>
                        <th>操作</th>
                    </tr>
                </thead>
                    <tbody>
                        ${history.map((item, index) => `
                            <tr data-id="${item.id}">
                                <td><input type="checkbox" class="history-checkbox" data-id="${item.id}"></td>
                                <td>${index + 1}</td>
                                <td>${item.report_title || '无标题'}</td>
                                <td>${item.generation_date || item.week_start}</td>
                                <td>${item.total_repositories || 0} 个</td>
                                <td>
                                    <button class="btn btn-primary btn-sm me-2" onclick="viewWeeklyData(${item.id})" title="查看">
                                        <i class="fa fa-eye"></i>
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteHistoryData(${item.id})" title="删除">
                                        <i class="fa fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    
    historyList.innerHTML = stats + table;
    
    // 绑定复选框事件
    bindCheckboxEvents();
}
    
// 绑定复选框事件
function bindCheckboxEvents() {
    // 全选/取消全选
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.history-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                updateSelectedItems(checkbox);
            });
        });
    }
    
    // 单个复选框
    const checkboxes = document.querySelectorAll('.history-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateSelectedItems(checkbox);
        });
    });
}
    
// 更新选中项
function updateSelectedItems(checkbox) {
    const id = checkbox.dataset.id;
    
    if (checkbox.checked) {
        selectedItems.add(id);
    } else {
        selectedItems.delete(id);
    }
    
    // 更新批量删除按钮状态
    updateBatchDeleteButton();
}
    
// 更新批量删除按钮状态
function updateBatchDeleteButton() {
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) {
        const count = selectedItems.size;
        batchDeleteBtn.disabled = count === 0;
        batchDeleteBtn.innerHTML = `<i class="fa fa-trash"></i> (${count})`;
    }
}
    
// 搜索历史记录
function searchHistory() {
    const searchTerm = document.getElementById('history-search').value.trim().toLowerCase();
    
    if (!searchTerm) {
        renderHistoryTable(allHistoryData);
        return;
    }
    
    // 过滤历史记录
    const filteredHistory = allHistoryData.filter(item => {
        const title = (item.report_title || '').toLowerCase();
        const year = item.year.toString();
        const week = item.week.toString();
        const date = (item.generation_date || '').toLowerCase();
        
        return title.includes(searchTerm) || 
               year.includes(searchTerm) || 
               week.includes(searchTerm) || 
               date.includes(searchTerm);
    });
    
    renderHistoryTable(filteredHistory);
}
    
// 批量删除
async function batchDeleteHistoryData() {
    if (!isAuthenticated) {
        alert('请先登录管理员账号');
        loginModal.show();
        return;
    }
    
    if (selectedItems.size === 0) {
        showToast('请选择要删除的记录', 'warning');
        return;
    }
    
    showConfirmToast(`确定要删除选中的 ${selectedItems.size} 条记录吗？`, async () => {
        showLoading();
        
        try {
            let successCount = 0;
            let failCount = 0;
            
            // 逐个删除选中的记录
            for (const id of selectedItems) {
                
                try {
                    // 获取管理员凭据
                    const authData = sessionStorage.getItem('admin-auth');
                    const credentials = JSON.parse(authData);
                    
                    // 检查是否包含密码
                    if (!credentials.password) {
                        console.error('认证数据中没有密码，需要重新登录');
                        showToast('请重新登录以获取最新数据', 'warning');
                        loginModal.show();
                        
                        // 恢复按钮状态
                        if (updateBtn) {
                            updateBtn.disabled = false;
                            updateBtn.innerHTML = '<i class="fa fa-refresh"></i> 爬取数据';
                        }
                        if (loading) {
                            loading.style.display = 'none';
                        }
                        return;
                    }
                    
                    // 构建Basic Auth凭据
                    const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
                    
                    const response = await fetch(`http://localhost:8000/api/trending/id/${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Basic ${basicAuth}`
                        }
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.success) {
                            successCount++;
                        } else {
                            failCount++;
                            console.error(`删除 ID ${id} 失败：`, result.message);
                        }
                    } else {
                        failCount++;
                        console.error(`删除 ID ${id} 失败：HTTP ${response.status}`);
                    }
                } catch (error) {
                    failCount++;
                    console.error(`删除 ID ${id} 失败：`, error.message);
                }
            }
            
            // 清空选中项
            selectedItems.clear();
            
            // 重新加载历史数据列表
            await getHistoryList();
            
            // 显示结果
            let message = `批量删除完成\n成功：${successCount} 条\n失败：${failCount} 条`;
            alert(message);
        } catch (error) {
            alert('批量删除失败：' + error.message);
        } finally {
            hideLoading();
        }
    });
}

// 删除历史数据
async function deleteHistoryData(id) {
    if (!isAuthenticated) {
        alert('请先登录管理员账号');
        loginModal.show();
        return;
    }
    
    showConfirmToast(`确定要删除这条历史数据吗？`, async () => {
        showLoading();
        
        try {
            // 获取管理员凭据
            const authData = sessionStorage.getItem('admin-auth');
            const credentials = JSON.parse(authData);
            
            // 检查是否包含密码
            if (!credentials.password) {
                console.error('认证数据中没有密码，需要重新登录');
                showToast('请重新登录以获取最新数据', 'warning');
                loginModal.show();
                
                // 恢复按钮状态
                if (updateBtn) {
                    updateBtn.disabled = false;
                    updateBtn.innerHTML = '<i class="fa fa-refresh"></i> 爬取数据';
                }
                if (loading) {
                    loading.style.display = 'none';
                }
                return;
            }
            
            // 构建Basic Auth凭据
            const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
            
            const response = await fetch(`http://localhost:8000/api/trending/id/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Basic ${basicAuth}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success) {
                    showToast('删除成功', 'success');
                    // 重新加载历史数据列表
                    getHistoryList();
                } else {
                    showToast('删除失败：' + result.error, 'error');
                }
            } else {
                // 如果返回401状态码，显示需要登录的提示
                if (response.status === 401) {
                    showToast('删除失败：请先登录管理员账号', 'warning');
                    loginModal.show();
                } else {
                    showToast('删除失败：' + response.statusText, 'error');
                }
            }
        } catch (error) {
            alert('删除失败：' + error.message);
        } finally {
            hideLoading();
        }
    });
}

// 获取指定周的数据
async function getWeeklyData(year, week) {
    showLoading();
    
    try {
        const response = await fetch(`http://localhost:8000/api/trending/${year}/${week}`);
        const result = await response.json();
        
        if (result.success) {
            const { metadata, repositories } = result.data;
            showReportInfo(metadata);
            
            // 生成项目卡片
            repoList.innerHTML = repositories.map((repo, index) => generateRepoCard(repo, index)).join('');
            
            // 切换到最新排行榜区域
            latestLink.classList.add('active');
            dashboardLink.classList.remove('active');
            historyLink.classList.remove('active');
            latestSection.style.display = 'block';
            dashboardSection.style.display = 'none';
            historySection.style.display = 'none';
        } else {
            repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取数据失败：${result.error}</div></div>`;
        }
    } catch (error) {
        repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取数据失败：${error.message}</div></div>`;
    } finally {
        hideLoading();
    }
}
    
// 查看指定周的数据
async function viewWeeklyData(id) {
    // 检查认证状态
    if (!isAuthenticated) {
        hideLoading();
        showToast('请先登录管理员账号', 'warning');
        loginModal.show();
        return;
    }
    
    showLoading();
    
    try {
        // 使用完整的URL并添加随机参数避免缓存
        const url = `http://localhost:8000/api/trending/id/${id}?_=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-cache' });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                const { metadata, repositories } = result.data;
                
                // 生成每周数据的详情内容
                const weeklyDetail = `
                    <div class="p-4">
                        <h5 class="mb-4">${metadata.report_title}</h5>
                        <div class="mb-4">
                            <p><strong>生成时间：</strong> ${metadata.generation_date}</p>
                            <p><strong>统计期间：</strong> ${metadata.week_range.start} 至 ${metadata.week_range.end}</p>
                            <p><strong>项目总数：</strong> ${metadata.total_repositories} 个</p>
                        </div>
                        <h6 class="mb-3">Top ${metadata.total_repositories} 项目</h6>
                        <div class="list-group">
                            ${repositories.map((repo, index) => `
                                <a href="#" class="list-group-item list-group-item-action" onclick="showRepoDetail(${JSON.stringify(repo).replace(/"/g, '&quot;')}); return false;">
                                    <div class="d-flex w-100 justify-content-between align-items-center">
                                        <h6 class="mb-1">${index + 1}. ${repo.name}</h6>
                                        <span class="badge bg-primary">${repo.stars.toLocaleString()} ⭐</span>
                                    </div>
                                    <p class="mb-1 text-muted">${repo.description || '暂无描述'}</p>
                                    <small>${repo.primary_language || '未知语言'}</small>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `;
                
                repoModalBody.innerHTML = weeklyDetail;
                repoVisitBtn.style.display = 'none'; // 隐藏访问按钮
                repoModal.show();
            } else {
                showToast('获取数据失败：' + result.error, 'error');
            }
        } else {
            // 如果返回401状态码，显示需要登录的提示
            if (response.status === 401) {
                showToast('获取数据失败：请先登录管理员账号', 'warning');
            } else {
                const result = await response.json().catch(() => ({}));
                showToast(`获取数据失败：${result.detail || `HTTP ${response.status}`}`, 'error');
            }
        }
    } catch (error) {
        showToast('获取数据失败：' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 切换到最新排行榜
latestLink.addEventListener('click', (e) => {
    e.preventDefault();
    latestLink.classList.add('active');
    dashboardLink.classList.remove('active');
    historyLink.classList.remove('active');
    latestSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    historySection.style.display = 'none';
    // 确保更新UI，包括显示/隐藏更新按钮
    updateAuthUI();
    getLatestTrendingData();
});

// 获取统计数据
async function getStatistics() {
    showLoading();
    console.log('尝试获取统计数据...');
    
    try {
        console.log('API路径:', '/api/trending/statistics');
        const response = await fetch('http://localhost:8000/api/trending/statistics');
        console.log('响应状态:', response.status);
        const result = await response.json();
        console.log('响应数据:', result);
        
        if (result.success) {
            const statistics = result.data;
            
            // 更新统计卡片
            updateStatCards(statistics);
            
            // 渲染图表
            renderCharts(statistics);
            
            // 渲染排行榜
            renderProjectRankings(statistics);
        } else {
            showToast('获取统计数据失败：' + result.error, 'error');
        }
    } catch (error) {
        showToast('获取统计数据失败：' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
    
// 更新统计卡片
function updateStatCards(statistics) {
    totalWeeksEl.textContent = statistics.totalWeeks;
    totalUniqueProjectsEl.textContent = statistics.totalUniqueProjects;
    totalUniqueTechnologiesEl.textContent = statistics.totalUniqueTechnologies;
    totalUniqueLanguagesEl.textContent = statistics.totalUniqueLanguages;
    
    // 最受欢迎项目功能暂时未实现（缺少HTML元素）
}
    
// 渲染排行榜
function renderProjectRankings(statistics) {
    if (!statistics.projectCounts || statistics.projectCounts.length === 0) {
        projectRankingsEl.innerHTML = '<tr><td colspan="4" class="text-center">暂无项目数据</td></tr>';
        return;
    }
    
    // 按上榜次数降序排列，取前10个
    const topProjects = statistics.projectCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    
    // 生成排行榜HTML
    const rankingsHtml = topProjects.map((project, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${project.name.split('/').pop()}</td>
            <td>${project.count}</td>
            <td>${project.last_seen || '未知'}</td>
        </tr>
    `).join('');
    
    projectRankingsEl.innerHTML = rankingsHtml;
}
    
// 渲染图表
function renderCharts(statistics) {
    // 销毁现有图表
    if (weeklyProjectsChart) weeklyProjectsChart.destroy();
    if (topLanguagesChart) topLanguagesChart.destroy();
    if (topTechnologiesChart) topTechnologiesChart.destroy();
    if (projectCountsChart) projectCountsChart.destroy();
    
    // 确保数据存在，避免空数据导致的错误
    const weeklyProjects = statistics.weeklyProjects || [];
    const topLanguages = statistics.topLanguages || [];
    const techStackTrends = statistics.techStackTrends || [];
    const projectCounts = statistics.projectCounts || [];
    
    // 每周项目数量趋势图
    renderWeeklyProjectsChart(weeklyProjects);
    
    // 热门编程语言饼图
    renderTopLanguagesChart(topLanguages.slice(0, 8));
    
    // 热门技术栈柱状图
    renderTopTechnologiesChart(techStackTrends.slice(0, 10));
    
    // 项目上榜次数Top 10柱状图
    renderProjectCountsChart(projectCounts.slice(0, 10));
}
    
// 渲染每周新上榜项目数量趋势图
function renderWeeklyProjectsChart(data) {
    const ctx = document.getElementById('weekly-projects-chart').getContext('2d');
    
    // 处理空数据
    if (!data || data.length === 0) {
        weeklyProjectsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['暂无数据'],
            datasets: [{
                label: '新上榜项目数',
                data: [0],
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff' // 设置图例文字颜色为白色
                    }
                },
                title: {
                    display: true,
                    text: '每周新上榜项目数量趋势',
                    color: '#ffffff' // 设置标题文字颜色为白色
                },
                tooltip: {
                    titleColor: '#ffffff', // 设置工具提示标题颜色为白色
                    bodyColor: '#ffffff' // 设置工具提示内容颜色为白色
                }
            }
        }
        });
        return;
    }
    
    const labels = data.map(item => `${item.year}年第${item.week}周`);
    
    // 使用每周新上榜项目数量
    const newProjectsCounts = data.map(item => item.newProjectsCount || 0);
    
    weeklyProjectsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '新上榜项目数',
                data: newProjectsCounts,
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#ffffff' // 设置Y轴刻度文字颜色为白色
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' // 设置Y轴网格线颜色为半透明白色
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff' // 设置X轴刻度文字颜色为白色
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' // 设置X轴网格线颜色为半透明白色
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff' // 设置图例文字颜色为白色
                    }
                },
                title: {
                    display: true,
                    text: '每周新上榜项目数量趋势',
                    color: '#ffffff' // 设置标题文字颜色为白色
                },
                tooltip: {
                    titleColor: '#ffffff', // 设置工具提示标题颜色为白色
                    bodyColor: '#ffffff' // 设置工具提示内容颜色为白色
                }
            }
        }
    });
}
    
// 渲染热门编程语言饼图
function renderTopLanguagesChart(data) {
    const ctx = document.getElementById('top-languages-chart').getContext('2d');
    
    // 处理空数据
    if (!data || data.length === 0) {
        topLanguagesChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['暂无数据'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#CCCCCC'],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: '热门编程语言分布'
                    }
                }
            }
        });
        return;
    }
    
    const labels = data.map(item => item.name);
    const counts = data.map(item => item.count);
    const backgroundColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#C9CBCF', '#45B7D1'
    ];
    
    topLanguagesChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: backgroundColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff' // 设置图例文字颜色为白色
                    }
                },
                title: {
                    display: true,
                    text: '热门编程语言分布',
                    color: '#ffffff' // 设置标题文字颜色为白色
                },
                tooltip: {
                    titleColor: '#ffffff', // 设置工具提示标题颜色为白色
                    bodyColor: '#ffffff', // 设置工具提示内容颜色为白色
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} 次 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}
    
// 渲染热门技术栈柱状图
function renderTopTechnologiesChart(data) {
    const ctx = document.getElementById('top-technologies-chart').getContext('2d');
    
    // 处理空数据
    if (!data || data.length === 0) {
        topTechnologiesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['暂无数据'],
                datasets: [{
                    label: '出现次数',
                    data: [0],
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#ffffff' // 设置图例文字颜色为白色
                        }
                    },
                    title: {
                        display: true,
                        text: '热门技术栈分布',
                        color: '#ffffff' // 设置标题文字颜色为白色
                    },
                    tooltip: {
                        titleColor: '#ffffff', // 设置工具提示标题颜色为白色
                        bodyColor: '#ffffff' // 设置工具提示内容颜色为白色
                    }
                }
            }
        });
        return;
    }
    
    const labels = data.map(item => item.name);
    const counts = data.map(item => item.count);
    
    topTechnologiesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: counts,
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff' // 设置Y轴刻度文字颜色为白色
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' // 设置Y轴网格线颜色为半透明白色
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: '#ffffff' // 设置X轴刻度文字颜色为白色
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' // 设置X轴网格线颜色为半透明白色
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff' // 设置图例文字颜色为白色
                    }
                },
                title: {
                    display: true,
                    text: '热门技术栈Top 10',
                    color: '#ffffff' // 设置标题文字颜色为白色
                },
                tooltip: {
                    titleColor: '#ffffff', // 设置工具提示标题颜色为白色
                    bodyColor: '#ffffff' // 设置工具提示内容颜色为白色
                }
            }
        }
    });
}
    
// 渲染项目上榜次数Top 10柱状图
function renderProjectCountsChart(data) {
    const ctx = document.getElementById('project-counts-chart').getContext('2d');
    
    // 处理空数据
    if (!data || data.length === 0) {
        projectCountsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['暂无数据'],
                datasets: [{
                    label: '上榜次数',
                    data: [0],
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#ffffff' // 设置图例文字颜色为白色
                        }
                    },
                    title: {
                        display: true,
                        text: '项目上榜次数Top 10',
                        color: '#ffffff' // 设置标题文字颜色为白色
                    },
                    tooltip: {
                        titleColor: '#ffffff', // 设置工具提示标题颜色为白色
                        bodyColor: '#ffffff' // 设置工具提示内容颜色为白色
                    }
                }
            }
        });
        return;
    }
    
    const labels = data.map(item => item.name.replace(/.*\//, '')); // 只显示项目名
    const counts = data.map(item => item.count);
    
    projectCountsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '上榜次数',
                data: counts,
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff' // 设置Y轴刻度文字颜色为白色
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' // 设置Y轴网格线颜色为半透明白色
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: '#ffffff' // 设置X轴刻度文字颜色为白色
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)' // 设置X轴网格线颜色为半透明白色
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff' // 设置图例文字颜色为白色
                    }
                },
                title: {
                    display: true,
                    text: '项目上榜次数Top 10',
                    color: '#ffffff' // 设置标题文字颜色为白色
                },
                tooltip: {
                    titleColor: '#ffffff', // 设置工具提示标题颜色为白色
                    bodyColor: '#ffffff' // 设置工具提示内容颜色为白色
                }
            }
        }
    });
}
    
// 切换到仪表盘
dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    dashboardLink.classList.add('active');
    latestLink.classList.remove('active');
    historyLink.classList.remove('active');
    latestSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    historySection.style.display = 'none';
    reportInfo.innerHTML = '';
    // 确保更新UI，包括显示/隐藏更新按钮
    updateAuthUI();
    getStatistics();
});
    
// 切换到历史数据
historyLink.addEventListener('click', (e) => {
    e.preventDefault();
    historyLink.classList.add('active');
    latestLink.classList.remove('active');
    dashboardLink.classList.remove('active');
    latestSection.style.display = 'none';
    dashboardSection.style.display = 'none';
    historySection.style.display = 'block';
    reportInfo.innerHTML = '';
    // 确保更新UI，包括显示/隐藏更新按钮
    updateAuthUI();
    getHistoryList();
});



// 获取语言对应的颜色
function getLanguageColor(language) {
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

// 页面加载完成后获取最新数据和初始化按钮事件
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM加载完成');
    
    // 检查并记录当前认证状态
    checkAuthStatus();
    console.log('当前认证状态:', isAuthenticated, '管理员用户:', adminUser);
    
    // 获取最新数据
    await getLatestTrendingData();
    
    // 获取所有需要的元素
    const updateBtn = document.getElementById('update-data-btn');
    const loading = document.getElementById('loading');
    const repoList = document.getElementById('repo-list');
    const searchBtn = document.getElementById('search-btn');
    const historySearch = document.getElementById('history-search');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const clearSearchBtn = document.getElementById('clear-search');
    darkModeToggle = document.getElementById('dark-mode-toggle');
    console.log('darkModeToggle:', darkModeToggle);
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // 绑定管理员登录按钮事件
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            console.log('管理员登录按钮被点击');
            loginModal.show();
        });
    }
    
    if (!updateBtn) {
        console.error('未找到爬取按钮');
        return;
    }
    
    // 绑定更新按钮点击事件监听器
    updateBtn.addEventListener('click', async () => {
        console.log('爬取按钮被点击 - 事件监听器');
        
        // 检查并记录当前认证状态
        checkAuthStatus();
        console.log('点击爬取按钮时的认证状态:', isAuthenticated, '管理员用户:', adminUser);
        
        try {
            // 检查认证状态
            if (!isAuthenticated) {
                console.error('认证状态为false，弹出登录框');
                showToast('请先登录管理员账号', 'warning');
                loginModal.show();
                return;
            }
            
            // 显示加载状态
            if (loading) {
                loading.style.display = 'block';
            }
            if (repoList) {
                repoList.innerHTML = '';
            }
            
            // 更新按钮状态
            if (updateBtn) {
                updateBtn.disabled = true;
                updateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 爬取中...';
            }
            
            // 获取管理员凭据
            const authData = sessionStorage.getItem('admin-auth');
            const credentials = JSON.parse(authData);
            
            // 检查是否包含密码
            if (!credentials.password) {
                console.error('认证数据中没有密码，需要重新登录');
                showToast('请重新登录以获取最新数据', 'warning');
                loginModal.show();
                
                // 恢复按钮状态
                if (updateBtn) {
                    updateBtn.disabled = false;
                    updateBtn.innerHTML = '<i class="fa fa-refresh"></i> 爬取数据';
                }
                if (loading) {
                    loading.style.display = 'none';
                }
                return;
            }
            
            // 构建Basic Auth凭据
            const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
            
            // 发送爬取请求
            console.log('发送爬取请求');
            const response = await fetch('http://localhost:8000/api/update/trending/update', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('请求响应状态:', response.status);
            const result = await response.json();
            console.log('响应结果:', result);
            
            if (result.success) {
                // 爬取成功，重新加载数据
                await getLatestTrendingData();
                
                // 显示成功消息
                showToast('数据爬取完成！', 'success');
            } else {
                // 如果返回401状态码，显示需要登录的提示
                if (response.status === 401) {
                    showToast('更新失败：请先登录管理员账号', 'warning');
                    loginModal.show();
                } else {
                    showToast('爬取失败: ' + (result.error || '未知错误'), 'error');
                }
            }
        } catch (error) {
            console.error('爬取失败:', error);
            showToast('爬取失败: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            if (updateBtn) {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<i class="fa fa-refresh"></i> 爬取数据';
            }
            
            // 隐藏加载状态
            if (loading) {
                loading.style.display = 'none';
            }
        }
    });
    
    // 绑定AI解读按钮点击事件监听器
    if (aiInterpretBtn) {
        aiInterpretBtn.addEventListener('click', async () => {
            console.log('AI解读按钮被点击');
            
            // 检查是否有数据
            if (currentRepositories.length === 0) {
                showToast('没有可解读的数据，请先获取最新数据', 'warning');
                return;
            }
            
            // 显示加载状态
            loading.style.display = 'block';
            aiInterpretBtn.disabled = true;
            aiInterpretBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 解读中...';
            
            try {
                // 准备提示词
                const prompt = `请分析以下GitHub热门项目的标题和描述，进行功能分类，提供应用建议和趋势解读：\n\n${currentRepositories.slice(0, 10).map((repo, index) => {
                    return `${index + 1}. ${repo.name} - ${repo.description || '无描述'}`;
                }).join('\n')}`;
                
                // 调用AI模型
                const interpretation = await callZhipuModel(prompt);
                
                // 解析markdown为HTML
                const htmlContent = marked.parse(interpretation);
                
                // 显示解读结果
                aiInterpretationModalContent.innerHTML = htmlContent;
                aiInterpretationModal.show();
                
            } catch (error) {
                console.error('AI解读失败:', error);
                showToast('AI解读失败: ' + error.message, 'error');
            } finally {
                // 恢复按钮状态
                aiInterpretBtn.disabled = false;
                aiInterpretBtn.innerHTML = '<i class="fa fa-robot"></i> AI解读';
                hideLoading();
            }
        });
    }
    
    // 绑定搜索按钮点击事件监听器
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchHistory();
        });
    }
    
    // 绑定搜索框回车键事件
    if (historySearch) {
        historySearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchHistory();
            }
        });
        
        // 监听搜索框输入事件，控制清空按钮显示
        historySearch.addEventListener('input', () => {
            if (clearSearchBtn) {
                clearSearchBtn.style.display = historySearch.value ? 'inline-block' : 'none';
            }
        });
    }
    
    // 绑定清空搜索框按钮事件
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (historySearch) {
                historySearch.value = '';
                clearSearchBtn.style.display = 'none';
                searchHistory(); // 清空后重新搜索（显示全部）
            }
        });
    }
    
    // 绑定批量删除按钮点击事件监听器
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            await batchDeleteHistoryData();
        });
    }
    
    // 检查夜间模式偏好
    checkDarkModePreference();
});