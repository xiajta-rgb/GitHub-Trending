#!/usr/bin/env python3
"""
配置管理模块
统一管理项目的所有配置，包括环境检测和路径配置
"""
import os
import sys

class Config:
    """配置类"""
    def __init__(self):
        # 获取项目根目录
        self.project_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 环境检测
        self.detect_environment()
        
        # 初始化配置
        self.init_config()
    
    def detect_environment(self):
        """检测运行环境"""
        # 根据路径特征判断环境
        is_pythonanywhere = '/home/trend/GitHub-Trending' in self.project_dir
        is_local = not is_pythonanywhere
        
        self.environment = 'pythonanywhere' if is_pythonanywhere else 'local'
        self.is_pythonanywhere = is_pythonanywhere
        self.is_local = is_local
        
        print(f"检测到运行环境: {self.environment}")
    
    def init_config(self):
        """初始化配置"""
        # 数据库配置
        if self.is_pythonanywhere:
            # PythonAnywhere 环境
            self.db_path = '/home/trend/github_trending.db'
            self.base_url = 'https://trend.pythonanywhere.com'
        else:
            # 本地环境
            self.db_path = os.path.join(self.project_dir, 'github_trending.db')
            self.base_url = 'http://localhost:5000'
        
        # 数据库 URL
        self.sqlalchemy_database_url = f"sqlite:///{self.db_path}"
        
        # 爬虫配置
        self.github_api_timeout = 30
        self.crawl_interval = 1  # 爬虫请求间隔（秒）
        
        # 应用配置
        self.app_name = 'GitHub Trending'
        self.app_version = '1.0.0'
        
        # 输出配置信息
        self.print_config()
    
    def print_config(self):
        """打印配置信息"""
        print("\n=== 配置信息 ===")
        print(f"环境: {self.environment}")
        print(f"项目目录: {self.project_dir}")
        print(f"数据库路径: {self.db_path}")
        print(f"数据库 URL: {self.sqlalchemy_database_url}")
        print(f"基础 URL: {self.base_url}")
        print("================\n")

# 创建全局配置实例
config = Config()

# 导出配置变量
environment = config.environment
is_pythonanywhere = config.is_pythonanywhere
is_local = config.is_local
project_dir = config.project_dir
db_path = config.db_path
sqlalchemy_database_url = config.sqlalchemy_database_url
base_url = config.base_url
github_api_timeout = config.github_api_timeout
crawl_interval = config.crawl_interval
app_name = config.app_name
app_version = config.app_version
