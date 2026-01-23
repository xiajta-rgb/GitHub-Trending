// 显示模块详情
console.log('dashboard-detail.js 加载成功');

// 全局函数，供其他脚本调用
window.showModuleDetail = function(moduleType) {
    console.log('显示模块详情:', moduleType);
    
    // 获取统计数据
    fetch(`${API_BASE_URL}/api/trending/statistics`)  // 直接使用相对路径
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
                
                // 创建模态框
                const modal = document.createElement('div');
                modal.className = 'modal fade';
                modal.id = 'module-modal';
                modal.tabIndex = '-1';
                modal.role = 'dialog';
                modal.setAttribute('aria-labelledby', 'module-modal-label');
                modal.setAttribute('aria-hidden', 'true');
                
                modal.innerHTML = `
                        <div class="modal-dialog modal-lg" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="module-modal-label">${title}</h5>
                                </div>
                                <div class="modal-body">
                                    ${html}
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                                    <button type="button" class="btn btn-success export-excel-btn">导出为EXCEL</button>
                                </div>
                            </div>
                        </div>
                    `;
                
                // 添加到DOM
                document.body.appendChild(modal);
                
                // 显示模态框
                    const moduleModal = new bootstrap.Modal(modal);
                    moduleModal.show();
                    
                    // 添加导出为EXCEL按钮的事件监听器
                    modal.querySelector('.export-excel-btn').addEventListener('click', function() {
                        const table = modal.querySelector('table');
                        if (table) {
                            exportTableToExcel(table, title);
                        }
                    });
                    
                    // 监听模态框关闭事件，移除模态框
                    modal.addEventListener('hidden.bs.modal', function () {
                        setTimeout(() => {
                            document.body.removeChild(modal);
                        }, 100);
                    });
            }
        })
        .catch(error => {
            console.error('获取统计数据失败:', error);
            showToast('获取数据失败：' + error.message, 'error');
        });
};

console.log('showModuleDetail 函数已定义:', typeof window.showModuleDetail);
