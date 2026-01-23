// 数据爬取模块
import { API_BASE_URL } from './env.js';
import { showToast, showConfirmToast, showLoading, hideLoading, showReportInfo, repoList, reportInfo } from './ui.js';
import { getAuthStatus, getAuthData } from './auth.js';

// 全局变量
export let currentRepositories = [];
let allHistoryData = [];
let selectedItems = new Set();

// 暴露为全局变量，供其他模块使用
window.currentRepositories = currentRepositories;

// DOM元素
let historyList, repoModal, repoModalBody, repoVisitBtn;

// 初始化数据模块
export function initData() {
    // 获取DOM元素
    historyList = document.getElementById('history-list');
    repoModal = new bootstrap.Modal(document.getElementById('repo-modal'));
    repoModalBody = document.getElementById('repo-modal-body');
    repoVisitBtn = document.getElementById('repo-visit-btn');
    
    // 绑定事件
    const searchBtn = document.getElementById('search-btn');
    const historySearch = document.getElementById('history-search');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const clearSearchBtn = document.getElementById('clear-search');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', searchHistory);
    }
    
    if (historySearch) {
        historySearch.addEventListener('input', handleHistorySearch);
    }
    
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', batchDeleteHistoryData);
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
}

// 爬取数据功能（需要管理员权限）
export async function crawlTrendingData() {
    const { isAuthenticated } = getAuthStatus();
    if (!isAuthenticated) {
        showToast('请先登录管理员账号', 'warning');
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
            const credentials = getAuthData();
            
            // 检查是否包含密码
            if (!credentials || !credentials.password) {
                console.error('认证数据中没有密码，需要重新登录');
                showToast('请重新登录以获取最新数据', 'warning');
                
                // 隐藏进度条
                if (progressDiv) {
                    progressDiv.style.display = 'none';
                }
                return;
            }
            
            // 构建请求数据（使用请求体认证，与登录时相同）
            const requestData = {
                username: credentials.username,
                password: credentials.password
            };
            console.log('发送的认证数据:', requestData);
            
            // 开始轮询进度
            let progressInterval;
            
            // 发送爬取请求
            const responsePromise = fetch(`${API_BASE_URL}/api/update/trending/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData),
                credentials: 'include' // 添加此选项，确保跨域请求能够正确发送认证凭据
            });

            // 开始轮询进度，直到收到响应
            progressInterval = setInterval(async () => {
                try {
                    const progressResponse = await fetch(`${API_BASE_URL}/api/update/trending/update/progress`);
                    
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
                        
                        // 不要在这里停止轮询，直到收到响应
                    }
                } catch (error) {
                    console.error('获取进度失败:', error);
                }
            }, 1000);

            // 等待爬取请求完成
            const response = await responsePromise;
            const data = await response.json();

            // 停止轮询
            clearInterval(progressInterval);
            
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
                        if (window.getStatistics) {
                            window.getStatistics();
                        }
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

// 获取最新趋势数据
export async function getLatestTrendingData() {
    showLoading();
    
    try {
        // 添加随机参数避免浏览器缓存
        const url = `${API_BASE_URL}/api/trending/latest?_=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-cache' });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                const { metadata, repositories } = result.data;
                showReportInfo(metadata);
                
                // 获取历史数据用于计算趋势
                let historicalData = [];
                try {
                    const historyResponse = await fetch(`${API_BASE_URL}/api/trending/history?_=${Date.now()}`, { cache: 'no-cache' });
                    if (historyResponse.ok) {
                        const historyResult = await historyResponse.json();
                        if (historyResult.success) {
                            // 获取最近的几期历史数据（最多5期）
                            historicalData = historyResult.data.slice(0, 5);
                        }
                    }
                } catch (historyError) {
                    console.warn('获取历史数据失败，使用默认趋势计算:', historyError);
                }
                
                // 计算每个项目的趋势状态
                const processedRepositories = await calculateTrendStatus(repositories, historicalData);
                
                // 存储当前仓库数据
                currentRepositories = processedRepositories;
                // 同时更新全局变量
                window.currentRepositories = currentRepositories;
                
                // 显示报告信息
                reportInfo.style.display = 'block';
                
                // 生成项目卡片
                repoList.innerHTML = processedRepositories.map((repo, index) => generateRepoCard(repo, index)).join('');
            } else {
                repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取数据失败：${result.error || '未知错误'}</div></div>`;
                reportInfo.style.display = 'none';
                currentRepositories = [];
                // 同时更新全局变量
                window.currentRepositories = currentRepositories;
            }
        } else {
            const result = await response.json();
            repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-warning">获取数据失败：${result.detail || `HTTP ${response.status}`}</div></div>`;
            reportInfo.style.display = 'none';
            currentRepositories = [];
            // 同时更新全局变量
            window.currentRepositories = currentRepositories;
        }
    } catch (error) {
        repoList.innerHTML = `<div class="col-12 text-center"><div class="alert alert-danger">获取数据失败：${error.message}</div></div>`;
        reportInfo.style.display = 'none';
        currentRepositories = [];
        // 同时更新全局变量
        window.currentRepositories = currentRepositories;
    } finally {
        hideLoading();
    }
}

