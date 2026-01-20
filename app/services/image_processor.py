import os
import requests
import logging
import aiohttp
import asyncio
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

class ImageProcessor:
    def __init__(self):
        self.images_dir = Path("images")
        self.images_dir.mkdir(exist_ok=True)
    
    def get_image_path(self, year, week, repo_name):
        """获取图片存储路径"""
        repo_dir = self.images_dir / f"{year}/{week}/{repo_name}"
        repo_dir.mkdir(parents=True, exist_ok=True)
        return repo_dir
    
    async def _download_image_async(self, url, filepath):
        """异步下载图片"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=30) as response:
                    response.raise_for_status()
                    with open(filepath, 'wb') as f:
                        f.write(await response.read())
            return True, filepath
        except Exception as e:
            logger.error(f"下载图片失败 {url}: {e}")
            return False, None
    
    def download_image_sync(self, url, filepath):
        """同步下载图片"""
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            with open(filepath, 'wb') as f:
                f.write(response.content)
            return True, filepath
        except Exception as e:
            logger.error(f"下载图片失败 {url}: {e}")
            return False, None
    
    async def batch_crawl_images_async(self, repos, year, week):
        """批量异步爬取图片"""
        tasks = []
        
        for repo in repos:
            # 从README中提取图片URL（简化版，实际可能需要更复杂的提取逻辑）
            # 这里暂时只处理已知的图片URL
            if hasattr(repo, 'images') and repo.images:
                for image_info in repo.images:
                    if image_info.get('absolute_url'):
                        repo_dir = self.get_image_path(year, week, repo.name)
                        filename = Path(image_info['absolute_url']).name
                        filepath = repo_dir / filename
                        task = self._download_image_async(image_info['absolute_url'], filepath)
                        tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        return [r for r in results if r[0]]
    
    def save_image_info(self, repo_id, filename, filepath, size, content_type, original_url, absolute_url, is_representative=False):
        """保存图片信息到数据库"""
        from app.models import RepositoryImage
        from database import SessionLocal
        
        db = SessionLocal()
        try:
            image = RepositoryImage(
                repository_id=repo_id,
                filename=filename,
                filepath=str(filepath),
                size=size,
                content_type=content_type,
                downloaded_at=datetime.now(),
                original_url=original_url,
                absolute_url=absolute_url,
                is_representative=1 if is_representative else 0
            )
            db.add(image)
            db.commit()
            db.refresh(image)
            return image
        finally:
            db.close()
    
    def get_representative_image(self, images):
        """选择代表性图片"""
        if not images:
            return None
        
        # 优先选择包含特定关键词的图片
        keywords = ['logo', 'icon', 'banner', 'cover', 'preview', 'demo']
        
        for keyword in keywords:
            for img in images:
                if keyword in img.filename.lower() or keyword in img.absolute_url.lower():
                    return img
        
        # 如果没有找到，返回第一张图片
        return images[0]
    
    def generate_image_url(self, repo_full_name, filename):
        """生成图片URL"""
        return f"/images/{repo_full_name.replace('/', '-')}-{filename}"
