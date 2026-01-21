#!/usr/bin/env python3
"""
GitHub 趋势数据每日定时更新脚本

此脚本用于每日自动登录并爬取 GitHub 趋势数据，
可以在 PythonAnywhere 上设置为定时任务。

使用 Playwright 模拟完整的浏览器操作流程：
1. 进入公共页面
2. 登录管理员账号
3. 进入历史数据页面
4. 点击爬取数据按钮
"""

import logging
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('daily_update.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 导入配置模块
from config import base_url
import os

# 配置信息
BASE_URL = base_url

# 管理员账号信息
# 从环境变量中获取，默认值作为 fallback
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'xiajta')

def update_trending_data():
    """更新趋势数据"""
    logger.info(f"开始更新 GitHub 趋势数据: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    browser = None
    page = None
    
    try:
        # 启动 Playwright
        with sync_playwright() as p:
            # 配置浏览器
            browser = p.chromium.launch(
                headless=True,  # 无头模式，适合服务器运行
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--window-size=1920,1080'
                ]
            )
            logger.info("浏览器启动完成")
            
            # 创建新页面
            page = browser.new_page()
            page.set_default_timeout(60000)  # 设置默认超时时间为60秒
            logger.info("新页面创建完成")
            
            # 1. 进入公共页面
            logger.info(f"访问首页: {BASE_URL}")
            page.goto(BASE_URL)
            page.wait_for_load_state('networkidle', timeout=60000)
            logger.info("首页加载完成")
            
            # 2. 点击登录按钮
            logger.info("查找并点击登录按钮")
            try:
                # 等待登录按钮出现并点击
                login_button = page.locator('#admin-login-btn')
                login_button.wait_for(state='visible', timeout=30000)
                login_button.click()
                logger.info("登录按钮点击成功")
            except Exception as e:
                logger.error(f"找不到登录按钮: {e}")
                # 尝试查找其他可能的登录按钮
                try:
                    # 查找所有按钮，看是否有包含"登录"的
                    buttons = page.locator('button')
                    count = buttons.count()
                    for i in range(count):
                        button = buttons.nth(i)
                        text = button.inner_text()
                        if "登录" in text:
                            button.click()
                            logger.info(f"找到并点击了包含'登录'的按钮: {text}")
                            break
                except Exception as inner_e:
                    logger.error(f"查找登录按钮失败: {inner_e}")
            
            # 等待登录模态框出现并完全加载
            logger.info("等待登录模态框出现")
            page.wait_for_timeout(5000)  # 增加等待时间
            
            # 3. 填写登录表单
            logger.info("填写登录表单")
            try:
                # 使用更具体的定位器，只选择第一个匹配的元素
                username_input = page.locator('#login-modal #username').first
                username_input.wait_for(state='visible', timeout=30000)
                logger.info("找到用户名输入框")
                username_input.fill(ADMIN_USERNAME)
                logger.info(f"用户名输入完成: {ADMIN_USERNAME}")
                
                # 使用更具体的定位器，只选择第一个匹配的元素
                password_input = page.locator('#login-modal #password').first
                password_input.wait_for(state='visible', timeout=30000)
                logger.info("找到密码输入框")
                password_input.fill(ADMIN_PASSWORD)
                logger.info("密码输入完成")
                
                # 使用更具体的定位器，只选择第一个匹配的元素
                submit_button = page.locator('#login-modal button[type="submit"]').first
                submit_button.wait_for(state='visible', timeout=30000)
                logger.info("找到登录提交按钮")
                submit_button.click()
                logger.info("登录表单提交成功")
            except Exception as e:
                logger.error(f"填写登录表单失败: {e}")
            
            # 等待登录完成和页面刷新
            page.wait_for_load_state('networkidle', timeout=60000)
            logger.info("登录完成，页面刷新成功")
            
            # 4. 进入历史数据页面
            logger.info("进入历史数据页面")
            try:
                # 等待历史数据链接出现并点击
                history_link = page.locator('#history-link')
                history_link.wait_for(state='visible', timeout=30000)
                history_link.click()
                logger.info("历史数据页面进入成功")
            except Exception as e:
                logger.error(f"进入历史数据页面失败: {e}")
            
            # 等待历史数据页面加载
            page.wait_for_load_state('networkidle', timeout=60000)
            logger.info("历史数据页面加载完成")
            
            # 5. 点击爬取数据按钮
            logger.info("查找并点击爬取数据按钮")
            try:
                # 等待爬取数据按钮出现并点击
                update_button = page.locator('#update-data-btn')
                update_button.wait_for(state='visible', timeout=30000)
                update_button.click()
                logger.info("爬取数据按钮点击成功")
            except Exception as e:
                logger.error(f"找不到爬取数据按钮: {e}")
                # 尝试查找其他可能的爬取按钮
                try:
                    # 查找所有按钮，看是否有包含"爬取"或"更新"的
                    buttons = page.locator('button')
                    count = buttons.count()
                    for i in range(count):
                        button = buttons.nth(i)
                        text = button.inner_text()
                        if "爬取" in text or "更新" in text:
                            button.click()
                            logger.info(f"找到并点击了包含'爬取'或'更新'的按钮: {text}")
                            break
                except Exception as inner_e:
                    logger.error(f"查找爬取按钮失败: {inner_e}")
            
            # 6. 等待爬取完成
            logger.info("等待爬取过程完成")
            # 最多等待20分钟
            max_wait_time = 1200  # 20分钟
            start_time = time.time()
            
            while time.time() - start_time < max_wait_time:
                try:
                    # 检查是否有爬取完成的提示
                    toast_elements = page.locator('.toast')
                    count = toast_elements.count()
                    for i in range(count):
                        toast = toast_elements.nth(i)
                        text = toast.inner_text()
                        if "成功" in text or "完成" in text:
                            logger.info(f"爬取完成提示: {text}")
                            break
                    
                    # 检查爬取按钮状态
                    try:
                        update_button = page.locator('#update-data-btn')
                        if update_button.is_visible():
                            text = update_button.inner_text()
                            if "爬取中" not in text:
                                logger.info(f"爬取按钮状态已恢复: {text}，爬取可能已完成")
                                break
                    except:
                        pass
                    
                    time.sleep(10)  # 每10秒检查一次
                except Exception as e:
                    logger.error(f"检查爬取状态失败: {e}")
                    time.sleep(10)
            
            if time.time() - start_time >= max_wait_time:
                logger.warning("爬取时间超过20分钟，可能仍在进行中")
            

            
            # 关闭浏览器
            browser.close()
            logger.info("浏览器已关闭")
        
    except Exception as e:
        logger.error(f"更新过程中发生错误: {e}", exc_info=True)
    finally:
        # 确保浏览器关闭
        if browser:
            try:
                browser.close()
                logger.info("浏览器已关闭")
            except Exception as e:
                logger.error(f"关闭浏览器失败: {e}")
    
    logger.info(f"更新任务完成: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    update_trending_data()
