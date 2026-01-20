#!/usr/bin/env python3
"""
GitHub Trending FastAPI 后端
"""

import os
import logging
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 导入数据库配置
from database import Base, engine, get_db

# 初始化数据库 - 创建所有表
Base.metadata.create_all(bind=engine)

# 创建FastAPI应用
app = FastAPI(
    title="GitHub Trending API",
    description="GitHub趋势排行榜API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 导入路由
from app.routes import trending, statistics, update, auth

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(trending.router, prefix="/api/trending", tags=["trending"])
app.include_router(statistics.router, prefix="/api", tags=["statistics"])
app.include_router(update.router, prefix="/api/update", tags=["update"])

# 静态文件服务
app.mount("/", StaticFiles(directory="public", html=True), name="public")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
