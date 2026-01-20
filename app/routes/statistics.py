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
                if repo.tech_stack:
                    for tech in repo.tech_stack:
                        tech_stack_counts[tech] += 1
                        seen_technologies.add(tech)
                
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
            "totalUniqueProjects": len(seen_projects),
            "totalUniqueTechnologies": len(seen_technologies),
            "totalUniqueLanguages": len(seen_languages)
        }
        
        return {"success": True, "data": statistics}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
