#!/usr/bin/env python3
"""
将旧的JSON数据导入到新的SQLite数据库中
"""

import json
import os
from datetime import datetime, timedelta
from database import SessionLocal, engine, Base
from app.models.weekly_report import WeeklyReport
from app.models.repository import Repository
from app.models.ai_summary import AISummary
from app.models.repository_image import RepositoryImage


def import_data(json_file_path):
    """
    从JSON文件导入数据到数据库
    """
    # 读取JSON数据
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 创建周报记录
        year = int(data['year'])
        week = int(data['week'])
        report_title = f"GitHub趋势排行榜 - {year}年第{week}周"
        
        # 计算周开始和结束日期
        # 使用ISO周数计算，确保日期准确性
        week_start = datetime.fromisocalendar(year, week, 1).strftime("%Y-%m-%d")
        week_end = (datetime.fromisocalendar(year, week, 1) + timedelta(days=6)).strftime("%Y-%m-%d")
        
        # 解析生成日期
        generation_date_str = data['generation_date']
        if '.' in generation_date_str:
            generation_date_str = generation_date_str.split('.')[0] + 'Z'
        generation_date = datetime.fromisoformat(generation_date_str.replace('Z', '+00:00'))
        
        weekly_report = WeeklyReport(
            year=year,
            week=week,
            report_title=report_title,
            week_start=week_start,
            week_end=week_end,
            total_repositories=data['total_repositories'],
            generation_date=generation_date,
            next_update=generation_date  # 简单处理，使用生成日期作为下一次更新日期
        )
        db.add(weekly_report)
        db.flush()  # 获取weekly_report的id
        
        print(f"创建周报记录：{weekly_report.report_title}")
        
        # 导入仓库数据
        repositories = data['data']
        for i, repo_data in enumerate(repositories):
            # 解析日期字段
            created_at = datetime.fromisoformat(repo_data['created_at'].replace('Z', '+00:00'))
            updated_at = datetime.fromisoformat(repo_data['updated_at'].replace('Z', '+00:00'))
            pushed_at = datetime.fromisoformat(repo_data['pushed_at'].replace('Z', '+00:00'))
            
            # 创建仓库记录
            repository = Repository(
                full_name=repo_data['full_name'],
                name=repo_data['name'],
                owner=repo_data['owner']['login'],
                avatar_url=repo_data['owner']['avatar_url'],
                stars=repo_data['stargazers_count'],
                forks=repo_data['forks_count'],
                issues=repo_data['open_issues_count'],
                watchers=repo_data['watchers_count'],
                description=repo_data['description'],
                homepage=repo_data.get('homepage', ''),
                clone_url=repo_data['html_url'] + '.git',
                ssh_url='git@github.com:' + repo_data['full_name'] + '.git',
                html_url=repo_data['html_url'],
                language=repo_data['language'],
                primary_language=repo_data['primary_language'],
                languages=repo_data['languages'],
                tech_stack=repo_data['tech_stack'],
                topics=repo_data['topics'],
                created_at=created_at,
                updated_at=updated_at,
                pushed_at=pushed_at,
                weekly_report_id=weekly_report.id,
                rank=i + 1,  # 按顺序设置排名
                activity_score=0,  # 默认值
                popularity_score=0,  # 默认值
                freshness_score=0,  # 默认值
                overall_score=0,  # 默认值
                trend_status='new',  # 默认值
                star_change=0,  # 默认值
                rank_change=0,  # 默认值
                is_new=1,  # 默认值
                last_week_rank=None,  # 默认值
                last_week_stars=None  # 默认值
            )
            db.add(repository)
            db.flush()  # 获取repository的id
            
            print(f"创建仓库记录：{repository.full_name}")
            
            # 导入AI摘要
            # current.json没有ai_summary字段，所以这里跳过
            
            # 导入图片数据（current.json中使用image_info字段）
            if repo_data.get('image_info'):
                image_info = repo_data['image_info']
                
                # 导入图片
                if image_info.get('images') and len(image_info['images']) > 0:
                    for j, img in enumerate(image_info['images']):
                        # 构建图片路径
                        img_filename = img.get('filename', f"image_{j+1}.png")
                        img_path = os.path.join(
                            image_info['image_dir'],
                            img_filename
                        )
                        
                        repository_image = RepositoryImage(
                            repository_id=repository.id,
                            filename=img_filename,
                            filepath=img_path,
                            original_url=img.get('url', ''),
                            absolute_url=img_path,
                            is_representative=j == 0  # 假设第一张图片是代表性图片
                        )
                        db.add(repository_image)
                        print(f"  - 创建图片记录：{img_filename}")
        
        # 提交事务
        db.commit()
        print(f"导入完成，共导入{len(repositories)}个仓库")
        
    except Exception as e:
        db.rollback()
        print(f"导入失败：{str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    
    # 检查是否提供了JSON文件路径
    if len(sys.argv) != 2:
        print("用法：python import_json_data.py <json_file_path>")
        sys.exit(1)
    
    json_file_path = sys.argv[1]
    
    # 检查文件是否存在
    if not os.path.exists(json_file_path):
        print(f"文件不存在：{json_file_path}")
        sys.exit(1)
    
    # 导入数据
    import_data(json_file_path)
