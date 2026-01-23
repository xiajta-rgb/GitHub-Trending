// 主脚本文件
// 通过ES模块导入各功能模块

// 导入环境配置
import { API_BASE_URL } from './js/env.js';

// 导入认证模块
import { initAuth, checkAuthStatus, getAuthStatus } from './js/auth.js';

// 导入UI模块
import { initUI, showToast, toggleDarkMode, getChartTextColor, getChartGridColor } from './js/ui.js';

// 导入数据模块
import { 
    initData, 
    getLatestTrendingData, 
    getHistoryList, 
    crawlTrendingData, 
    showRepoDetail,
    viewWeeklyData,
    deleteHistoryData,
    batchDeleteHistoryData,
    searchHistory
} from './js/crawl.js';

// 导入AI模块
import { initAI, callZhipuModel } from './js/ai.js';

// 全局变量
let dashboardSection, historySection, latestLink, dashboardLink, historyLink, reportInfo;
let weeklyProjectsChart, topLanguagesChart, topTechnologiesChart, projectCountsChart, topTopicsChart;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM加载完成');
    
    // 获取DOM元素
    dashboardSection = document.getElementById('dashboard-section');
    historySection = document.getElementById('history-section');
    latestLink = document.getElementById('latest-link');
    dashboardLink = document.getElementById('dashboard-link');
    historyLink = document.getElementById('history-link');
    reportInfo = document.getElementById('report-info');
    
    // 初始化各模块
    initAuth();
    initUI();
    initData();
    initAI();
    
    // 检查并记录当前认证状态
    checkAuthStatus();
    const { isAuthenticated, adminUser } = getAuthStatus();
    console.log('当前认证状态:', isAuthenticated, '管理员用户:', adminUser);
    
    // 获取最新数据
    await getLatestTrendingData();
    
    // 绑定导航事件
    bindNavigationEvents();
    
    // 绑定更新按钮事件
    bindUpdateButtonEvent();
    
    // 绑定仪表盘查看详情按钮事件
    bindDashboardDetailEvents();
});

// 绑定仪表盘查看详情按钮事件
function bindDashboardDetailEvents() {
    // 为所有模块详情按钮添加点击事件
    document.addEventListener('click', function(e) {
        if (e.target.closest('.module-popup-btn')) {
            const btn = e.target.closest('.module-popup-btn');
            const moduleType = btn.getAttribute('data-module');
            if (moduleType) {
                showModuleDetail(moduleType);
            }
        }
        
        // 为所有AI解读按钮添加点击事件
        if (e.target.closest('.ai-interpret-btn')) {
            const btn = e.target.closest('.ai-interpret-btn');
            const moduleType = btn.getAttribute('data-module');
            if (moduleType) {
                handleDashboardAIInterpret(moduleType);
            }
        }
    });
}

// 处理仪表盘AI解读按钮点击
async function handleDashboardAIInterpret(moduleType) {
    console.log('处理仪表盘AI解读:', moduleType);
    
    // 显示加载状态
    showToast('AI正在分析...', 'info');
    
    try {
        // 获取统计数据
        const response = await fetch(`${API_BASE_URL}/api/trending/statistics`);
        const result = await response.json();
        
        if (result.success) {
            const statistics = result.data;
            let prompt = '';
            let title = '';
            
            switch (moduleType) {
                case 'precise-rankings':
                    title = '精准度项目榜单AI解读';
                    if (statistics.preciseRankings && statistics.preciseRankings.length > 0) {
                        // 准备精准度榜单的提示词
                        prompt = preparePreciseRankingsPrompt(statistics.preciseRankings);
                    } else {
                        showToast('暂无精准度榜单数据', 'warning');
                        return;
                    }
                    break;
                default:
                    showToast('暂不支持该模块的AI解读', 'warning');
                    return;
            }
            
            // 调用AI模型
            const interpretation = await callZhipuModel(prompt);
            
            // 使用marked库渲染Markdown
            let renderedContent;
            if (window.marked && typeof window.marked === 'function') {
                renderedContent = window.marked(interpretation);
            } else {
                // 如果marked库加载失败，使用原始内容
                renderedContent = `<pre>${interpretation}</pre>`;
            }
            
            // 显示解读结果
            showAIInterpretationModal(title, renderedContent);
        } else {
            showToast('获取统计数据失败：' + result.error, 'error');
        }
    } catch (error) {
        console.error('AI解读失败:', error);
        showToast('AI解读失败：' + error.message, 'error');
    }
}

