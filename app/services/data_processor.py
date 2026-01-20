import os
import logging
from datetime import datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

class DataProcessor:
    def __init__(self):
        pass
    
    def calculate_activity_score(self, repo):
        """计算活跃度评分"""
        now = datetime.now()
        pushed_at = datetime.strptime(repo["pushed_at"], "%Y-%m-%dT%H:%M:%SZ")
        days_since_last_push = (now - pushed_at).days
        
        # 最近推送得分 (50%)
        push_score = max(0, 100 - days_since_last_push * 2)
        
        # Issues活跃度得分 (30%)
        issues_score = min(100, repo.get("open_issues_count", 0) * 2)
        
        # Fork活跃度得分 (20%)
        fork_score = min(100, repo.get("forks_count", 0) / 10)
        
        return round(push_score * 0.5 + issues_score * 0.3 + fork_score * 0.2)
    
    def calculate_popularity_score(self, repo):
        """计算受欢迎程度评分"""
        import math
        
        # Stars权重最高 (60%)
        stars = repo.get("stargazers_count", 0)
        stars_score = min(100, math.log10(stars + 1) * 20)
        
        # Forks得分 (25%)
        forks = repo.get("forks_count", 0)
        forks_score = min(100, math.log10(forks + 1) * 25)
        
        # Watchers得分 (15%)
        watchers = repo.get("watchers_count", 0)
        watchers_score = min(100, math.log10(watchers + 1) * 30)
        
        return round(stars_score * 0.6 + forks_score * 0.25 + watchers_score * 0.15)
    
    def calculate_freshness_score(self, repo):
        """计算新鲜度评分"""
        now = datetime.now()
        created_at = datetime.strptime(repo["created_at"], "%Y-%m-%dT%H:%M:%SZ")
        
        # 计算项目年龄（天）
        age_days = (now - created_at).days
        
        # 新鲜度评分随时间递减
        if age_days <= 30:
            return 100
        elif age_days <= 90:
            return 80
        elif age_days <= 180:
            return 60
        elif age_days <= 365:
            return 40
        else:
            return 20
    
    def calculate_overall_score(self, repo):
        """计算综合评分"""
        activity_score = repo.get("activity_score", 0)
        popularity_score = repo.get("popularity_score", 0)
        freshness_score = repo.get("freshness_score", 0)
        
        return round(activity_score * 0.3 + popularity_score * 0.5 + freshness_score * 0.2)
    
    def process_repo_data(self, repo):
        """处理单个仓库数据"""
        processed_data = {
            "full_name": repo["full_name"],
            "name": repo["name"],
            "owner": repo["owner"]["login"],
            "avatar_url": repo["owner"]["avatar_url"],
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "issues": repo.get("open_issues_count", 0),
            "watchers": repo.get("watchers_count", 0),
            "description": repo.get("description"),
            "homepage": repo.get("homepage"),
            "clone_url": repo.get("clone_url"),
            "ssh_url": repo.get("ssh_url"),
            "html_url": repo.get("html_url"),
            "language": repo.get("language"),
            "primary_language": repo.get("language"),
            "languages": {},  # 这里需要单独获取
            "tech_stack": [],  # 这里需要单独获取
            "topics": repo.get("topics", []),
            "created_at": datetime.strptime(repo["created_at"], "%Y-%m-%dT%H:%M:%SZ"),
            "updated_at": datetime.strptime(repo["updated_at"], "%Y-%m-%dT%H:%M:%SZ"),
            "pushed_at": datetime.strptime(repo["pushed_at"], "%Y-%m-%dT%H:%M:%SZ"),
            "activity_score": self.calculate_activity_score(repo),
            "popularity_score": self.calculate_popularity_score(repo),
            "freshness_score": self.calculate_freshness_score(repo),
            "overall_score": 0
        }
        
        processed_data["overall_score"] = self.calculate_overall_score(processed_data)
        
        return processed_data
    
    def add_trend_analysis(self, current_repos, last_week_data, db: Session):
        """添加趋势分析"""
        if not last_week_data:
            # 如果没有历史数据，所有当前仓库都是新项目
            for repo in current_repos:
                repo["trend"] = {
                    "status": "new",
                    "star_change": 0,
                    "rank_change": 0,
                    "is_new": True
                }
            return current_repos
        
        # 构建上一周仓库的映射
        last_week_map = {repo.full_name: repo for repo in last_week_data}
        
        for repo in current_repos:
            if repo["full_name"] in last_week_map:
                last_week_repo = last_week_map[repo["full_name"]]
                star_change = repo["stars"] - last_week_repo.stars
                rank_change = last_week_repo.rank - repo["rank"]
                
                if rank_change > 0:
                    status = "rising"
                elif rank_change < 0:
                    status = "falling"
                else:
                    status = "stable"
                
                repo["trend"] = {
                    "status": status,
                    "star_change": star_change,
                    "rank_change": rank_change,
                    "is_new": False,
                    "last_week_rank": last_week_repo.rank,
                    "last_week_stars": last_week_repo.stars
                }
            else:
                # 新项目
                repo["trend"] = {
                    "status": "new",
                    "star_change": 0,
                    "rank_change": 0,
                    "is_new": True
                }
        
        return current_repos
    
    def calculate_statistics(self, repos):
        """计算统计信息"""
        total_stars = sum(repo["stars"] for repo in repos)
        total_forks = sum(repo["forks"] for repo in repos)
        
        # 语言统计
        language_counts = {}
        for repo in repos:
            language = repo.get("primary_language", "Unknown")
            language_counts[language] = language_counts.get(language, 0) + 1
        
        # 技术栈统计
        tech_stack_counts = {}
        for repo in repos:
            for tech in repo.get("tech_stack", []):
                tech_stack_counts[tech] = tech_stack_counts.get(tech, 0) + 1
        
        # 计算平均值
        count = len(repos)
        average_stars = total_stars // count if count > 0 else 0
        average_forks = total_forks // count if count > 0 else 0
        
        return {
            "total_stars": total_stars,
            "total_forks": total_forks,
            "average_stars": average_stars,
            "average_forks": average_forks,
            "top_languages": sorted(language_counts.items(), key=lambda x: x[1], reverse=True)[:8],
            "top_technologies": sorted(tech_stack_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        }
