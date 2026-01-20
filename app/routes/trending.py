from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from app.models import WeeklyReport, Repository
from app.services.github_api import GitHubAPI
from app.services.data_processor import DataProcessor
from app.routes.auth import get_current_admin

router = APIRouter()

@router.get("/latest")
def get_latest_trending(db: Session = Depends(get_db)):
    """获取最新趋势数据"""
    try:
        # 获取最新的周报，按生成日期排序
        latest_report = db.query(WeeklyReport).order_by(
            WeeklyReport.generation_date.desc()
        ).first()
        
        if not latest_report:
            raise HTTPException(status_code=404, detail="未找到最新数据")
        
        # 获取该周报下的所有仓库，按排名排序
        repositories = db.query(Repository).filter(
            Repository.weekly_report_id == latest_report.id
        ).order_by(Repository.rank).all()
        
        # 构建响应数据
        data = {
            "metadata": {
                "report_title": latest_report.report_title,
                "year": latest_report.year,
                "week": latest_report.week,
                "week_range": {
                    "start": latest_report.week_start,
                    "end": latest_report.week_end
                },
                "total_repositories": latest_report.total_repositories,
                "generation_date": latest_report.generation_date.strftime("%Y-%m-%d %H:%M:%S"),
                "next_update": latest_report.next_update
            },
            "repositories": [
                {
                    "rank": repo.rank,
                    "name": repo.name,
                    "full_name": repo.full_name,
                    "owner": repo.owner,
                    "avatar_url": repo.avatar_url,
                    "stars": repo.stars,
                    "forks": repo.forks,
                    "issues": repo.issues,
                    "watchers": repo.watchers,
                    "description": repo.description,
                    "homepage": repo.homepage,
                    "clone_url": repo.clone_url,
                    "ssh_url": repo.ssh_url,
                    "html_url": repo.html_url,
                    "language": repo.language,
                    "primary_language": repo.primary_language,
                    "languages": repo.languages,
                    "tech_stack": repo.tech_stack,
                    "topics": repo.topics,
                    "created_at": repo.created_at,
                    "updated_at": repo.updated_at,
                    "pushed_at": repo.pushed_at,
                    "activity_score": repo.activity_score,
                    "popularity_score": repo.popularity_score,
                    "freshness_score": repo.freshness_score,
                    "overall_score": repo.overall_score,
                    "trend": {
                        "status": repo.trend_status,
                        "star_change": repo.star_change,
                        "rank_change": repo.rank_change,
                        "is_new": bool(repo.is_new),
                        "last_week_rank": repo.last_week_rank,
                        "last_week_stars": repo.last_week_stars
                    },
                    # 处理图片信息
                    "images": {
                        "total_count": len(repo.images),
                        "image_list": [
                            {
                                "filename": img.filename,
                                "filepath": img.filepath,
                                "size": img.size,
                                "content_type": img.content_type,
                                "downloaded_at": img.downloaded_at,
                                "original_url": img.original_url,
                                "absolute_url": img.absolute_url
                            }
                            for img in repo.images
                        ],
                        "image_dir": "",  # 不再需要目录信息
                        "representative_image": next((
                            {
                                "filename": img.filename,
                                "filepath": img.filepath,
                                "size": img.size,
                                "content_type": img.content_type,
                                "downloaded_at": img.downloaded_at,
                                "original_url": img.original_url,
                                "absolute_url": img.absolute_url
                            }
                            for img in repo.images if img.is_representative
                        ), None)
                    }
                }
                for repo in repositories
            ]
        }
        
        return {"success": True, "data": data}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