// 准备精准度榜单的AI提示词
function preparePreciseRankingsPrompt(preciseRankings) {
    let prompt = "请分析以下GitHub精准度项目榜单，进行技术分析和趋势解读：\n\n";
    
    // 取前10个项目进行分析
    const topProjects = preciseRankings.slice(0, 10);
    
    topProjects.forEach((project, index) => {
        prompt += `${index + 1}. ${project.name}\n`;
        prompt += `   Stars：${project.stars}\n`;
        prompt += `   Forks：${project.forks}\n`;
        prompt += `   最终得分：${project.final_score.toFixed(4)}\n`;
        prompt += "\n";
    });
    
    prompt += "请按照以下格式输出分析结果：\n";
    prompt += "1. 整体趋势分析\n";
    prompt += "2. 技术特点分析\n";
    prompt += "3. 项目质量评估\n";
    prompt += "4. 投资价值分析\n";
    prompt += "5. 未来发展建议\n";
    
    return prompt;
}

// 显示AI解读结果模态框
function showAIInterpretationModal(title, content) {
    // 获取模态框元素
    const modal = document.getElementById('ai-interpretation-modal');
    if (!modal) {
        console.error('未找到AI解读模态框');
        return;
    }
    
    // 更新模态框标题和内容
    const modalTitle = document.getElementById('ai-interpretation-modal-label');
    const modalContent = document.getElementById('ai-interpretation-modal-content');
    
    if (modalTitle) {
        modalTitle.textContent = title;
    }
    
    if (modalContent) {
        modalContent.innerHTML = `<div class="p-4">${content}</div>`;
    }
    
    // 显示模态框
    const aiModal = new bootstrap.Modal(modal);
    aiModal.show();
}

