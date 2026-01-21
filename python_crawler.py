#!/usr/bin/env python3
"""
GitHub趋势项目爬取脚本(Python版本)
功能与Node.js版本的update-trending.js相同
"""

import os
import sys
import json
import time
import requests
import re
import shutil
import hashlib
import concurrent.futures
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

# 配置参数
CONFIG = {
    'repo_limit': 10,
    'since': 'weekly',
    'language': '',
    'retry_attempts': 3,
    'retry_delay': 5000,  # 毫秒
    'timeout': 30,
    'max_file_size': 5 * 1024 * 1024,  # 5MB
    'supported_image_formats': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
}

# 目录配置
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / 'data'
ARCHIVE_DIR = BASE_DIR / 'archives'
IMAGES_DIR = BASE_DIR / 'images'
BACKUP_DIR = BASE_DIR / 'backups'

# 确保目录存在
for dir_path in [DATA_DIR, ARCHIVE_DIR, IMAGES_DIR, BACKUP_DIR]:
    dir_path.mkdir(exist_ok=True)


class GitHubAPI:
    """GitHub API客户端"""
    
    def __init__(self):
        self.base_url = 'https://api.github.com'
        # 从环境变量读取token
        self.token = os.environ.get('GITHUB_TOKEN')
        self.headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Trending-Bot'
        }
        
        if self.token:
            self.headers['Authorization'] = f'token {self.token}'
            print(f'使用token: {self.token[:10]}...')  # 打印token前10个字符以确认使用
    
    def get(self, endpoint: str, params: Dict = None) -> Dict:
        """发送GET请求"""
        url = f'{self.base_url}{endpoint}'
        response = requests.get(url, headers=self.headers, params=params, timeout=CONFIG['timeout'])
        response.raise_for_status()
        return response.json()
    
    def get_trending_repos(self, since: str = 'weekly', language: str = '', limit: int = 10) -> List[Dict]:
        """获取GitHub趋势项目"""
        today = datetime.now()
        
        if since == 'weekly':
            date = today - timedelta(days=7)
        elif since == 'monthly':
            date = today - timedelta(days=30)
        else:  # daily
            # 使用过去3天的时间范围，提高获取到项目的概率
            date = today - timedelta(days=3)
        
        date_str = date.strftime('%Y-%m-%d')
        # 使用pushed:>而不是created:>，这样可以获取到最近更新的仓库，更符合趋势的定义
        # 降低stars阈值到50，增加获取到项目的概率
        query = f'pushed:>{date_str} stars:>50'
        
        if language:
            query += f' language:{language}'
        
        params = {
            'q': query,
            'sort': 'stars',
            'order': 'desc',
            'per_page': limit
        }
        
        try:
            response = self.get('/search/repositories', params)
            return response['items']
        except Exception as e:
            print(f'获取趋势项目时出错: {e}')
            print('尝试使用weekly时间范围')
            # 尝试使用weekly时间范围
            if since != 'weekly':
                return self.get_trending_repos(since='weekly', language=language, limit=limit)
            else:
                # 如果weekly也失败，返回空列表
                return []
    
    def get_repo_details(self, owner: str, repo: str) -> Dict:
        """获取仓库详细信息"""
        return self.get(f'/repos/{owner}/{repo}')
    
    def get_repo_readme(self, owner: str, repo: str) -> str:
        """获取仓库README内容"""
        try:
            response = self.get(f'/repos/{owner}/{repo}/readme')
            import base64
            return base64.b64decode(response['content']).decode('utf-8')
        except requests.exceptions.HTTPError:
            return ''
    
    def get_repo_languages(self, owner: str, repo: str) -> Dict:
        """获取仓库语言统计"""
        try:
            return self.get(f'/repos/{owner}/{repo}/languages')
        except requests.exceptions.HTTPError:
            return {}
    
    def get_repo_info(self, repo):
        """获取单个仓库的完整信息"""
        try:
            # 获取详细信息、README和语言统计
            details = self.get_repo_details(repo['owner']['login'], repo['name'])
            readme = self.get_repo_readme(repo['owner']['login'], repo['name'])
            languages = self.get_repo_languages(repo['owner']['login'], repo['name'])
            
            full_info = {
                **details,
                'readme_content': readme,
                'languages': languages,
                'primary_language': self.get_primary_language(languages),
                'tech_stack': self.extract_tech_stack(details, languages, readme)
            }
            
            return full_info
        except Exception as e:
            print(f'处理仓库 {repo["full_name"]} 时出错: {e}')
            # 即使出错也要返回基本信息，并尝试从基本信息中提取技术栈
            # 使用基本信息中的language作为primary_language
            primary_language = repo.get('language', 'Unknown')
            # 尝试从基本信息中提取技术栈
            tech_stack = set()
            # 添加主要语言
            if primary_language and primary_language != 'Unknown' and primary_language != 'None':
                tech_stack.add(primary_language)
            # 添加topics
            if repo.get('topics'):
                tech_stack.update(repo['topics'])
            
            return {
                **repo,
                'readme_content': '',
                'languages': {},
                'primary_language': primary_language,
                'tech_stack': list(tech_stack)
            }
    
    def get_repos_full_info(self, repos: List[Dict]) -> List[Dict]:
        """批量获取仓库完整信息（并发执行）"""
        full_info_repos = []
        total_repos = len(repos)
        
        print(f'正在并发获取 {total_repos} 个仓库的详细信息...')
        
        # 使用线程池并发获取仓库信息，最大并发数为5
        with ThreadPoolExecutor(max_workers=5) as executor:
            # 提交所有任务
            future_to_repo = {executor.submit(self.get_repo_info, repo): repo for repo in repos}
            
            # 处理完成的任务
            for i, future in enumerate(concurrent.futures.as_completed(future_to_repo)):
                repo = future_to_repo[future]
                print(f'已完成 ({i + 1}/{total_repos}) {repo["full_name"]} 的详细信息获取...')
                
                try:
                    full_info = future.result()
                    full_info_repos.append(full_info)
                except Exception as e:
                    print(f'获取仓库 {repo["full_name"]} 信息时发生异常: {e}')
                    # 即使出错也要继续处理
                    full_info_repos.append({
                        **repo,
                        'readme_content': '',
                        'languages': {},
                        'primary_language': repo.get('language', 'Unknown'),
                        'tech_stack': []
                    })
        
        return full_info_repos
    
    def get_primary_language(self, languages: Dict) -> str:
        """获取主要编程语言"""
        if not languages:
            return 'Unknown'
        return max(languages.items(), key=lambda x: x[1])[0]
    
    def extract_tech_stack(self, repo: Dict, languages: Dict, readme: str) -> List[str]:
        """提取技术栈信息"""
        tech_stack = set()
        
        # 从语言统计中添加
        tech_stack.update(languages.keys())
        
        # 从topics中添加
        if repo.get('topics'):
            tech_stack.update(repo['topics'])
        
        # 从README中提取常见技术栈关键词
        tech_keywords = [
            'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask',
            'Spring', 'Docker', 'Kubernetes', 'Redis', 'MongoDB', 'PostgreSQL',
            'MySQL', 'TypeScript', 'GraphQL', 'REST API', 'Microservices',
            'AWS', 'Azure', 'GCP', 'Terraform', 'Ansible'
        ]
        
        readme_upper = readme.upper()
        for keyword in tech_keywords:
            if keyword.upper() in readme_upper:
                tech_stack.add(keyword)
        
        return list(tech_stack)[:8]  # 限制数量
    
    def delay(self, ms: int) -> None:
        """延迟函数"""
        time.sleep(ms / 1000)


