// 认证管理模块
import { API_BASE_URL } from './env.js';

// 认证状态管理
let isAuthenticated = false;
let adminUser = null;

// DOM 元素
let loginModal, loginForm, loginError, adminLoginBtn, adminLogoutBtn, adminLogoutItem, adminUsername;

// 初始化认证模块
export function initAuth() {
    // 获取DOM元素
    loginModal = new bootstrap.Modal(document.getElementById('login-modal'));
    loginForm = document.getElementById('login-form');
    loginError = document.getElementById('login-error');
    adminLoginBtn = document.getElementById('admin-login-btn');
    adminLogoutBtn = document.getElementById('admin-logout-btn');
    adminLogoutItem = document.getElementById('admin-logout-item');
    adminUsername = document.getElementById('admin-username');
    
    // 绑定事件
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', handleLogout);
    }
    
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            console.log('管理员登录按钮被点击');
            loginModal.show();
        });
    }
    
    // 检查认证状态
    checkAuthStatus();
}

// 检查认证状态
export function checkAuthStatus() {
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
export function updateAuthUI() {
    if (isAuthenticated && adminUser) {
        // 登录状态：隐藏登录按钮，显示退出登录按钮
        if (adminLoginBtn) {
            adminLoginBtn.style.display = 'none';
        }
        if (adminLogoutItem) {
            adminLogoutItem.style.display = 'block';
        }
        
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
        // 未登录状态：显示登录按钮，隐藏退出登录按钮
        if (adminLoginBtn) {
            adminLoginBtn.style.display = 'block';
        }
        if (adminLogoutItem) {
            adminLogoutItem.style.display = 'none';
        }
        
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
export function saveAuthStatus(username, password) {
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
export function clearAuthStatus() {
    sessionStorage.removeItem('admin-auth');
    isAuthenticated = false;
    adminUser = null;
    updateAuthUI();
}

// 登录表单提交处理
async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // 获取错误元素（确保DOM已加载）
    const loginError = document.getElementById('login-error');
    if (loginError) {
        loginError.classList.add('d-none');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password }),
            credentials: 'include' // 添加此选项，确保跨域请求能够正确发送认证凭据
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
}

// 登出按钮点击处理
function handleLogout() {
    clearAuthStatus();
    showToast('已成功登出', 'success');
}

// 获取认证状态
export function getAuthStatus() {
    return {
        isAuthenticated,
        adminUser
    };
}

// 获取认证数据（用于需要密码的操作）
export function getAuthData() {
    const authData = sessionStorage.getItem('admin-auth');
    if (authData) {
        try {
            return JSON.parse(authData);
        } catch (e) {
            console.error('认证数据解析失败:', e);
            return null;
        }
    }
    return null;
}

// 导入showToast函数（临时，后续会移到ui模块）
import { showToast } from './ui.js';