// 显示模块详情（从dashboard-detail.js导入）
function showModuleDetail(moduleType) {
    console.log('显示模块详情:', moduleType);
    
    // 获取统计数据
    fetch(`${API_BASE_URL}/api/trending/statistics`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                const statistics = result.data;
                let html = '';
                let title = '';
                
                switch (moduleType) {
                    case 'top-topics':
                        title = '热门主题分布详情';
                        if (statistics.topTopics && statistics.topTopics.length > 0) {
                            html = '<table class="table table-striped"><thead><tr><th>序号</th><th>主题</th><th>出现次数</th></tr></thead><tbody>';
                            statistics.topTopics.slice(0, 50).forEach((topic, index) => {
                                html += `<tr><td>${index + 1}</td><td>${topic.name}</td><td>${topic.count}</td></tr>`;
                            });
                            html += '</tbody></table>';
                        } else {
                            html = '<div class="text-center">暂无主题数据</div>';
                        }
                        break;
                    case 'project-counts':
                        title = '项目总数增长趋势详情';
                        if (statistics.weeklyProjects && statistics.weeklyProjects.length > 0) {
                            html = '<table class="table table-striped"><thead><tr><th>序号</th><th>年份</th><th>周数</th><th>项目数</th><th>新项目数</th></tr></thead><tbody>';
                            statistics.weeklyProjects.slice(0, 50).forEach((week, index) => {
                                html += `<tr><td>${index + 1}</td><td>${week.year}</td><td>${week.week}</td><td>${week.projectsCount}</td><td>${week.newProjectsCount}</td></tr>`;
                            });
                            html += '</tbody></table>';
                        } else {
                            html = '<div class="text-center">暂无项目数据</div>';
                        }
                        break;
                    case 'top-languages':
                        title = '热门编程语言分布详情';
                        if (statistics.topLanguages && statistics.topLanguages.length > 0) {
                            html = '<table class="table table-striped"><thead><tr><th>序号</th><th>语言</th><th>出现次数</th></tr></thead><tbody>';
                            statistics.topLanguages.slice(0, 50).forEach((language, index) => {
                                html += `<tr><td>${index + 1}</td><td>${language.name}</td><td>${language.count}</td></tr>`;
                            });
                            html += '</tbody></table>';
                        } else {
                            html = '<div class="text-center">暂无语言数据</div>';
                        }
                        break;
                    case 'top-technologies':
                        title = '热门技术栈分布详情';
                        if (statistics.techStackTrends && statistics.techStackTrends.length > 0) {
                            html = '<table class="table table-striped"><thead><tr><th>序号</th><th>技术栈</th><th>出现次数</th></tr></thead><tbody>';
                            statistics.techStackTrends.slice(0, 50).forEach((tech, index) => {
                                html += `<tr><td>${index + 1}</td><td>${tech.name}</td><td>${tech.count}</td></tr>`;
                            });
                            html += '</tbody></table>';
                        } else {
                            html = '<div class="text-center">暂无技术栈数据</div>';
                        }
                        break;
                    case 'rankings':
                        title = '项目上榜次数详情';
                        if (statistics.projectCounts && statistics.projectCounts.length > 0) {
                            html = '<table class="table table-striped"><thead><tr><th>序号</th><th>项目</th><th>上榜次数</th><th>最后上榜时间</th></tr></thead><tbody>';
                            statistics.projectCounts.slice(0, 50).forEach((project, index) => {
                                html += `<tr><td>${index + 1}</td><td>${project.name.split('/').pop()}</td><td>${project.count}</td><td>${project.last_seen || '未知'}</td></tr>`;
                            });
                            html += '</tbody></table>';
                        } else {
                            html = '<div class="text-center">暂无项目数据</div>';
                        }
                        break;
                    case 'precise-rankings':
                        title = '精准度项目榜单详情';
                        if (statistics.preciseRankings && statistics.preciseRankings.length > 0) {
                            html = '<table class="table table-striped"><thead><tr><th>序号</th><th>项目</th><th>Stars</th><th>Forks</th><th>最终得分</th></tr></thead><tbody>';
                            statistics.preciseRankings.slice(0, 50).forEach((project, index) => {
                                html += `<tr><td>${index + 1}</td><td>${project.name}</td><td>${project.stars}</td><td>${project.forks}</td><td>${project.final_score.toFixed(4)}</td></tr>`;
                            });
                            html += '</tbody></table>';
                        } else {
                            html = '<div class="text-center">暂无项目数据</div>';
                        }
                        break;
                    default:
                        title = '模块详情';
                        html = '<div class="text-center">暂无数据</div>';
                }
                
                // 获取模态框元素
                const modal = document.getElementById('module-detail-modal');
                if (!modal) {
                    console.error('未找到模块详情模态框');
                    return;
                }
                
                // 更新模态框标题和内容
                document.getElementById('module-detail-modal-label').textContent = title;
                document.getElementById('module-detail-content').innerHTML = html;
                
                // 显示模态框
                const moduleModal = new bootstrap.Modal(modal);
                moduleModal.show();
                
                // 检查是否有表格，如果有则添加导出按钮
                const table = modal.querySelector('table');
                const modalFooter = modal.querySelector('.modal-footer');
                if (table && modalFooter) {
                    // 检查是否已有导出按钮
                    let exportBtn = modalFooter.querySelector('.export-excel-btn');
                    if (!exportBtn) {
                        // 创建导出按钮
                        exportBtn = document.createElement('button');
                        exportBtn.className = 'btn btn-success export-excel-btn';
                        exportBtn.textContent = '导出为EXCEL';
                        // 在关闭按钮后添加导出按钮
                        const closeBtn = modalFooter.querySelector('button[data-bs-dismiss="modal"]');
                        if (closeBtn) {
                            modalFooter.insertBefore(exportBtn, closeBtn.nextSibling);
                        }
                    }
                    // 添加导出按钮的点击事件
                    exportBtn.addEventListener('click', function() {
                        exportTableToExcel(table, title);
                    });
                }
            }
        })
        .catch(error => {
            console.error('获取统计数据失败:', error);
            showToast('获取数据失败：' + error.message, 'error');
        });
}

