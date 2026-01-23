// 环境配置模块
// 自动检测当前环境，根据页面 URL 判断
const currentUrl = window.location.origin;
const isProduction = currentUrl === 'https://trend.pythonanywhere.com';
const isLocal = currentUrl === 'http://localhost:8000' || currentUrl === 'http://127.0.0.1:8000';

// 根据环境设置 API 基础 URL
let API_BASE_URL;
if (isProduction) {
    API_BASE_URL = 'https://trend.pythonanywhere.com';
} else if (isLocal) {
    API_BASE_URL = currentUrl;
} else {
    // 默认使用本地环境
    API_BASE_URL = 'http://localhost:8000';
}

console.log('当前环境:', isProduction ? '生产环境' : '本地环境');
console.log('API 基础 URL:', API_BASE_URL);

// 导出环境配置
export {
    currentUrl,
    isProduction,
    isLocal,
    API_BASE_URL
};