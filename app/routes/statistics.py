from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import defaultdict, Counter
from typing import List, Dict, Any
from database import get_db
from app.models import WeeklyReport, Repository

router = APIRouter()

@router.get("/trending/statistics")
def get_statistics(db: Session = Depends(get_db)):
    """获取统计数据"""
    return _get_statistics_data(db)


@router.get("/statistics")
def get_statistics_alt(db: Session = Depends(get_db)):
    """获取统计数据（替代路径）"""
    return _get_statistics_data(db)


def _get_statistics_data(db: Session):
    """获取统计数据"""
    try:
        # 获取所有周报，按时间正序排列
        reports = db.query(WeeklyReport).order_by(
            WeeklyReport.year.asc(), 
            WeeklyReport.week.asc()
        ).all()
        
        if not reports:
            return {"success": True, "data": {
                "projectCounts": [],
                "techStackTrends": [],
                "topLanguages": [],
                "weeklyProjects": [],
                "totalWeeks": 0,
                "totalUniqueProjects": 0,
                "totalUniqueTechnologies": 0,
                "totalUniqueLanguages": 0
            }}
        
        # 初始化统计数据
        seen_projects = set()  # 记录已见过的项目
        seen_technologies = set()  # 记录已见过的技术栈
        seen_languages = set()  # 记录已见过的编程语言
        project_counts = Counter()  # 项目上榜次数统计
        tech_stack_counts = Counter()  # 技术栈出现次数统计
        language_counts = Counter()  # 编程语言出现次数统计
        weekly_projects = []  # 每周项目数量统计
        project_last_seen = {}  # 记录项目最后上榜时间
        
        # 遍历所有周报
        for report in reports:
            # 获取该周报下的所有仓库
            repositories = db.query(Repository).filter(
                Repository.weekly_report_id == report.id
            ).all()
            
            # 统计当前周的数据
            week_repos = []
            new_projects_count = 0  # 新上榜项目数
            
            for repo in repositories:
                full_name = repo.full_name
                week_repos.append(repo)
                
                # 更新项目上榜次数
                project_counts[full_name] += 1
                
                # 更新项目最后上榜时间
                project_last_seen[full_name] = report.week_start
                
                # 统计新上榜项目数
                if full_name not in seen_projects:
                    seen_projects.add(full_name)
                    new_projects_count += 1
                
                # 更新技术栈统计
                # 1. 首先尝试从 tech_stack 中提取
                tech_stack_extracted = False
                if repo.tech_stack:
                    # 处理 tech_stack 可能是字符串的情况
                    tech_stack = repo.tech_stack
                    if isinstance(tech_stack, str):
                        try:
                            import json
                            tech_stack = json.loads(tech_stack)
                        except:
                            tech_stack = []
                    # 确保 tech_stack 是列表
                    if isinstance(tech_stack, list) and len(tech_stack) > 0:
                        for tech in tech_stack:
                            if tech:
                                tech_stack_counts[tech] += 1
                                seen_technologies.add(tech)
                                tech_stack_extracted = True
                
                # 2. 如果 tech_stack 为空，尝试从 languages 字段中提取
                if not tech_stack_extracted and repo.languages:
                    languages = repo.languages
                    if isinstance(languages, str):
                        try:
                            import json
                            languages = json.loads(languages)
                        except:
                            languages = {}
                    if isinstance(languages, dict):
                        # 从 languages 字典中提取键作为技术栈
                        for lang in languages.keys():
                            if lang:
                                tech_stack_counts[lang] += 1
                                seen_technologies.add(lang)
                                tech_stack_extracted = True
                
                # 3. 如果仍然为空，尝试从 primary_language 中提取
                if not tech_stack_extracted and repo.primary_language and repo.primary_language != 'Unknown' and repo.primary_language != 'None':
                    primary_language = repo.primary_language
                    tech_stack_counts[primary_language] += 1
                    seen_technologies.add(primary_language)
                
                # 更新编程语言统计
                if repo.primary_language:
                    language_counts[repo.primary_language] += 1
                    seen_languages.add(repo.primary_language)
            
            # 保存每周统计数据
            weekly_projects.append({
                "year": report.year,
                "week": report.week,
                "projectsCount": len(week_repos),
                "newProjectsCount": new_projects_count
            })
        
        # 计算记录的天数
        if reports:
            # 获取最早和最晚的报告日期
            earliest_date = min(report.week_start for report in reports)
            latest_date = max(report.week_end for report in reports)
            
            # 计算天数差
            from datetime import datetime
            if isinstance(earliest_date, str):
                earliest_date = datetime.strptime(earliest_date, '%Y-%m-%d')
            if isinstance(latest_date, str):
                latest_date = datetime.strptime(latest_date, '%Y-%m-%d')
            
            # 计算天数差（+1 是因为包括开始和结束日期）
            total_days = (latest_date - earliest_date).days + 1
        else:
            total_days = 0
        
        # 构建最终统计数据
        statistics = {
            "projectCounts": [
                {"name": name, "count": count, "last_seen": project_last_seen[name]}
                for name, count in project_counts.most_common(10)
            ],
            "techStackTrends": [
                {"name": name, "count": count}
                for name, count in tech_stack_counts.most_common(10)
            ],
            "topLanguages": [
                {"name": name, "count": count}
                for name, count in language_counts.most_common(10)
            ],
            "weeklyProjects": weekly_projects,
            "totalWeeks": len(reports),
            "totalDays": total_days,
            "totalUniqueProjects": len(seen_projects),
            "totalUniqueTechnologies": len(seen_technologies),
            "totalUniqueLanguages": len(seen_languages)
        }
        
        return {"success": True, "data": statistics}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
