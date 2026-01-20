#!/usr/bin/env python3
"""
数据库初始化脚本
"""

import os
import logging
from database import Base, engine, SessionLocal
from app.models import WeeklyReport, Repository, RepositoryImage, AISummary, RepositoryStatistic

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    """初始化数据库"""
    try:
        logger.info("创建数据库表...")
        # 创建所有表
        Base.metadata.create_all(bind=engine)
        logger.info("数据库表创建成功")
        
        # 检查是否需要初始化数据
        db = SessionLocal()
        
        # 检查是否已有周报数据
        report_count = db.query(WeeklyReport).count()
        if report_count == 0:
            logger.info("没有发现数据，数据库初始化完成")
        else:
            logger.info(f"发现 {report_count} 条周报数据，跳过初始化")
            
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
        return False

if __name__ == "__main__":
    init_db()
