import os
import requests
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

logger = logging.getLogger(__name__)

class GitHubAPI:
    def __init__(self):
        self.base_url = "https://api.github.com"
        self.token = os.getenv("GITHUB_TOKEN")
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "GitHub-Trending-Bot"
        }
        
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"
    
    def _request(self, endpoint, params=None):
        """发送请求到GitHub API"""
        url = f"{self.base_url}{endpoint}"
        response = requests.get(url, headers=self.headers, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    
    def get_trending_repos(self, since="weekly", language="", limit=10):
        """获取趋势仓库列表"""
        today = datetime.now()
        
        if since == "weekly":
            date = today - timedelta(days=7)
        elif since == "monthly":
            date = today - timedelta(days=30)
        else:  # daily
            date = today - timedelta(days=1)
        
        date_str = date.strftime("%Y-%m-%d")
        query = f"created:>{date_str}"
        
        if language:
            query += f" language:{language}"
        
        params = {
            "q": query,
            "sort": "stars",
            "order": "desc",
            "per_page": limit
        }
        
        try:
            response = self._request("/search/repositories", params=params)
            return response["items"]
        except Exception as e:
            logger.error(f"获取trending repos失败: {e}")
            raise
    
    def get_repo_details(self, owner, repo):
        """获取仓库详细信息"""
        try:
            return self._request(f"/repos/{owner}/{repo}")
        except Exception as e:
            logger.error(f"获取仓库详情失败 {owner}/{repo}: {e}")
            raise
    
    def get_repo_readme(self, owner, repo):
        """获取仓库README内容"""
        try:
            response = self._request(f"/repos/{owner}/{repo}/readme")
            import base64
            return base64.b64decode(response["content"]).decode("utf-8")
        except Exception as e:
            logger.error(f"获取README失败 {owner}/{repo}: {e}")
            return ""
    
    def get_repos_full_info(self, repos):
        """获取多个仓库的完整信息"""
        full_repos = []
        
        for repo in repos:
            try:
                owner = repo["owner"]["login"]
                repo_name = repo["name"]
                full_info = self.get_repo_details(owner, repo_name)
                full_repos.append(full_info)
            except Exception as e:
                logger.error(f"获取仓库完整信息失败 {repo['full_name']}: {e}")
                full_repos.append(repo)  # 使用基础信息作为备选
        
        return full_repos