def get_history_list(db: Session = Depends(get_db)):
    """获取历史数据列表"""
    try:
        # 获取所有周报，按时间倒序排序
        reports = db.query(WeeklyReport).order_by(
            WeeklyReport.generation_date.desc()
        ).all()
        
        # 构建响应数据
        data = [
            {
                "id": report.id,
                "year": report.year,
                "week": report.week,
                "report_title": report.report_title,
                "generation_date": report.generation_date.strftime("%Y-%m-%d %H:%M:%S"),
                "total_repositories": report.total_repositories
            }
            for report in reports
        ]
        
        return {"success": True, "data": data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/id/{id}")
def get_report_by_id(id: int, db: Session = Depends(get_db)):
    """根据ID获取周报数据"""
    try:
        # 获取指定ID的周报
        report = db.query(WeeklyReport).filter(
            WeeklyReport.id == id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail=f"未找到ID为{id}的周报数据")
        
        # 获取该周报下的所有仓库，按排名排序
        repositories = db.query(Repository).filter(
            Repository.weekly_report_id == report.id
        ).order_by(Repository.rank).all()
        
        # 构建响应数据
        data = {
            "metadata": {
                "report_title": report.report_title,
                "year": report.year,
                "week": report.week,
                "week_range": {
                    "start": report.week_start,
                    "end": report.week_end
                },
                "total_repositories": report.total_repositories,
                "generation_date": report.generation_date.strftime("%Y-%m-%d %H:%M:%S"),
                "next_update": report.next_update
            },
            "repositories": [
                {
                    "rank": repo.rank,
                    "name": repo.name,
                    "full_name": repo.full_name,
                    "owner": repo.owner,
                    "avatar_url": repo.avatar_url,
                    "stars": repo.stars,
                    "forks": repo.forks,
                    "issues": repo.issues,
                    "watchers": repo.watchers,
                    "description": repo.description,
                    "homepage": repo.homepage,
                    "clone_url": repo.clone_url,
                    "ssh_url": repo.ssh_url,
                    "html_url": repo.html_url,
                    "language": repo.language,
                    "primary_language": repo.primary_language,
                    "languages": repo.languages,
                    "tech_stack": repo.tech_stack,
                    "topics": repo.topics,
                    "created_at": repo.created_at,
                    "updated_at": repo.updated_at,
                    "pushed_at": repo.pushed_at,
                    "activity_score": repo.activity_score,
                    "popularity_score": repo.popularity_score,
                    "freshness_score": repo.freshness_score,
                    "overall_score": repo.overall_score,
                    "trend": {
                        "status": repo.trend_status,
                        "star_change": repo.star_change,
                        "rank_change": repo.rank_change,
                        "is_new": bool(repo.is_new),
                        "last_week_rank": repo.last_week_rank,
                        "last_week_stars": repo.last_week_stars
                    },
                    # 处理图片信息
                    "images": {
                        "total_count": len(repo.images),
                        "image_list": [
                            {
                                "filename": img.filename,
                                "filepath": img.filepath,
                                "size": img.size,
                                "content_type": img.content_type,
                                "downloaded_at": img.downloaded_at,
                                "original_url": img.original_url,
                                "absolute_url": img.absolute_url
                            }
                            for img in repo.images
                        ],
                        "image_dir": "",  # 不再需要目录信息
                        "representative_image": next((
                            {
                                "filename": img.filename,
                                "filepath": img.filepath,
                                "size": img.size,
                                "content_type": img.content_type,
                                "downloaded_at": img.downloaded_at,
                                "original_url": img.original_url,
                                "absolute_url": img.absolute_url
                            }
                            for img in repo.images if img.is_representative
                        ), None)
                    }
                }
                for repo in repositories
            ]
        }
        
        return {"success": True, "data": data}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{year}/{week}")
def get_weekly_data(year: int, week: int, db: Session = Depends(get_db)):
    """获取指定周的数据"""
    try:
        # 获取指定年周的周报
        report = db.query(WeeklyReport).filter(
            WeeklyReport.year == year,
            WeeklyReport.week == week
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail=f"未找到{year}年第{week}周的数据")
        
        # 获取该周报下的所有仓库，按排名排序
        repositories = db.query(Repository).filter(
            Repository.weekly_report_id == report.id
        ).order_by(Repository.rank).all()
        
        # 构建响应数据
        data = {
            "metadata": {
                "report_title": report.report_title,
                "year": report.year,
                "week": report.week,
                "week_range": {
                    "start": report.week_start,
                    "end": report.week_end
                },
                "total_repositories": report.total_repositories,
                "generation_date": report.generation_date.strftime("%Y-%m-%d %H:%M:%S"),
                "next_update": report.next_update
            },
            "repositories": [
                {
                    "rank": repo.rank,
                    "name": repo.name,
                    "full_name": repo.full_name,
                    "owner": repo.owner,
                    "avatar_url": repo.avatar_url,
                    "stars": repo.stars,
                    "forks": repo.forks,
                    "issues": repo.issues,
                    "watchers": repo.watchers,
                    "description": repo.description,
                    "homepage": repo.homepage,
                    "clone_url": repo.clone_url,
                    "ssh_url": repo.ssh_url,
                    "html_url": repo.html_url,
                    "language": repo.language,
                    "primary_language": repo.primary_language,
                    "languages": repo.languages,
                    "tech_stack": repo.tech_stack,
                    "topics": repo.topics,
                    "created_at": repo.created_at,
                    "updated_at": repo.updated_at,
                    "pushed_at": repo.pushed_at,
                    "activity_score": repo.activity_score,
                    "popularity_score": repo.popularity_score,
                    "freshness_score": repo.freshness_score,
                    "overall_score": repo.overall_score,
                    "trend": {
                        "status": repo.trend_status,
                        "star_change": repo.star_change,
                        "rank_change": repo.rank_change,
                        "is_new": bool(repo.is_new),
                        "last_week_rank": repo.last_week_rank,
                        "last_week_stars": repo.last_week_stars
                    },
                    # 处理图片信息
                    "images": {
                        "total_count": len(repo.images),
                        "image_list": [
                            {
                                "filename": img.filename,
                                "filepath": img.filepath,
                                "size": img.size,
                                "content_type": img.content_type,
                                "downloaded_at": img.downloaded_at,
                                "original_url": img.original_url,
                                "absolute_url": img.absolute_url
                            }
                            for img in repo.images
                        ],
                        "image_dir": "",  # 不再需要目录信息
                        "representative_image": next((
                            {
                                "filename": img.filename,
                                "filepath": img.filepath,
                                "size": img.size,
                                "content_type": img.content_type,
                                "downloaded_at": img.downloaded_at,
                                "original_url": img.original_url,
                                "absolute_url": img.absolute_url
                            }
                            for img in repo.images if img.is_representative
                        ), None)
                    }
                }
                for repo in repositories
            ]
        }
        
        return {"success": True, "data": data}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/id/{id}")
def delete_weekly_data(id: int, db: Session = Depends(get_db), admin: str = Depends(get_current_admin)):
    """删除指定ID的周报数据"""
    try:
        # 获取指定ID的周报
        report = db.query(WeeklyReport).filter(
            WeeklyReport.id == id
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail=f"未找到ID为{id}的周报数据")
        
        # 删除该周报下的所有仓库
        db.query(Repository).filter(
            Repository.weekly_report_id == report.id
        ).delete()
        
        # 删除周报
        db.delete(report)
        db.commit()
        
        return {"success": True, "message": "历史数据删除成功"}
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
