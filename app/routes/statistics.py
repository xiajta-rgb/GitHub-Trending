from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import defaultdict, Counter
from typing import List, Dict, Any
import math
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
                "topTopics": [],
                "weeklyProjects": [],
                "totalWeeks": 0,
                "totalUniqueProjects": 0,
                "totalUniqueTechnologies": 0,
                "totalUniqueLanguages": 0,
                "totalUniqueTopics": 0
            }}
        
        # 初始化统计数据
        seen_projects = set()  # 记录已见过的项目
        seen_technologies = set()  # 记录已见过的技术栈
        seen_languages = set()  # 记录已见过的编程语言
        seen_topics = set()  # 记录已见过的主题
        project_counts = Counter()  # 项目上榜次数统计
        tech_stack_counts = Counter()  # 技术栈出现次数统计
        language_counts = Counter()  # 编程语言出现次数统计
        topic_counts = Counter()  # 主题出现次数统计
        weekly_projects = []  # 每周项目数量统计
        project_last_seen = {}  # 记录项目最后上榜时间
        
        # 按年和周分组统计数据
        weekly_data = defaultdict(lambda: {
            "repos": [],
            "new_projects": set()
        })
        
        # 遍历所有周报，按年和周分组
        for report in reports:
            # 获取该周报下的所有仓库
            repositories = db.query(Repository).filter(
                Repository.weekly_report_id == report.id
            ).all()
            
            # 生成周键 (year, week)
            week_key = (report.year, report.week)
            
            for repo in repositories:
                full_name = repo.full_name
                
                # 添加到周数据中
                weekly_data[week_key]["repos"].append(repo)
                
                # 更新项目上榜次数
                project_counts[full_name] += 1
                
                # 更新项目最后上榜时间
                project_last_seen[full_name] = report.week_start
                
                # 统计新上榜项目（仅在第一次出现时）
                if full_name not in seen_projects:
                    seen_projects.add(full_name)
                    weekly_data[week_key]["new_projects"].add(full_name)
                
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
                
                # 更新主题统计
                if repo.topics:
                    # 处理 topics 可能是字符串的情况
                    topics = repo.topics
                    if isinstance(topics, str):
                        try:
                            import json
                            topics = json.loads(topics)
                        except:
                            topics = []
                    if isinstance(topics, list) and len(topics) > 0:
                        for topic in topics:
                            if topic:
                                topic_counts[topic] += 1
                                seen_topics.add(topic)
        
        # 按年和周排序，生成每周统计数据
        sorted_weeks = sorted(weekly_data.keys(), key=lambda x: (x[0], x[1]))
        for year, week in sorted_weeks:
            week_info = weekly_data[(year, week)]
            # 计算每周的总项目数（去重，因为同一个项目可能在一周内多次上榜）
            unique_projects = set(repo.full_name for repo in week_info["repos"])
            weekly_projects.append({
                "year": year,
                "week": week,
                "projectsCount": len(unique_projects),
                "newProjectsCount": len(week_info["new_projects"])
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
        
        # 收集所有项目的 stars 和 forks 数据，用于精准度榜单
        project_metrics = {}
        
        # 遍历所有仓库，收集 metrics
        for report in reports:
            repositories = db.query(Repository).filter(
                Repository.weekly_report_id == report.id
            ).all()
            
            for repo in repositories:
                full_name = repo.full_name
                if full_name not in project_metrics:
                    project_metrics[full_name] = {
                        "name": repo.name,
                        "full_name": full_name,
                        "stars": repo.stars,
                        "forks": repo.forks,
                        "last_seen": repo.updated_at
                    }
        
        # 计算精准度榜单
        precise_rankings = []
        
        if project_metrics:
            # 步骤1：计算对数变换值
            log_stars = []
            log_forks = []
            
            for project in project_metrics.values():
                log_star = math.log10(project["stars"] + 1)
                log_fork = math.log10(project["forks"] + 1)
                log_stars.append(log_star)
                log_forks.append(log_fork)
                project["log_stars"] = log_star
                project["log_forks"] = log_fork
            
            # 步骤2：计算 Min-Max 标准化值
            if len(log_stars) > 1:
                min_log_star = min(log_stars)
                max_log_star = max(log_stars)
                min_log_fork = min(log_forks)
                max_log_fork = max(log_forks)
                
                for project in project_metrics.values():
                    # 避免除以零
                    if max_log_star > min_log_star:
                        project["normalized_stars"] = (project["log_stars"] - min_log_star) / (max_log_star - min_log_star)
                    else:
                        project["normalized_stars"] = 0
                    
                    if max_log_fork > min_log_fork:
                        project["normalized_forks"] = (project["log_forks"] - min_log_fork) / (max_log_fork - min_log_fork)
                    else:
                        project["normalized_forks"] = 0
                    
                    # 步骤3：计算加权求和得分
                    project["final_score"] = project["normalized_stars"] * 0.4 + project["normalized_forks"] * 0.6
            else:
                # 只有一个项目时，直接赋值
                for project in project_metrics.values():
                    project["normalized_stars"] = 1.0
                    project["normalized_forks"] = 1.0
                    project["final_score"] = 1.0
            
            # 生成精准度榜单，按最终得分降序排序
            precise_rankings = [
                {
                    "name": project["name"],
                    "full_name": project["full_name"],
                    "stars": project["stars"],
                    "forks": project["forks"],
                    "log_stars": round(project["log_stars"], 4),
                    "log_forks": round(project["log_forks"], 4),
                    "normalized_stars": round(project["normalized_stars"], 4),
                    "normalized_forks": round(project["normalized_forks"], 4),
                    "final_score": round(project["final_score"], 4),
                    "last_seen": project["last_seen"]
                }
                for project in sorted(project_metrics.values(), key=lambda x: x["final_score"], reverse=True)
            ]  # 显示所有项目
        
        # 构建最终统计数据
        statistics = {
            "projectCounts": [
                {"name": name, "count": count, "last_seen": project_last_seen[name]}
                for name, count in project_counts.most_common()
            ],
            "techStackTrends": [
                {"name": name, "count": count}
                for name, count in tech_stack_counts.most_common()
            ],
            "topLanguages": [
                {"name": name, "count": count}
                for name, count in language_counts.most_common()
            ],
            "topTopics": [
                {"name": name, "count": count}
                for name, count in topic_counts.most_common()
            ],
            "weeklyProjects": weekly_projects,
            "preciseRankings": precise_rankings,
            "totalWeeks": len(reports),
            "totalDays": total_days,
            "totalUniqueProjects": len(seen_projects),
            "totalUniqueTechnologies": len(seen_technologies),
            "totalUniqueLanguages": len(seen_languages),
            "totalUniqueTopics": len(seen_topics)
        }
        
        return {"success": True, "data": statistics}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
