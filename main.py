#!/usr/bin/env python3
"""
GitHub Trending FastAPI 后端
"""

import os
import logging
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 导入数据库配置
from database import Base, engine, get_db

# 导入所有模型，确保表结构被正确注册
from app.models import WeeklyReport, Repository, RepositoryImage, AISummary, RepositoryStatistic

# 初始化数据库 - 创建所有表
Base.metadata.create_all(bind=engine)

# 初始化数据函数
def init_data():
    """初始化数据，从JSON文件导入"""
    from database import SessionLocal
    import json
    import os
    from datetime import datetime, timedelta
    
    db = SessionLocal()
    try:
        # 检查是否已有数据
        report_count = db.query(WeeklyReport).count()
        if report_count > 0:
            logger.info(f"数据库已有 {report_count} 条周报数据，跳过初始化")
            return
        
        logger.info("数据库为空，开始从JSON文件导入数据...")
        
        # 检查JSON文件是否存在
        json_files = [
            "data/current.json",
            "data/trending-repos.json"
        ]
        
        json_file_path = None
        for file_path in json_files:
            if os.path.exists(file_path):
                json_file_path = file_path
                break
        
        if not json_file_path:
            logger.warning("未找到JSON数据文件，跳过数据初始化")
            return
        
        logger.info(f"使用JSON文件: {json_file_path}")
        
        # 读取JSON数据
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 创建日报记录
        today = datetime.now()
        year = today.year
        month = today.month
        day = today.day
        report_title = f"GitHub趋势排行榜 - {year}年{month}月{day}日"
        
        # 使用当天日期作为报告日期
        report_date = today.strftime("%Y-%m-%d")
        
        # 解析生成日期
        generation_date_str = data.get('generation_date', today.isoformat())
        if '.' in generation_date_str:
            generation_date_str = generation_date_str.split('.')[0] + 'Z'
        generation_date = datetime.fromisoformat(generation_date_str.replace('Z', '+00:00'))
        
        # 假设使用 WeeklyReport 模型存储日报数据
        # 后续可以考虑创建 DailyReport 模型
        daily_report = WeeklyReport(
            year=year,
            week=today.isocalendar()[1],  # 保留周信息，便于统计
            report_title=report_title,
            week_start=report_date,  # 使用当天日期作为开始日期
            week_end=report_date,  # 使用当天日期作为结束日期
            total_repositories=data.get('total_repositories', len(data.get('data', []))),
            generation_date=generation_date,
            next_update=generation_date
        )
        db.add(daily_report)
        db.flush()
        
        logger.info(f"创建日报记录：{daily_report.report_title}")
        
        # 导入仓库数据
        repositories = data.get('data', data.get('repositories', []))
        for i, repo_data in enumerate(repositories):
            # 解析日期字段
            created_at = datetime.fromisoformat(repo_data.get('created_at', datetime.now().isoformat()).replace('Z', '+00:00'))
            updated_at = datetime.fromisoformat(repo_data.get('updated_at', datetime.now().isoformat()).replace('Z', '+00:00'))
            pushed_at = datetime.fromisoformat(repo_data.get('pushed_at', datetime.now().isoformat()).replace('Z', '+00:00'))
            
            # 创建仓库记录
            repository = Repository(
                full_name=repo_data.get('full_name', f"unknown/repo{i}"),
                name=repo_data.get('name', f"repo{i}"),
                owner=repo_data.get('owner', {}).get('login', 'unknown'),
                avatar_url=repo_data.get('owner', {}).get('avatar_url', ''),
                stars=repo_data.get('stargazers_count', repo_data.get('stars', 0)),
                forks=repo_data.get('forks_count', repo_data.get('forks', 0)),
                issues=repo_data.get('open_issues_count', repo_data.get('issues', 0)),
                watchers=repo_data.get('watchers_count', repo_data.get('watchers', 0)),
                description=repo_data.get('description', ''),
                homepage=repo_data.get('homepage', ''),
                clone_url=repo_data.get('html_url', '') + '.git',
                ssh_url='git@github.com:' + repo_data.get('full_name', f"unknown/repo{i}") + '.git',
                html_url=repo_data.get('html_url', ''),
                language=repo_data.get('language', ''),
                primary_language=repo_data.get('primary_language', repo_data.get('language', '')),
                languages=repo_data.get('languages', []),
                tech_stack=repo_data.get('tech_stack', []),
                topics=repo_data.get('topics', []),
                created_at=created_at,
                updated_at=updated_at,
                pushed_at=pushed_at,
                weekly_report_id=daily_report.id,
                rank=i + 1,
                activity_score=0,
                popularity_score=0,
                freshness_score=0,
                overall_score=0,
                trend_status='new',
                star_change=0,
                rank_change=0,
                is_new=1,
                last_week_rank=None,
                last_week_stars=None
            )
            db.add(repository)
            db.flush()
            
            # 导入图片数据
            if repo_data.get('image_info'):
                image_info = repo_data['image_info']
                if image_info.get('images'):
                    for j, img in enumerate(image_info['images']):
                        img_filename = img.get('filename', f"image_{j+1}.png")
                        img_path = os.path.join(
                            image_info.get('image_dir', ''),
                            img_filename
                        )
                        
                        repository_image = RepositoryImage(
                            repository_id=repository.id,
                            filename=img_filename,
                            filepath=img_path,
                            original_url=img.get('url', ''),
                            absolute_url=img_path,
                            is_representative=j == 0
                        )
                        db.add(repository_image)
        
        # 提交事务
        db.commit()
        logger.info(f"数据初始化完成，共导入 {len(repositories)} 个仓库")
        
    except Exception as e:
        db.rollback()
        logger.error(f"数据初始化失败: {e}")
    finally:
        db.close()

# 初始化数据
init_data()

# 创建FastAPI应用
app = FastAPI(
    title="GitHub Trending API",
    description="GitHub趋势排行榜API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 导入路由
from app.routes import trending, statistics, update, auth

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(trending.router, prefix="/api/trending", tags=["trending"])
app.include_router(statistics.router, prefix="/api", tags=["statistics"])
app.include_router(update.router, prefix="/api/update", tags=["update"])

# 静态文件服务
app.mount("/", StaticFiles(directory="public", html=True), name="public")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