// 获取历史数据列表
export async function getHistoryList() {
    // 检查认证状态
    const { isAuthenticated } = getAuthStatus();
    if (!isAuthenticated) {
        hideLoading();
        showToast('请先登录管理员账号', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/trending/history`, { cache: 'no-cache' });
        
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

// 计算项目趋势状态
export async function calculateTrendStatus(currentRepos, historicalData) {
    // 创建当前项目的映射，按 full_name 索引
    const currentRepoMap = new Map();
    currentRepos.forEach((repo, index) => {
        currentRepoMap.set(repo.full_name, {
            ...repo,
            currentRank: index + 1
        });
    });
    
    // 收集历史项目数据
    const historicalRepoData = [];
    
    // 遍历历史数据，获取每一期的项目信息
    for (const historyItem of historicalData) {
        try {
            // 获取该期的详细数据
            const detailResponse = await fetch(`${API_BASE_URL}/api/trending/weekly/${historyItem.id}?_=${Date.now()}`, { cache: 'no-cache' });
            if (detailResponse.ok) {
                const detailResult = await detailResponse.json();
                if (detailResult.success && detailResult.data.repositories) {
                    const weekRepos = detailResult.data.repositories;
                    // 为每个项目记录该期的排名
                    const repoRankMap = new Map();
                    weekRepos.forEach((repo, index) => {
                        repoRankMap.set(repo.full_name, index + 1);
                    });
                    historicalRepoData.push({
                        id: historyItem.id,
                        week_start: historyItem.week_start,
                        repoRankMap: repoRankMap
                    });
                }
            }
        } catch (detailError) {
            console.warn(`获取历史报告 ${historyItem.id} 详情失败:`, detailError);
        }
    }
    
    // 计算每个项目的趋势状态
    return currentRepos.map((repo, index) => {
        const currentRank = index + 1;
        let isNew = true;
        let previousRank = null;
        
        // 查找该项目在历史数据中的排名
        for (const historyRepoData of historicalRepoData) {
            if (historyRepoData.repoRankMap.has(repo.full_name)) {
                previousRank = historyRepoData.repoRankMap.get(repo.full_name);
                isNew = false;
                break; // 只需要最近一期的排名
            }
        }
        
        // 确定趋势状态
        let trendStatus = {
            is_new: isNew
        };
        
        if (!isNew && previousRank !== null) {
            if (currentRank < previousRank) {
                trendStatus.status = 'rising';
            } else if (currentRank > previousRank) {
                trendStatus.status = 'falling';
            } else {
                trendStatus.status = 'stable';
            }
        }
        
        return {
            ...repo,
            trend: trendStatus
        };
    });
}

// 生成项目卡片
export function generateRepoCard(repo, index) {
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
export function generateRepoDetail(repo) {
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
export function showRepoDetail(repo) {
    repoModalBody.innerHTML = generateRepoDetail(repo);
    repoVisitBtn.href = repo.html_url;
    repoVisitBtn.style.display = 'block'; // 显示访问按钮
    repoModal.show();
}

// 查看指定周的数据
export async function viewWeeklyData(id) {
    // 检查认证状态
    const { isAuthenticated } = getAuthStatus();
    if (!isAuthenticated) {
        hideLoading();
        showToast('请先登录管理员账号', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        // 使用完整的URL并添加随机参数避免缓存
        const url = `${API_BASE_URL}/api/trending/id/${id}?_=${Date.now()}`;
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

// 获取指定周的数据
export async function getWeeklyData(year, week) {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/trending/${year}/${week}`);
        const result = await response.json();
        
        if (result.success) {
            const { metadata, repositories } = result.data;
            showReportInfo(metadata);
            
            // 生成项目卡片
            repoList.innerHTML = repositories.map((repo, index) => generateRepoCard(repo, index)).join('');
            
            // 切换到最新排行榜区域
            const latestLink = document.getElementById('latest-link');
            const dashboardLink = document.getElementById('dashboard-link');
            const historyLink = document.getElementById('history-link');
            const latestSection = document.getElementById('latest-section');
            const dashboardSection = document.getElementById('dashboard-section');
            const historySection = document.getElementById('history-section');
            
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

// 批量删除历史数据
export async function batchDeleteHistoryData() {
    const { isAuthenticated } = getAuthStatus();
    if (!isAuthenticated) {
        alert('请先登录管理员账号');
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
                    const credentials = getAuthData();
                    
                    // 检查是否包含密码
                    if (!credentials || !credentials.password) {
                        console.error('认证数据中没有密码，需要重新登录');
                        showToast('请重新登录以获取最新数据', 'warning');
                        
                        // 恢复按钮状态
                        const updateBtn = document.getElementById('update-data-btn');
                        if (updateBtn) {
                            updateBtn.disabled = false;
                            updateBtn.innerHTML = '<i class="fa fa-refresh"></i> 爬取数据';
                        }
                        if (loading) {
                            loading.style.display = 'none';
                        }
                        return;
                    }
                    
                    // 构建请求数据（使用请求体认证，与登录时相同）
                    const requestData = {
                        username: credentials.username,
                        password: credentials.password
                    };
                    console.log('发送的认证数据:', requestData);
                    
                    const response = await fetch(`${API_BASE_URL}/api/trending/id/${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestData),
                        credentials: 'include' // 添加此选项，确保跨域请求能够正确发送认证凭据
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
export async function deleteHistoryData(id) {
    const { isAuthenticated } = getAuthStatus();
    if (!isAuthenticated) {
        alert('请先登录管理员账号');
        return;
    }
    
    showConfirmToast(`确定要删除这条历史数据吗？`, async () => {
        showLoading();
        
        try {
            // 获取管理员凭据
            const credentials = getAuthData();
            
            // 检查是否包含密码
            if (!credentials || !credentials.password) {
                console.error('认证数据中没有密码，需要重新登录');
                showToast('请重新登录以获取最新数据', 'warning');
                
                // 恢复按钮状态
                const updateBtn = document.getElementById('update-data-btn');
                if (updateBtn) {
                    updateBtn.disabled = false;
                    updateBtn.innerHTML = '<i class="fa fa-refresh"></i> 爬取数据';
                }
                if (loading) {
                    loading.style.display = 'none';
                }
                return;
            }
            
            // 构建请求数据（使用请求体认证，与登录时相同）
            const requestData = {
                username: credentials.username,
                password: credentials.password
            };
            console.log('发送的认证数据:', requestData);
            
            const response = await fetch(`${API_BASE_URL}/api/trending/id/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData),
                credentials: 'include' // 添加此选项，确保跨域请求能够正确发送认证凭据
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

// 搜索历史记录
export function searchHistory() {
    const searchTerm = document.getElementById('history-search').value.trim().toLowerCase();
    
    if (!searchTerm) {
        renderHistoryTable(allHistoryData);
        return;
    }
    
    // 过滤历史记录
    const filteredHistory = allHistoryData.filter(item => {
        const title = (item.report_title || '').toLowerCase();
        const year = item.year?.toString() || '';
        const week = item.week?.toString() || '';
        const date = (item.generation_date || '').toLowerCase();
        
        return title.includes(searchTerm) || 
               year.includes(searchTerm) || 
               week.includes(searchTerm) || 
               date.includes(searchTerm);
    });
    
    renderHistoryTable(filteredHistory);
}

// 渲染历史数据表
export function renderHistoryTable(history) {
    // 清空选中项集合，因为表格将被重新渲染
    selectedItems.clear();
    
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
    
    // 更新批量删除按钮状态
    updateBatchDeleteButton();
    
    // 绑定复选框事件
    bindCheckboxEvents();
}

// 绑定复选框事件
export function bindCheckboxEvents() {
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
export function updateSelectedItems(checkbox) {
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
export function updateBatchDeleteButton() {
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) {
        const count = selectedItems.size;
        batchDeleteBtn.disabled = count === 0;
        batchDeleteBtn.innerHTML = `<i class="fa fa-trash"></i> (${count})`;
    }
}

// 处理历史搜索输入
export function handleHistorySearch(e) {
    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
    }
}

// 清除搜索
export function clearSearch() {
    const historySearch = document.getElementById('history-search');
    const clearSearchBtn = document.getElementById('clear-search');
    if (historySearch) {
        historySearch.value = '';
        renderHistoryTable(allHistoryData);
    }
    if (clearSearchBtn) {
        clearSearchBtn.style.display = 'none';
    }
}

// 获取趋势徽章（从ui模块导入）
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
        } else if (trend.status === 'stable') {
            // 明确处理稳定状态
            badgeClass = 'bg-secondary';
            icon = 'fa fa-minus';
            text = '稳定';
        }
        
        return `<span class="badge ${badgeClass} trend-badge"><i class="fa ${icon}"></i> ${text}</span>`;
    }
}

// 获取语言颜色（从ui模块导入）
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

// 导出全局变量

