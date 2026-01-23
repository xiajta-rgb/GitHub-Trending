// AI解读模块

// 智谱大模型配置
const ZHIPU_API_NAME = "glm-4.6v-flash";
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_API_KEY = "bd26af9692eba948a3d17f18c7f5c8ac.GkfrAPF60E9Md9xg";

// DOM元素
let aiInterpretBtn, aiInterpretationDiv, aiInterpretationContent, aiInterpretationModal, aiInterpretationModalContent;

// 初始化AI模块
export function initAI() {
    // 获取DOM元素
    aiInterpretBtn = document.getElementById('ai-interpret-btn');
    aiInterpretationDiv = document.getElementById('ai-interpretation');
    aiInterpretationContent = document.getElementById('ai-interpretation-content');
    aiInterpretationModal = new bootstrap.Modal(document.getElementById('ai-interpretation-modal'));
    aiInterpretationModalContent = document.getElementById('ai-interpretation-modal-content');
    
    // 绑定事件
    if (aiInterpretBtn) {
        aiInterpretBtn.addEventListener('click', handleAIInterpret);
    }
}

// 调用智谱大模型进行文字解读
export async function callZhipuModel(prompt, model = ZHIPU_API_NAME) {
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

// 处理AI解读按钮点击
async function handleAIInterpret() {
    if (!window.currentRepositories || window.currentRepositories.length === 0) {
        showToast('暂无项目数据，请先获取数据', 'warning');
        return;
    }
    
    // 显示加载状态
    if (aiInterpretationContent) {
        aiInterpretationContent.innerHTML = '<div class="text-center py-4"><i class="fa fa-spinner fa-spin fa-2x"></i><p class="mt-2">AI正在分析...</p></div>';
    }
    if (aiInterpretationDiv) {
        aiInterpretationDiv.style.display = 'block';
    }
    
    try {
        // 准备提示词
        const prompt = prepareAIPrompt(window.currentRepositories);
        
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
        if (aiInterpretationContent) {
            aiInterpretationContent.innerHTML = `<div class="p-4">${renderedContent}</div>`;
        }
        
        // 同时更新模态框内容
        if (aiInterpretationModalContent) {
            aiInterpretationModalContent.innerHTML = `<div class="p-4">${renderedContent}</div>`;
        }
        
    } catch (error) {
        console.error('AI解读失败:', error);
        if (aiInterpretationContent) {
            aiInterpretationContent.innerHTML = `<div class="alert alert-danger">AI解读失败: ${error.message}</div>`;
        }
        if (aiInterpretationModalContent) {
            aiInterpretationModalContent.innerHTML = `<div class="alert alert-danger">AI解读失败: ${error.message}</div>`;
        }
    }
}

// 准备AI提示词
function prepareAIPrompt(repositories) {
    let prompt = "请分析以下GitHub热门项目，进行功能分类，提供应用建议和趋势解读：\n\n";
    
    // 取前10个项目进行分析
    const topRepos = repositories.slice(0, 10);
    
    topRepos.forEach((repo, index) => {
        prompt += `${index + 1}. ${repo.name}\n`;
        prompt += `   描述：${repo.description || '暂无描述'}\n`;
        prompt += `   Stars：${repo.stars}\n`;
        prompt += `   主要语言：${repo.primary_language || '未知'}\n`;
        if (repo.tech_stack && repo.tech_stack.length > 0) {
            prompt += `   技术栈：${repo.tech_stack.join(', ')}\n`;
        }
        prompt += "\n";
    });
    
    prompt += "请按照以下格式输出分析结果：\n";
    prompt += "1. 整体趋势分析\n";
    prompt += "2. 功能分类（至少3个类别）\n";
    prompt += "3. 技术栈分布\n";
    prompt += "4. 应用建议\n";
    prompt += "5. 未来展望\n";
    
    return prompt;
}

// 导入showToast函数
import { showToast } from './ui.js';