// 绑定导航事件
function bindNavigationEvents() {
    // 切换到最新排行榜
    if (latestLink) {
        latestLink.addEventListener('click', async (e) => {
            e.preventDefault();
            latestLink.classList.add('active');
            dashboardLink.classList.remove('active');
            historyLink.classList.remove('active');
            
            const latestSection = document.getElementById('latest-section');
            latestSection.style.display = 'block';
            dashboardSection.style.display = 'none';
            historySection.style.display = 'none';
            
            // 确保更新UI，包括显示/隐藏更新按钮
            checkAuthStatus();
            await getLatestTrendingData();
        });
    }
    
    // 切换到仪表盘
    if (dashboardLink) {
        dashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            dashboardLink.classList.add('active');
            latestLink.classList.remove('active');
            historyLink.classList.remove('active');
            
            const latestSection = document.getElementById('latest-section');
            latestSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            historySection.style.display = 'none';
            reportInfo.innerHTML = '';
            
            // 确保更新UI，包括显示/隐藏更新按钮
            checkAuthStatus();
            getStatistics();
        });
    }
    
    // 切换到历史数据
    if (historyLink) {
        historyLink.addEventListener('click', (e) => {
            e.preventDefault();
            historyLink.classList.add('active');
            latestLink.classList.remove('active');
            dashboardLink.classList.remove('active');
            
            const latestSection = document.getElementById('latest-section');
            latestSection.style.display = 'none';
            dashboardSection.style.display = 'none';
            historySection.style.display = 'block';
            reportInfo.innerHTML = '';
            
            // 确保更新UI，包括显示/隐藏更新按钮
            checkAuthStatus();
            getHistoryList();
        });
    }
}

// 绑定更新按钮事件
function bindUpdateButtonEvent() {
    const updateBtn = document.getElementById('update-data-btn');
    if (!updateBtn) {
        console.error('未找到爬取按钮');
        return;
    }
    
    // 绑定更新按钮点击事件监听器
    updateBtn.addEventListener('click', async () => {
        console.log('爬取按钮被点击 - 事件监听器');
        
        // 检查并记录当前认证状态
        checkAuthStatus();
        const { isAuthenticated } = getAuthStatus();
        console.log('点击爬取按钮时的认证状态:', isAuthenticated);
        
        try {
            // 检查认证状态
            if (!isAuthenticated) {
                console.error('认证状态为false，弹出登录框');
                // 只显示登录模态框，不显示Toast提示，避免重复提示
                const loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
                loginModal.show();
                return;
            }
            
            // 调用爬取数据功能
            await crawlTrendingData();
            
        } catch (error) {
            console.error('爬取失败:', error);
            showToast('爬取失败: ' + error.message, 'error');
        }
    });
}

