from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import subprocess
import sys
import json
import os
import secrets
from datetime import datetime, timedelta
from database import get_db
from app.models import WeeklyReport, Repository
from app.routes.auth import LoginRequest, verify_password, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_PASSWORD_HASH

router = APIRouter()

# 全局变量用于跟踪爬取进度
crawl_progress = {
    "total": 0,
    "completed": 0,
    "current_step": "",
    "status": "idle",  # idle, running, completed, failed
    "message": ""
}

@router.get("/trending/update/progress")
def get_crawl_progress():
    """获取爬取进度"""
    return crawl_progress


@router.post("/trending/update")
def update_trending(login_data: LoginRequest, db: Session = Depends(get_db)):
    """更新趋势数据（调用爬虫脚本）"""
    try:
        # 验证用户名和密码
        is_correct_username = secrets.compare_digest(login_data.username, ADMIN_USERNAME)
        is_correct_password = verify_password(login_data.password, ADMIN_PASSWORD_HASH)
        
        if not (is_correct_username and is_correct_password):
            raise HTTPException(
                status_code=401,
                detail="无效的用户名或密码",
                # 移除 WWW-Authenticate 头，避免触发浏览器原生登录对话框
            )
        
        # 重置进度
        global crawl_progress
        crawl_progress = {
            "total": 10,  # 假设每次爬取10个项目
            "completed": 0,
            "current_step": "初始化",
            "status": "running",
            "message": "开始爬取GitHub趋势数据..."
        }
        
        # 获取当前日期
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        
        # 检查是否已有今日数据
        existing_report = db.query(WeeklyReport).filter(
            WeeklyReport.week_start == date_str
        ).first()
        
        # 更新进度
        crawl_progress["current_step"] = "检查现有数据"
        crawl_progress["message"] = f"检查{date_str}的数据是否存在..."
        
        # 如果数据已存在，先删除现有数据
        if existing_report:
            crawl_progress["message"] = f"{date_str}的数据已经存在，将删除后重新爬取"
            print(crawl_progress["message"])
            # 删除与该报告相关的所有仓库数据
            db.query(Repository).filter(Repository.weekly_report_id == existing_report.id).delete()
            # 删除报告本身
            db.delete(existing_report)
            db.commit()
        
        # 调用Python爬虫脚本
        crawl_progress["current_step"] = "调用爬虫脚本"
        crawl_progress["message"] = "正在调用Python爬虫脚本..."
        print("调用Python爬虫脚本...")
        script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "python_crawler.py")
        
        # 创建临时文件用于保存进度
        progress_file = "crawl_progress.log"
        
        # 执行爬虫脚本并将输出保存到临时文件
        print("开始执行爬虫脚本...")
        # 使用明确的 python3 命令，避免 sys.executable 指向 uwsgi 导致的参数冲突
        result = subprocess.run(
            ["python3", script_path, "--limit", "10", "--since", "daily"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            check=False  # 允许脚本返回非零退出码
        )
        print("爬虫脚本执行完成，退出码:", result.returncode)
        
        # 检查脚本执行结果
        if result.returncode != 0:
            crawl_progress["status"] = "failed"
            crawl_progress["message"] = f"爬虫脚本执行失败: {result.stderr}"
            print(f"爬虫脚本执行失败: {result}")
            print(f"错误输出: {result.stderr}")
            # 仍然继续执行，尝试处理可能已经生成的数据
        
        # 更新进度
        crawl_progress["current_step"] = "保存数据到数据库"
        crawl_progress["message"] = "正在将数据保存到数据库..."
        crawl_progress["completed"] = 8
        
        print(f"爬虫脚本输出: {result.stdout}")
        
        # 检查爬虫脚本是否成功执行
        if result.returncode != 0:
            # 爬虫脚本执行失败
            crawl_progress["current_step"] = "爬取失败"
            crawl_progress["completed"] = 10
            crawl_progress["status"] = "failed"
            crawl_progress["message"] = f"爬虫脚本执行失败: {result.stderr}"
            
            print(f"爬虫脚本执行失败: {result.stderr}")
            
            # 返回失败信息，但不抛出异常
            return {"success": False, "message": "爬虫脚本执行失败", "error": result.stderr}
        
        # 读取爬虫生成的JSON数据
        json_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "current.json")
        print(f"读取JSON文件: {json_file_path}")
        
        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            print(f"成功读取JSON文件，包含的字段: {list(json_data.keys())}")
        except Exception as e:
            # 读取JSON文件失败
            crawl_progress["current_step"] = "读取数据失败"
            crawl_progress["completed"] = 10
            crawl_progress["status"] = "failed"
            crawl_progress["message"] = f"读取JSON文件失败: {str(e)}"
            
            print(f"读取JSON文件失败: {str(e)}")
            
            # 返回失败信息，但不抛出异常
            return {"success": False, "message": "读取JSON文件失败", "error": str(e)}
        
        # 创建WeeklyReport对象
        # 强制使用正确的报告标题格式，确保与爬虫脚本生成的报告标题格式一致
        print("开始创建WeeklyReport对象...")
        today = now.strftime('%Y%m%d')
        report_title = f"GitHub趋势报告{today}"
        print(f"最终使用的report_title: {report_title}")
        print(f"JSON数据中的generation_date: {json_data.get('generation_date', '未设置')}")
        print(f"JSON数据中的data长度: {len(json_data.get('data', []))}")
        
        weekly_report = WeeklyReport(
            year=now.year,
            week=now.isocalendar()[1],
            report_title=report_title,
            week_start=date_str,
            week_end=date_str,
            total_repositories=len(json_data["data"]),
            generation_date=datetime.fromisoformat(json_data["generation_date"])
        )
        
        # 保存周报到数据库
        db.add(weekly_report)
        db.flush()  # 获取主键ID
        
        # 保存每个仓库到数据库
        for i, repo_data in enumerate(json_data["data"]):
            # 更新进度
            crawl_progress["completed"] = 8 + int((i + 1) * 2 / len(json_data["data"]))
            crawl_progress["message"] = f"正在保存仓库数据 ({i+1}/{len(json_data['data'])})..."
            
            # 解析仓库数据
            owner_name = repo_data["owner"]["login"] if "owner" in repo_data and repo_data["owner"] else ""
            avatar_url = repo_data["owner"]["avatar_url"] if "owner" in repo_data and repo_data["owner"] else ""
            
            # 检查仓库是否已存在
            existing_repo = db.query(Repository).filter(
                Repository.full_name == repo_data["full_name"]
            ).first()
            
            if existing_repo:
                # 如果仓库已存在，更新其信息
                existing_repo.name = repo_data["name"]
                existing_repo.owner = owner_name
                existing_repo.avatar_url = avatar_url
                existing_repo.stars = repo_data["stargazers_count"] if "stargazers_count" in repo_data else 0
                existing_repo.forks = repo_data["forks_count"] if "forks_count" in repo_data else 0
                existing_repo.issues = repo_data["open_issues_count"] if "open_issues_count" in repo_data else 0
                existing_repo.watchers = repo_data["watchers_count"] if "watchers_count" in repo_data else 0
                existing_repo.description = repo_data["description"]
                existing_repo.html_url = repo_data["html_url"]
                existing_repo.language = repo_data["language"]
                existing_repo.primary_language = repo_data["primary_language"]
                existing_repo.languages = repo_data["languages"]
                existing_repo.tech_stack = repo_data["tech_stack"]
                existing_repo.topics = repo_data["topics"]
                existing_repo.created_at = datetime.fromisoformat(repo_data["created_at"].replace("Z", "")) if "created_at" in repo_data else None
                existing_repo.updated_at = datetime.fromisoformat(repo_data["updated_at"].replace("Z", "")) if "updated_at" in repo_data else None
                existing_repo.pushed_at = datetime.fromisoformat(repo_data["pushed_at"].replace("Z", "")) if "pushed_at" in repo_data else None
                existing_repo.weekly_report_id = weekly_report.id
                existing_repo.rank = i + 1
            else:
                # 如果仓库不存在，创建新记录
                repository = Repository(
                    full_name=repo_data["full_name"],
                    name=repo_data["name"],
                    owner=owner_name,
                    avatar_url=avatar_url,
                    stars=repo_data["stargazers_count"] if "stargazers_count" in repo_data else 0,
                    forks=repo_data["forks_count"] if "forks_count" in repo_data else 0,
                    issues=repo_data["open_issues_count"] if "open_issues_count" in repo_data else 0,
                    watchers=repo_data["watchers_count"] if "watchers_count" in repo_data else 0,
                    description=repo_data["description"],
                    html_url=repo_data["html_url"],
                    language=repo_data["language"],
                    primary_language=repo_data["primary_language"],
                    languages=repo_data["languages"],
                    tech_stack=repo_data["tech_stack"],
                    topics=repo_data["topics"],
                    created_at=datetime.fromisoformat(repo_data["created_at"].replace("Z", "")) if "created_at" in repo_data else None,
                    updated_at=datetime.fromisoformat(repo_data["updated_at"].replace("Z", "")) if "updated_at" in repo_data else None,
                    pushed_at=datetime.fromisoformat(repo_data["pushed_at"].replace("Z", "")) if "pushed_at" in repo_data else None,
                    weekly_report_id=weekly_report.id,
                    rank=i + 1
                )
                db.add(repository)
        
        # 提交所有更改
        db.commit()
        
        # 更新进度
        crawl_progress["current_step"] = "爬取完成"
        crawl_progress["completed"] = 10
        crawl_progress["status"] = "completed"
        crawl_progress["message"] = f"{date_str}的数据爬取完成！"
        
        print(f"{date_str}的数据爬取完成！")
        
        return {"success": True, "message": "数据爬取完成", "output": result.stdout}
    
    except subprocess.CalledProcessError as e:
        crawl_progress["status"] = "failed"
        crawl_progress["message"] = f"爬虫脚本执行失败: {e.stderr}"
        print(f"爬虫脚本执行失败: {e}")
        print(f"错误输出: {e.stderr}")
        raise HTTPException(status_code=500, detail=f"爬虫脚本执行失败: {e.stderr}")
    except HTTPException:
        crawl_progress["status"] = "failed"
        crawl_progress["message"] = "请求失败"
        raise
    except Exception as e:
        crawl_progress["status"] = "failed"
        crawl_progress["message"] = str(e)
        print(f"更新失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
