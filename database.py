#!/usr/bin/env python3
"""
数据库配置文件
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 数据库配置
from config import sqlalchemy_database_url, db_path

# 使用配置管理模块的数据库 URL
SQLALCHEMY_DATABASE_URL = sqlalchemy_database_url
print(f"使用数据库: {db_path}")

# 创建数据库引擎
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()

# 数据库依赖
def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