// 获取统计数据
async function getStatistics() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'block';
    }
    
    console.log('尝试获取统计数据...');
    
    try {
        console.log('API路径:', '/api/trending/statistics');
        const response = await fetch(`${API_BASE_URL}/api/trending/statistics`);
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
            
            // 渲染精准度项目榜单
            renderPreciseRankings(statistics);
        } else {
            showToast('获取统计数据失败：' + result.error, 'error');
        }
    } catch (error) {
        showToast('获取统计数据失败：' + error.message, 'error');
    } finally {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

// 更新统计卡片
function updateStatCards(statistics) {
    const totalDaysEl = document.getElementById('total-weeks');
    const totalUniqueProjectsEl = document.getElementById('total-unique-projects');
    const totalUniqueTechnologiesEl = document.getElementById('total-unique-technologies');
    const totalUniqueLanguagesEl = document.getElementById('total-unique-languages');
    
    if (totalDaysEl) {
        totalDaysEl.textContent = statistics.totalDays || 0;
    }
    if (totalUniqueProjectsEl) {
        totalUniqueProjectsEl.textContent = statistics.totalUniqueProjects || 0;
    }
    if (totalUniqueTechnologiesEl) {
        totalUniqueTechnologiesEl.textContent = statistics.totalUniqueTechnologies || 0;
    }
    if (totalUniqueLanguagesEl) {
        totalUniqueLanguagesEl.textContent = statistics.totalUniqueLanguages || 0;
    }
    
    // 最受欢迎项目功能暂时未实现（缺少HTML元素）
}

// 渲染排行榜
function renderProjectRankings(statistics) {
    const projectRankingsEl = document.getElementById('project-rankings');
    if (!projectRankingsEl) return;
    
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

// 渲染精准度项目榜单
function renderPreciseRankings(statistics) {
    const preciseRankingsEl = document.getElementById('precise-rankings');
    if (!preciseRankingsEl) return;
    
    if (!statistics.preciseRankings || statistics.preciseRankings.length === 0) {
        preciseRankingsEl.innerHTML = '<tr><td colspan="5" class="text-center">暂无项目数据</td></tr>';
        return;
    }
    
    // 按最终得分降序排列，取前10个
    const topProjects = statistics.preciseRankings
        .sort((a, b) => b.final_score - a.final_score)
        .slice(0, 10);
    
    // 生成精准度榜单HTML
    const rankingsHtml = topProjects.map((project, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${project.name}</td>
            <td>${project.stars}</td>
            <td>${project.forks}</td>
            <td>${project.final_score.toFixed(4)}</td>
        </tr>
    `).join('');
    
    preciseRankingsEl.innerHTML = rankingsHtml;
}

// 渲染图表
function renderCharts(statistics) {
    // 销毁现有图表
    if (weeklyProjectsChart) weeklyProjectsChart.destroy();
    if (topLanguagesChart) topLanguagesChart.destroy();
    if (topTechnologiesChart) topTechnologiesChart.destroy();
    if (projectCountsChart) projectCountsChart.destroy();
    if (topTopicsChart) topTopicsChart.destroy();
    
    // 确保数据存在，避免空数据导致的错误
    const weeklyProjects = statistics.weeklyProjects || [];
    const topLanguages = statistics.topLanguages || [];
    const techStackTrends = statistics.techStackTrends || [];
    const projectCounts = statistics.projectCounts || [];
    const topTopics = statistics.topTopics || [];
    
    // 每周项目数量趋势图
    renderWeeklyProjectsChart(weeklyProjects);
    
    // 热门编程语言饼图
    renderTopLanguagesChart(topLanguages.slice(0, 8));
    
    // 热门技术栈柱状图
    renderTopTechnologiesChart(techStackTrends.slice(0, 10));
    
    // 项目上榜次数Top 10柱状图
    renderProjectCountsChart(projectCounts.slice(0, 10));
    
    // 热门主题柱状图
    renderTopTopicsChart(topTopics.slice(0, 8));
}

// 渲染每周新上榜项目数量趋势图
function renderWeeklyProjectsChart(data) {
    const ctx = document.getElementById('weekly-projects-chart');
    if (!ctx) return;
    
    const ctx2d = ctx.getContext('2d');
    
    // 获取当前模式
    const isDarkMode = document.body.classList.contains('dark-mode');
    // 获取当前模式的文字颜色
    const textColor = getChartTextColor();
    const gridColor = getChartGridColor();
    
    // 处理空数据
    if (!data || data.length === 0) {
        weeklyProjectsChart = new Chart(ctx2d, {
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
                        color: textColor // 根据当前模式设置图例文字颜色
                    }
                },
                title: {
                    display: true,
                    text: '每周新上榜项目数量趋势',
                    color: textColor // 根据当前模式设置标题文字颜色
                },
                tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                }
            }
        }
        });
        return;
    }
    
    const labels = data.map(item => `${item.year}年第${item.week}周`);
    
    // 使用每周新上榜项目数量
    const newProjectsCounts = data.map(item => item.newProjectsCount || 0);
    
    weeklyProjectsChart = new Chart(ctx2d, {
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
                        color: textColor // 根据当前模式设置Y轴刻度文字颜色
                    },
                    grid: {
                        color: gridColor // 根据当前模式设置Y轴网格线颜色
                    }
                },
                x: {
                    ticks: {
                        color: textColor // 根据当前模式设置X轴刻度文字颜色
                    },
                    grid: {
                        color: gridColor // 根据当前模式设置X轴网格线颜色
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor // 根据当前模式设置图例文字颜色
                    }
                },
                title: {
                    display: true,
                    text: '每周新上榜项目数量趋势',
                    color: textColor // 根据当前模式设置标题文字颜色
                },
                tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                }
            }
        }
    });
}

// 渲染热门编程语言饼图
function renderTopLanguagesChart(data) {
    const ctx = document.getElementById('top-languages-chart');
    if (!ctx) return;
    
    const ctx2d = ctx.getContext('2d');
    
    // 获取当前模式
    const isDarkMode = document.body.classList.contains('dark-mode');
    // 获取当前模式的文字颜色
    const textColor = getChartTextColor();
    
    // 处理空数据
    if (!data || data.length === 0) {
        topLanguagesChart = new Chart(ctx2d, {
            type: 'pie',
            data: {
                labels: ['暂无数据'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#CCCCCC'],
                    borderColor: textColor,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor // 根据当前模式设置图例文字颜色
                        }
                    },
                    title: {
                        display: true,
                        text: '热门编程语言分布',
                        color: textColor // 根据当前模式设置标题文字颜色
                    },
                    tooltip: {
                        titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                        bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
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
    
    topLanguagesChart = new Chart(ctx2d, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: backgroundColors,
                borderColor: textColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor // 根据当前模式设置图例文字颜色
                    }
                },
                title: {
                    display: true,
                    text: '热门编程语言分布',
                    color: textColor // 根据当前模式设置标题文字颜色
                },
                tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)', // 根据当前模式设置工具提示背景颜色
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
    const ctx = document.getElementById('top-technologies-chart');
    if (!ctx) return;
    
    const ctx2d = ctx.getContext('2d');
    
    // 获取当前模式
    const isDarkMode = document.body.classList.contains('dark-mode');
    // 获取当前模式的文字颜色
    const textColor = getChartTextColor();
    const gridColor = getChartGridColor();
    
    // 处理空数据
    if (!data || data.length === 0) {
        topTechnologiesChart = new Chart(ctx2d, {
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
                            color: textColor // 根据当前模式设置图例文字颜色
                        }
                    },
                    title: {
                        display: true,
                        text: '热门技术栈分布',
                        color: textColor // 根据当前模式设置标题文字颜色
                    },
                    tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                }
                }
            }
        });
        return;
    }
    
    const labels = data.map(item => item.name);
    const counts = data.map(item => item.count);
    
    topTechnologiesChart = new Chart(ctx2d, {
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
                        color: textColor // 根据当前模式设置Y轴刻度文字颜色
                    },
                    grid: {
                        color: gridColor // 根据当前模式设置Y轴网格线颜色
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: textColor // 根据当前模式设置X轴刻度文字颜色
                    },
                    grid: {
                        color: gridColor // 根据当前模式设置X轴网格线颜色
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor // 根据当前模式设置图例文字颜色
                    }
                },
                title: {
                    display: true,
                    text: '热门技术栈Top 10',
                    color: textColor // 根据当前模式设置标题文字颜色
                },
                tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                }
            }
        }
    });
}

// 渲染项目上榜次数Top 10柱状图
function renderProjectCountsChart(data) {
    const ctx = document.getElementById('project-counts-chart');
    if (!ctx) return;
    
    const ctx2d = ctx.getContext('2d');
    
    // 获取当前模式
    const isDarkMode = document.body.classList.contains('dark-mode');
    // 获取当前模式的文字颜色
    const textColor = getChartTextColor();
    const gridColor = getChartGridColor();
    
    // 处理空数据
    if (!data || data.length === 0) {
        projectCountsChart = new Chart(ctx2d, {
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
                            color: textColor // 根据当前模式设置图例文字颜色
                        }
                    },
                    title: {
                        display: true,
                        text: '项目上榜次数Top 10',
                        color: textColor // 根据当前模式设置标题文字颜色
                    },
                    tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                }
                }
            }
        });
        return;
    }
    
    const labels = data.map(item => item.name.replace(/.*\//, '')); // 只显示项目名
    const counts = data.map(item => item.count);
    
    projectCountsChart = new Chart(ctx2d, {
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
                        color: textColor // 根据当前模式设置Y轴刻度文字颜色
                    },
                    grid: {
                        color: gridColor // 根据当前模式设置Y轴网格线颜色
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: textColor // 根据当前模式设置X轴刻度文字颜色
                    },
                    grid: {
                        color: gridColor // 根据当前模式设置X轴网格线颜色
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor // 根据当前模式设置图例文字颜色
                    }
                },
                title: {
                    display: true,
                    text: '项目上榜次数Top 10',
                    color: textColor // 根据当前模式设置标题文字颜色
                },
                tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                }
            }
        }
    });
}

// 渲染热门主题柱状图
function renderTopTopicsChart(data) {
    const ctx = document.getElementById('top-topics-chart');
    if (!ctx) return;
    
    const ctx2d = ctx.getContext('2d');
    
    // 获取当前模式
    const isDarkMode = document.body.classList.contains('dark-mode');
    // 获取当前模式的文字颜色
    const textColor = getChartTextColor();
    const gridColor = getChartGridColor();
    
    // 处理空数据
    if (!data || data.length === 0) {
        topTopicsChart = new Chart(ctx2d, {
            type: 'bar',
            data: {
                labels: ['暂无数据'],
                datasets: [{
                    label: '出现次数',
                    data: [0],
                    backgroundColor: 'rgba(108, 117, 125, 0.6)',
                    borderColor: 'rgba(108, 117, 125, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '热门主题分布',
                        color: textColor // 根据当前模式设置标题文字颜色
                    },
                    tooltip: {
                        titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                        bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: gridColor // 根据当前模式设置网格线颜色
                        },
                        ticks: {
                            color: textColor // 根据当前模式设置刻度文字颜色
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textColor, // 根据当前模式设置刻度文字颜色
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
        return;
    }
    
    // 生成随机颜色
    const generateColors = (count) => {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);
            colors.push(`rgba(${r}, ${g}, ${b}, 0.6)`);
        }
        return colors;
    };
    
    const labels = data.map(item => item.name);
    const counts = data.map(item => item.count);
    const backgroundColors = generateColors(data.length);
    const borderColors = backgroundColors.map(color => color.replace('0.6', '1'));
    
    topTopicsChart = new Chart(ctx2d, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: counts,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: '热门主题分布',
                    color: textColor // 根据当前模式设置标题文字颜色
                },
                tooltip: {
                    titleColor: textColor, // 根据当前模式设置工具提示标题颜色
                    bodyColor: textColor, // 根据当前模式设置工具提示内容颜色
                    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' // 根据当前模式设置工具提示背景颜色
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor // 根据当前模式设置网格线颜色
                    },
                    ticks: {
                        color: textColor // 根据当前模式设置刻度文字颜色
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor, // 根据当前模式设置刻度文字颜色
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}



// 导出表格为Excel文件
function exportTableToExcel(table, filename) {
    // 创建一个新的工作簿
    const wb = XLSX.utils.book_new();
    // 将HTML表格转换为工作表
    const ws = XLSX.utils.table_to_sheet(table);
    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    // 将工作簿保存为Excel文件
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

// 暴露全局函数（供HTML调用）
window.showRepoDetail = showRepoDetail;
window.viewWeeklyData = viewWeeklyData;
window.deleteHistoryData = deleteHistoryData;
window.batchDeleteHistoryData = batchDeleteHistoryData;
window.searchHistory = searchHistory;
window.getStatistics = getStatistics;