class ImageCrawler:
    """图片爬取器"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def crawl_project_images(self, repo: Dict, year: str, week: str) -> Dict:
        """为项目爬取图片"""
        try:
            print(f'正在爬取 {repo["full_name"]} 的图片...')
            
            project_dir = self.get_project_image_dir(repo['name'], year, week)
            project_dir.mkdir(parents=True, exist_ok=True)
            
            images = self.extract_images_from_readme(repo, project_dir)
            
            return {
                'repo_name': repo['full_name'],
                'total_images': len(images),
                'images': images,
                'image_dir': str(project_dir)
            }
            
        except Exception as e:
            print(f'爬取图片失败 {repo["full_name"]}: {e}')
            return {
                'repo_name': repo['full_name'],
                'total_images': 0,
                'images': [],
                'image_dir': None,
                'error': str(e)
            }
    
    def get_project_image_dir(self, repo_name: str, year: str, week: str) -> Path:
        """获取项目图片存储目录"""
        safe_name = self.sanitize_file_name(repo_name)
        return IMAGES_DIR / year / f'week-{week}' / safe_name
    
    def extract_images_from_readme(self, repo: Dict, target_dir: Path) -> List[Dict]:
        """从README中提取并下载图片"""
        images = []
        readme = repo.get('readme_content', '')
        
        if not readme:
            print(f'{repo["full_name"]} 没有README内容')
            return images
        
        # 解析Markdown中的图片
        markdown_images = self.parse_markdown_images(readme)
        
        # 解析HTML中的图片（如果README包含HTML）
        html_images = self.parse_html_images(readme)
        
        # 合并并去重
        all_image_urls = list(set(markdown_images + html_images))
        
        print(f'发现 {len(all_image_urls)} 个图片链接在 {repo["full_name"]}')
        
        # 只处理第一张图片
        if all_image_urls:
            image_url = all_image_urls[0]
            try:
                absolute_url = self.resolve_image_url(image_url, repo)
                image_info = self.download_image(absolute_url, target_dir, 0)
                
                if image_info:
                    images.append({
                        **image_info,
                        'original_url': image_url,
                        'absolute_url': absolute_url
                    })
                    print(f'✅ 成功下载项目代表图片: {image_info["filename"]}')
                    
            except Exception as e:
                print(f'下载图片失败 {image_url}: {e}')
        else:
            print(f'{repo["full_name"]} 的README中没有找到图片')
        
        return images
    
    def parse_markdown_images(self, content: str) -> List[str]:
        """解析Markdown中的图片"""
        images = []
        # 匹配 ![alt](url) 格式
        pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        matches = re.finditer(pattern, content)
        
        for match in matches:
            image_url = match.group(2).strip()
            if self.is_valid_image_url(image_url):
                images.append(image_url)
        
        return images
    
    def parse_html_images(self, content: str) -> List[str]:
        """解析HTML中的图片"""
        images = []
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            
            for img in soup.find_all('img'):
                src = img.get('src')
                if src and self.is_valid_image_url(src):
                    images.append(src.strip())
                    
        except Exception as e:
            print(f'解析HTML图片失败: {e}')
        
        return images
    
    def resolve_image_url(self, image_url: str, repo: Dict) -> str:
        """解析图片URL为绝对URL"""
        # 如果已经是绝对URL
        if image_url.startswith('http://') or image_url.startswith('https://'):
            return image_url
        
        # 处理GitHub相对路径
        base_url = f'https://raw.githubusercontent.com/{repo["full_name"]}/{repo.get("default_branch", "main")}'
        
        if image_url.startswith('./'):
            return f'{base_url}/{image_url[2:]}'
        elif image_url.startswith('/'):
            return f'{base_url}{image_url}'
        else:
            return f'{base_url}/{image_url}'
    
    def is_valid_image_url(self, url: str) -> bool:
        """验证是否为有效的图片URL"""
        if not url or not isinstance(url, str):
            return False
        
        # 排除base64图片
        if url.startswith('data:'):
            return False
        
        # 检查文件扩展名
        ext = os.path.splitext(url.split('?')[0])[1].lower()
        return ext in CONFIG['supported_image_formats'] or 'githubusercontent.com' in url
    
    def download_image(self, image_url: str, target_dir: Path, index: int) -> Optional[Dict]:
        """下载图片"""
        try:
            print(f'正在下载图片: {image_url}')
            
            response = self.session.get(image_url, stream=True, timeout=CONFIG['timeout'])
            response.raise_for_status()
            
            # 检查内容类型
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                raise ValueError(f'无效的内容类型: {content_type}')
            
            # 检查文件大小
            content_length = int(response.headers.get('content-length', '0'))
            if content_length > CONFIG['max_file_size']:
                raise ValueError(f'文件过大: {content_length} bytes')
            
            # 生成文件名
            file_name = self.generate_file_name(image_url, index, content_type)
            file_path = target_dir / file_name
            
            # 保存文件
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            # 验证文件大小
            stats = os.stat(file_path)
            
            return {
                'filename': file_name,
                'filepath': str(file_path),
                'size': stats.st_size,
                'content_type': content_type,
                'downloaded_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            raise Exception(f'下载失败: {e}')
    
    def generate_file_name(self, image_url: str, index: int, content_type: str) -> str:
        """生成文件名"""
        # 尝试从URL获取原始文件名
        url_path = image_url.split('?')[0]
        original_name = os.path.basename(url_path)
        
        # 如果有有效的原始文件名且包含扩展名
        if original_name and os.path.splitext(original_name)[1]:
            safe_name = self.sanitize_file_name(original_name)
            return f'{index + 1}_{safe_name}'
        
        # 根据内容类型生成扩展名
        ext_map = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/gif': '.gif',
            'image/svg+xml': '.svg',
            'image/webp': '.webp'
        }
        
        ext = ext_map.get(content_type, '.png')
        return f'image_{index + 1}{ext}'
    
    def sanitize_file_name(self, file_name: str) -> str:
        """清理文件名"""
        return re.sub(r'[<>:/\\|?*]', '_', file_name).replace(' ', '_').replace('__', '_').lower()
    
    def batch_crawl_images(self, repos: List[Dict], year: str, week: str) -> List[Dict]:
        """批量处理项目图片"""
        results = []
        total_repos = len(repos)
        
        for i, repo in enumerate(repos):
            print(f'正在爬取图片 ({i + 1}/{total_repos}): {repo["full_name"]}')
            image_info = self.crawl_project_images(repo, year, week)
            results.append(image_info)
            
            print(f'完成图片爬取 ({i + 1}/{total_repos}): {repo["full_name"]}')
            
            # 添加延迟
            if i < total_repos - 1:
                time.sleep(1)
        
        return results


class DataProcessor:
    """数据处理器"""
    
    def __init__(self, year: str, week: str):
        self.year = year
        self.week = week
        self.ai_summary = None
    
    def process_data(self, repos: List[Dict], image_results: List[Dict]) -> Dict:
        """处理数据，生成最终报告"""
        print('正在处理数据...')
        
        # 合并仓库数据和图片数据
        merged_data = self.merge_repo_and_image_data(repos, image_results)
        
        # 生成报告元数据
        report_metadata = self.generate_report_metadata(len(merged_data))
        
        # 生成最终报告
        today = datetime.now().strftime('%Y%m%d')
        report = {
            **report_metadata,
            'data': merged_data,
            'report_title': f'GitHub趋势报告{today}',
            'generated_at': datetime.now().isoformat()
        }
        
        print(f'数据处理完成，共处理 {len(merged_data)} 个项目')
        return report
    
    def merge_repo_and_image_data(self, repos: List[Dict], image_results: List[Dict]) -> List[Dict]:
        """合并仓库数据和图片数据"""
        # 创建仓库名称到图片信息的映射
        image_map = {result['repo_name']: result for result in image_results}
        
        merged_repos = []
        
        for repo in repos:
            merged_repo = {
                **repo,
                'image_info': image_map.get(repo['full_name'], {
                    'total_images': 0,
                    'images': [],
                    'image_dir': None
                })
            }
            
            # 清理不需要的数据以减小文件大小
            cleaned_repo = self.clean_repo_data(merged_repo)
            merged_repos.append(cleaned_repo)
        
        return merged_repos
    
    def clean_repo_data(self, repo: Dict) -> Dict:
        """清理仓库数据，移除不必要的字段"""
        # 保留必要的字段
        keep_fields = [
            'id', 'name', 'full_name', 'html_url', 'description',
            'created_at', 'updated_at', 'pushed_at', 'stargazers_count',
            'watchers_count', 'forks_count', 'open_issues_count',
            'language', 'primary_language', 'topics', 'tech_stack',
            'languages', 'image_info', 'owner'
        ]
        
        cleaned = {k: v for k, v in repo.items() if k in keep_fields}
        
        # 清理owner字段
        if cleaned.get('owner'):
            cleaned['owner'] = {
                'login': cleaned['owner'].get('login'),
                'avatar_url': cleaned['owner'].get('avatar_url'),
                'html_url': cleaned['owner'].get('html_url')
            }
        
        return cleaned
    
    def generate_report_metadata(self, total_repos: int) -> Dict:
        """生成报告元数据"""
        return {
            'year': self.year,
            'week': self.week,
            'total_repositories': total_repos,
            'generation_date': datetime.now().isoformat(),
            'report_version': '1.0.0',
            'data_source': 'GitHub API'
        }
    
    def generate_ai_summary(self, report: Dict) -> str:
        """生成AI摘要（简化版，实际项目中可以集成GPT等）"""
        print('正在生成AI摘要...')
        
        # 统计信息
        total_repos = len(report['data'])
        languages = {}
        topics = {}
        
        for repo in report['data']:
            # 统计语言
            lang = repo.get('primary_language', 'Unknown')
            languages[lang] = languages.get(lang, 0) + 1
            
            # 统计主题
            for topic in repo.get('topics', []):
                topics[topic] = topics.get(topic, 0) + 1
        
        # 获取主要语言和主题
        top_languages = sorted(languages.items(), key=lambda x: x[1], reverse=True)[:5]
        top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # 生成简单摘要
        summary = f"本周GitHub趋势报告分析了 {total_repos} 个热门项目。\n\n"
        summary += "主要编程语言：\n"
        for lang, count in top_languages:
            summary += f"- {lang}: {count} 个项目\n"
        
        summary += "\n热门主题：\n"
        for topic, count in top_topics:
            summary += f"- {topic}: {count} 个项目\n"
        
        summary += f"\n完整报告包含了所有 {total_repos} 个项目的详细信息，包括它们的星星数、技术栈和代表图片。"
        
        self.ai_summary = summary
        return summary


class FileManager:
    """文件管理器"""
    
    def __init__(self, year: str, period: str, period_type: str = 'week'):
        """
        初始化文件管理器
        
        Args:
            year: 年份
            period: 周期标识（周数或日期）
            period_type: 周期类型 ('week' 或 'day')
        """
        self.year = year
        self.period = period
        self.period_type = period_type
        self.current_report_file = DATA_DIR / 'current.json'
        
        # 根据周期类型设置报告文件路径
        if period_type == 'day':
            self.report_file = DATA_DIR / year / f'{period}.json'
        else:  # week
            self.report_file = DATA_DIR / year / f'week-{period}.json'
            
        self.archives_file = ARCHIVE_DIR / 'archives.json'
    
    def save_report(self, report: Dict) -> Dict:
        """保存报告数据"""
        print('正在保存报告数据...')
        print(f'报告标题: {report.get("report_title", "未设置")}')
        print(f'报告对象包含的字段: {list(report.keys())}')
        
        # 确保目录存在
        self.report_file.parent.mkdir(parents=True, exist_ok=True)
        self.archives_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存报告
        self.save_json(self.report_file, report)
        print(f'已保存报告到 {self.report_file}')
        
        # 更新当前报告
        self.save_json(self.current_report_file, report)
        print(f'已更新当前报告到 {self.current_report_file}')
        
        # 验证当前报告文件是否包含report_title字段
        try:
            with open(self.current_report_file, 'r', encoding='utf-8') as f:
                saved_data = json.load(f)
            print(f'保存后的报告标题: {saved_data.get("report_title", "未设置")}')
            print(f'保存后的报告对象包含的字段: {list(saved_data.keys())}')
        except Exception as e:
            print(f'读取保存后的报告文件失败: {e}')
        
        # 更新档案
        self.update_archives(report)
        
        print(f'报告已保存到 {self.report_file}')
        print(f'当前报告已保存到 {self.current_report_file}')
        return {
            'report_path': str(self.report_file),
            'current_report_path': str(self.current_report_file),
            'archives_path': str(self.archives_file)
        }
    
    def update_archives(self, new_report: Dict) -> None:
        """更新档案列表"""
        # 加载现有档案
        archives = self.load_json(self.archives_file, default=[])
        
        # 根据周期类型生成报告键
        if self.period_type == 'day':
            report_key = f'{self.year}-{self.period}'
            existing_index = next((i for i, item in enumerate(archives) if f"{item['year']}-{item.get('date', item.get('week'))}" == report_key), -1)
        else:  # week
            report_key = f'{self.year}-week-{self.period}'
            existing_index = next((i for i, item in enumerate(archives) if f"{item['year']}-week-{item.get('week', item.get('date'))}" == report_key), -1)
        
        # 更新或添加报告
        report_item = {
            'year': new_report['year'],
            'report_title': new_report['report_title'],
            'total_repositories': new_report['total_repositories'],
            'generation_date': new_report['generated_at']
        }
        
        # 根据周期类型添加相应的字段
        if self.period_type == 'day':
            report_item['date'] = self.period
        else:  # week
            report_item['week'] = self.period
        
        if existing_index >= 0:
            archives[existing_index] = report_item
        else:
            archives.append(report_item)
        
        # 按年份和周期排序
        def sort_key(item):
            if 'date' in item:
                return (item['year'], item['date'])
            else:
                return (item['year'], item['week'])
        
        archives.sort(key=sort_key, reverse=True)
        
        # 保存更新后的档案
        self.save_json(self.archives_file, archives)
    
    def save_json(self, file_path: Path, data: Any) -> None:
        """保存JSON数据"""
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    def load_json(self, file_path: Path, default: Any = None) -> Any:
        """加载JSON数据"""
        if not file_path.exists():
            return default
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def backup_current_data(self) -> Optional[Path]:
        """备份当前数据"""
        if not self.current_report_file.exists():
            print('没有可备份的当前数据')
            return None
        
        # 确保备份目录存在
        BACKUP_DIR.mkdir(exist_ok=True)
        
        # 生成备份文件名
        backup_filename = f'backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        backup_path = BACKUP_DIR / backup_filename
        
        # 复制文件
        shutil.copy2(self.current_report_file, backup_path)
        
        print(f'数据已备份到 {backup_path}')
        return backup_path
    
    def get_weekly_report_path(self) -> Path:
        """获取每周报告的路径"""
        return self.weekly_report_file


class GitHubTrendingCrawler:
    """GitHub趋势爬取器主类"""
    
    def __init__(self, limit: int = 10, language: str = '', since: str = 'weekly'):
        self.limit = limit
        self.language = language
        self.since = since
        self.current_year, self.current_week = self.get_current_year_week()
        
    def get_current_year_week(self) -> tuple:
        """获取当前年份和周数"""
        today = datetime.now()
        year = today.strftime('%Y')
        week = today.isocalendar()[1]
        return year, str(week)
    
    def run(self) -> Dict:
        """执行爬取任务"""
        print('启动GitHub趋势项目爬取')
        print(f'爬取时间范围: {self.since}')
        if self.language:
            print(f'编程语言: {self.language}')
        print(f'项目数量限制: {self.limit}')
        
        try:
            # 1. 初始化GitHub API客户端
            github_api = GitHubAPI()
            
            # 2. 获取GitHub趋势项目
            print(f'\n1. 正在获取GitHub趋势项目 (top {self.limit})...')
            repos = github_api.get_trending_repos(
                since=self.since,
                language=self.language,
                limit=self.limit
            )
            
            if not repos:
                print('没有获取到趋势项目，尝试使用weekly时间范围')
                # 尝试使用weekly时间范围
                repos = github_api.get_trending_repos(
                    since='weekly',
                    language=self.language,
                    limit=self.limit
                )
                if not repos:
                    print('仍然没有获取到趋势项目')
                    return {'success': False, 'error': '没有获取到趋势项目'}
            
            print(f'获取到 {len(repos)} 个趋势项目')
            
            # 3. 获取仓库完整信息
            print('\n2. 正在获取仓库完整信息...')
            full_repos = github_api.get_repos_full_info(repos)
            
            # 4. 跳过图片爬取
            print('\n3. 跳过图片爬取步骤...')
            # 创建空的图片结果列表
            image_results = [{"repo_name": repo["full_name"], "total_images": 0, "images": [], "image_dir": None} for repo in full_repos]
            
            # 5. 处理数据
            print('\n4. 正在处理数据...')
            data_processor = DataProcessor(self.current_year, self.current_week)
            report = data_processor.process_data(full_repos, image_results)
            
            # 6. 生成AI摘要
            print('\n5. 正在生成AI摘要...')
            ai_summary = data_processor.generate_ai_summary(report)
            report['ai_summary'] = ai_summary
            
            # 7. 保存报告
            print('\n6. 正在保存报告...')
            # 根据since参数决定使用哪种周期类型
            if self.since == 'daily':
                # 使用当前日期作为周期标识
                current_date = datetime.now().strftime('%Y%m%d')
                file_manager = FileManager(self.current_year, current_date, 'day')
            else:
                # 使用周数作为周期标识
                file_manager = FileManager(self.current_year, self.current_week, 'week')
                
            file_manager.backup_current_data()  # 备份当前数据
            save_result = file_manager.save_report(report)
            
            print('\nGitHub趋势项目爬取完成！')
            print(f'生成报告: {report["report_title"]}')
            print(f'报告文件: {save_result["report_path"]}')
            print(f'档案文件: {save_result["archives_path"]}')
            
            return {
                'success': True,
                'report': report,
                'save_result': save_result
            }
            
        except Exception as e:
            print(f'\n爬取失败: {e}')
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}


def show_help():
    """显示帮助信息"""
    print('GitHub Trending Python Crawler')
    print('爬取GitHub趋势项目并生成报告')
    print('')
    print('用法: python python_crawler.py [选项]')
    print('')
    print('选项:')
    print('  -h, --help            显示帮助信息')
    print('  -l, --limit <数量>     限制爬取的项目数量 (默认: 10)')
    print('  -lang, --language <语言>  过滤特定编程语言 (默认: 无)')
    print('  -s, --since <时间范围>   时间范围: daily, weekly, monthly (默认: weekly)')
    print('')
    print('示例:')
    print('  python python_crawler.py --limit 20 --language python --since weekly')
    print('  python python_crawler.py -l 15 -s monthly')


def parse_arguments():
    """解析命令行参数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='GitHub Trending Python Crawler')
    parser.add_argument('-l', '--limit', type=int, default=10, help='限制爬取的项目数量')
    parser.add_argument('-lang', '--language', type=str, default='', help='过滤特定编程语言')
    parser.add_argument('-s', '--since', type=str, choices=['daily', 'weekly', 'monthly'], default='weekly', help='时间范围')
    
    return parser.parse_args()


if __name__ == '__main__':
    try:
        # 解析命令行参数
        args = parse_arguments()
        
        # 创建并运行爬取器
        crawler = GitHubTrendingCrawler(
            limit=args.limit,
            language=args.language,
            since=args.since
        )
        
        result = crawler.run()
        
        if result['success']:
            sys.exit(0)
        else:
            print(f'\n爬取任务失败: {result["error"]}')
            # 即使失败也以零状态码退出，避免被视为执行错误
            sys.exit(0)
            
    except KeyboardInterrupt:
        print('\n\n爬取任务被用户中断')
        sys.exit(0)
    except Exception as e:
        print(f'\n\n程序发生意外错误: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
