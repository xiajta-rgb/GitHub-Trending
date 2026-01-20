#!/usr/bin/env python3
"""
整合的GitHub趋势爬取和数据导入脚本
功能：
1. 爬取GitHub趋势数据
2. 保存到JSON文件
3. 导入到SQLite数据库
4. 处理错误情况

用于在PythonAnywhere上定时执行
"""

import os
import sys
import json
import time
import requests
import re
import shutil
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

# 首先导入数据库相关模块
# 确保能够导入database模块和app.models
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

from database import SessionLocal, engine, Base
from app.models.weekly_report import WeeklyReport
from app.models.repository import Repository
from app.models.ai_summary import AISummary
from app.models.repository_image import RepositoryImage

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
        self.token = os.environ.get('GITHUB_TOKEN')
        self.headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Trending-Bot'
        }
        
        if self.token:
            self.headers['Authorization'] = f'token {self.token}'
    
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
            date = today - timedelta(days=1)
        
        date_str = date.strftime('%Y-%m-%d')
        query = f'created:>{date_str}'
        
        if language:
            query += f' language:{language}'
        
        params = {
            'q': query,
            'sort': 'stars',
            'order': 'desc',
            'per_page': limit
        }
        
        response = self.get('/search/repositories', params)
        return response['items']
    
    def get_repo_details(self, owner: str, repo: str) -> Dict:
        """获取仓库详细信息"""
        return self.get(f'/repos/{owner}/{repo}')


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
        report = {
            **report_metadata,
            'data': merged_data,
            'report_title': f'{self.year}年第{self.week}周GitHub趋势报告',
            'generated_at': datetime.now().isoformat()
        }
        
        print('数据处理完成，共处理', len(merged_data), '个项目')
        return report
    
    def merge_repo_and_image_data(self, repos: List[Dict], image_results: List[Dict]) -> List[Dict]:
        """合并仓库数据和图片数据"""
        merged_data = []
        
        # 创建图片数据映射
        image_map = {result['repo_name']: result for result in image_results}
        
        for repo in repos:
            repo_name = repo['full_name']
            
            # 合并图片数据
            if repo_name in image_map:
                repo['image_info'] = image_map[repo_name]
            else:
                repo['image_info'] = {
                    'repo_name': repo_name,
                    'total_images': 0,
                    'images': [],
                    'image_dir': None
                }
            
            merged_data.append(repo)
        
        return merged_data
    
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
        """生成AI摘要（简化版）"""
        print('正在生成AI摘要...')
        
        # 这里使用简化版摘要生成，不调用外部API
        total_repos = len(report['data'])
        top_repo = report['data'][0] if report['data'] else None
        
        summary = f"{report['report_title']}\n\n"
        summary += f"本次共收集了 {total_repos} 个GitHub趋势项目。\n\n"
        
        if top_repo:
            summary += f"最热门项目：{top_repo['name']}\n"
            summary += f"描述：{top_repo['description'][:100]}...\n"
            summary += f"星星数：{top_repo['stargazers_count']}\n"
            summary += f"语言：{top_repo.get('language', '未知')}\n"
        
        # 统计主要语言
        language_counts = {}
        for repo in report['data']:
            lang = repo.get('language', '未知')
            language_counts[lang] = language_counts.get(lang, 0) + 1
        
        summary += "\n主要编程语言分布：\n"
        for lang, count in sorted(language_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            summary += f"- {lang}: {count} 个项目\n"
        
        self.ai_summary = summary
        return summary


class FileManager:
    """文件管理器"""
    
    def __init__(self, year: str, week: str):
        self.year = year
        self.week = week
        self.current_report_file = DATA_DIR / 'current.json'
        self.weekly_report_file = DATA_DIR / year / f'week-{week}.json'
        self.archives_file = ARCHIVE_DIR / 'archives.json'
    
    def save_report(self, report: Dict) -> Dict:
        """保存报告数据"""
        print('正在保存报告数据...')
        
        # 确保目录存在
        self.weekly_report_file.parent.mkdir(parents=True, exist_ok=True)
        self.archives_file.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存每周报告
        self.save_json(self.weekly_report_file, report)
        
        # 更新当前报告
        self.save_json(self.current_report_file, report)
        
        # 更新档案
        self.update_archives(report)
        
        print(f'报告已保存到 {self.weekly_report_file}')
        return {
            'weekly_report_path': str(self.weekly_report_file),
            'current_report_path': str(self.current_report_file),
            'archives_path': str(self.archives_file)
        }
    
    def update_archives(self, new_report: Dict) -> None:
        """更新档案列表"""
        # 加载现有档案
        archives = self.load_json(self.archives_file, default=[])
        
        # 检查报告是否已存在
        report_key = f'{self.year}-week-{self.week}'
        existing_index = next((i for i, item in enumerate(archives) if f"{item['year']}-week-{item['week']}" == report_key), -1)
        
        # 更新或添加报告
        if existing_index >= 0:
            archives[existing_index] = {
                'year': new_report['year'],
                'week': new_report['week'],
                'report_title': new_report['report_title'],
                'total_repositories': new_report['total_repositories'],
                'generation_date': new_report['generated_at']
            }
        else:
            archives.append({
                'year': new_report['year'],
                'week': new_report['week'],
                'report_title': new_report['report_title'],
                'total_repositories': new_report['total_repositories'],
                'generation_date': new_report['generated_at']
            })
        
        # 按年份和周数排序
        archives.sort(key=lambda x: (x['year'], x['week']), reverse=True)
        
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
        backup_dir = BASE_DIR / 'backups'
        backup_dir.mkdir(exist_ok=True)
        
        # 生成备份文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = backup_dir / f'backup_{timestamp}.json'
        
        # 复制文件
        shutil.copy2(self.current_report_file, backup_path)
        print(f'数据已备份到 {backup_path}')
        return backup_path


class GitHubTrendingCrawler:
    """GitHub趋势爬取器"""
    
    def __init__(self, limit: int = 10, language: str = '', since: str = 'weekly'):
        self.limit = limit
        self.language = language
        self.since = since
        self.github_api = GitHubAPI()
        
        # 获取当前年份和周数
        now = datetime.now()
        self.current_year = str(now.year)
        self.current_week = str(now.isocalendar()[1])
    
    def run(self) -> Dict:
        """运行爬取流程"""
        try:
            print('启动GitHub趋势项目爬取')
            print('爬取时间范围:', self.since)
            print('项目数量限制:', self.limit)
            if self.language:
                print('语言过滤:', self.language)
            
            # 1. 获取GitHub趋势项目
            print('\n1. 正在获取GitHub趋势项目 (top', self.limit, ')...')
            repos = self.github_api.get_trending_repos(
                since=self.since,
                language=self.language,
                limit=self.limit
            )
            print('获取到', len(repos), '个趋势项目')
            
            # 2. 获取仓库完整信息
            print('\n2. 正在获取仓库完整信息...')
            full_repos = []
            
            for i, repo in enumerate(repos):
                try:
                    # 从repo中提取owner和name
                    owner, repo_name = repo['full_name'].split('/')
                    
                    # 获取详细信息
                    repo_details = self.github_api.get_repo_details(owner, repo_name)
                    full_repos.append(repo_details)
                    
                    print(f'处理仓库 ({i+1}/{len(repos)}): {repo_details["full_name"]}')
                    
                except Exception as e:
                    print(f'处理仓库 ({i+1}/{len(repos)}) {repo["full_name"]} 时出错:', e)
                    # 出错时使用基本信息
                    full_repos.append(repo)
                
                # 添加延迟避免API限流
                if i < len(repos) - 1:
                    time.sleep(1)
            
            # 3. 跳过图片爬取
            print('\n3. 跳过图片爬取步骤...')
            image_results = [{
                "repo_name": repo["full_name"],
                "total_images": 0,
                "images": [],
                "image_dir": None
            } for repo in full_repos]
            
            # 4. 处理数据
            print('\n4. 正在处理数据...')
            data_processor = DataProcessor(self.current_year, self.current_week)
            report = data_processor.process_data(full_repos, image_results)
            
            # 5. 生成AI摘要
            print('\n5. 正在生成AI摘要...')
            ai_summary = data_processor.generate_ai_summary(report)
            report['ai_summary'] = ai_summary
            
            # 6. 保存报告
            print('\n6. 正在保存报告...')
            file_manager = FileManager(self.current_year, self.current_week)
            file_manager.backup_current_data()  # 备份当前数据
            save_result = file_manager.save_report(report)
            
            print('\nGitHub趋势项目爬取完成！')
            print(f'生成报告: {report["report_title"]}')
            print(f'报告文件: {save_result["weekly_report_path"]}')
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


def import_data_to_database(json_file_path):
    """
    从JSON文件导入数据到数据库
    """
    print(f'\n开始导入数据到数据库: {json_file_path}')
    
    # 读取JSON数据
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 检查是否已有相同的周报记录
        year = int(data['year'])
        week = int(data['week'])
        
        existing_report = db.query(WeeklyReport).filter(
            WeeklyReport.year == year,
            WeeklyReport.week == week
        ).first()
        
        if existing_report:
            print(f'已存在{year}年第{week}周的数据，将更新现有记录')
            # 删除与该周报相关的所有仓库数据
            db.query(Repository).filter(Repository.weekly_report_id == existing_report.id).delete()
            # 删除周报本身
            db.delete(existing_report)
            db.commit()
        
        # 创建周报记录
        report_title = f"GitHub趋势排行榜 - {year}年第{week}周"
        
        # 计算周开始和结束日期
        week_start = datetime.fromisocalendar(year, week, 1).strftime("%Y-%m-%d")
        week_end = (datetime.fromisocalendar(year, week, 1) + timedelta(days=6)).strftime("%Y-%m-%d")
        
        # 解析生成日期
        generation_date_str = data['generation_date']
        if '.' in generation_date_str:
            generation_date_str = generation_date_str.split('.')[0] + 'Z'
        generation_date = datetime.fromisoformat(generation_date_str.replace('Z', '+00:00'))
        
        weekly_report = WeeklyReport(
            year=year,
            week=week,
            report_title=report_title,
            week_start=week_start,
            week_end=week_end,
            total_repositories=data['total_repositories'],
            generation_date=generation_date,
            next_update=generation_date  # 简单处理，使用生成日期作为下一次更新日期
        )
        db.add(weekly_report)
        db.flush()  # 获取weekly_report的id
        
        print(f"创建周报记录：{weekly_report.report_title}")
        
        # 导入仓库数据
        repositories = data['data']
        for i, repo_data in enumerate(repositories):
            try:
                # 解析日期字段
                created_at = datetime.fromisoformat(repo_data['created_at'].replace('Z', '+00:00'))
                updated_at = datetime.fromisoformat(repo_data['updated_at'].replace('Z', '+00:00'))
                pushed_at = datetime.fromisoformat(repo_data['pushed_at'].replace('Z', '+00:00'))
                
                # 创建仓库记录
                repository = Repository(
                    full_name=repo_data['full_name'],
                    name=repo_data['name'],
                    owner=repo_data['owner']['login'],
                    avatar_url=repo_data['owner']['avatar_url'],
                    stars=repo_data['stargazers_count'],
                    forks=repo_data['forks_count'],
                    issues=repo_data['open_issues_count'],
                    watchers=repo_data['watchers_count'],
                    description=repo_data.get('description', ''),
                    homepage=repo_data.get('homepage', ''),
                    clone_url=repo_data['html_url'] + '.git',
                    ssh_url='git@github.com:' + repo_data['full_name'] + '.git',
                    html_url=repo_data['html_url'],
                    language=repo_data.get('language', ''),
                    primary_language=repo_data.get('primary_language', repo_data.get('language', '')),
                    languages=repo_data.get('languages', {}),
                    tech_stack=repo_data.get('tech_stack', []),
                    topics=repo_data.get('topics', []),
                    created_at=created_at,
                    updated_at=updated_at,
                    pushed_at=pushed_at,
                    weekly_report_id=weekly_report.id,
                    rank=i + 1,  # 按顺序设置排名
                    activity_score=0,  # 默认值
                    popularity_score=0,  # 默认值
                    freshness_score=0,  # 默认值
                    overall_score=0,  # 默认值
                    trend_status='new',  # 默认值
                    star_change=0,  # 默认值
                    rank_change=0,  # 默认值
                    is_new=1,  # 默认值
                    last_week_rank=None,  # 默认值
                    last_week_stars=None  # 默认值
                )
                db.add(repository)
                
                print(f"导入仓库 ({i+1}/{len(repositories)}): {repository.full_name}")
                
            except Exception as e:
                print(f"导入仓库 ({i+1}/{len(repositories)}) 时出错: {e}")
                import traceback
                traceback.print_exc()
        
        # 提交所有更改
        db.commit()
        print(f"\n数据导入完成！共导入 {len(repositories)} 个仓库")
        
        return {
            'success': True,
            'report_id': weekly_report.id,
            'repositories_count': len(repositories)
        }
        
    except Exception as e:
        db.rollback()
        print(f"导入失败：{str(e)}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}
    
    finally:
        db.close()


def show_help():
    """显示帮助信息"""
    print('整合的GitHub趋势爬取和数据导入脚本')
    print('')
    print('用法: python crawl_and_import.py [选项]')
    print('')
    print('选项:')
    print('  -h, --help            显示帮助信息')
    print('  -l, --limit <数量>     限制爬取的项目数量 (默认: 10)')
    print('  -lang, --language <语言>  过滤特定编程语言 (默认: 无)')
    print('  -s, --since <时间范围>   时间范围: daily, weekly, monthly (默认: weekly)')
    print('')
    print('示例:')
    print('  python crawl_and_import.py --limit 20 --language python --since weekly')
    print('  python crawl_and_import.py -l 15 -s monthly')


def parse_arguments():
    """解析命令行参数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='整合的GitHub趋势爬取和数据导入脚本')
    parser.add_argument('-l', '--limit', type=int, default=10, help='限制爬取的项目数量')
    parser.add_argument('-lang', '--language', type=str, default='', help='过滤特定编程语言')
    parser.add_argument('-s', '--since', type=str, choices=['daily', 'weekly', 'monthly'], default='weekly', help='时间范围')
    
    return parser.parse_args()


if __name__ == '__main__':
    try:
        print('=' * 60)
        print('整合的GitHub趋势爬取和数据导入脚本')
        print('=' * 60)
        print(f'开始执行时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        print()
        
        # 解析命令行参数
        args = parse_arguments()
        
        # 1. 运行爬取
        print('=== 第一步：爬取GitHub趋势数据 ===')
        crawler = GitHubTrendingCrawler(
            limit=args.limit,
            language=args.language,
            since=args.since
        )
        
        crawl_result = crawler.run()
        
        if not crawl_result['success']:
            print(f'\n爬取失败: {crawl_result["error"]}')
            sys.exit(1)
        
        print('\n爬取成功！')
        
        # 2. 导入数据到数据库
        print('\n=== 第二步：导入数据到数据库 ===')
        
        # 获取生成的JSON文件路径
        current_report_file = DATA_DIR / 'current.json'
        
        import_result = import_data_to_database(str(current_report_file))
        
        if import_result['success']:
            print('\n=== 执行完成 ===')
            print(f'总执行时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
            print('爬取和导入操作均已成功完成！')
            sys.exit(0)
        else:
            print(f'\n导入失败: {import_result["error"]}')
            sys.exit(1)
            
    except KeyboardInterrupt:
        print('\n\n操作被用户中断')
        sys.exit(0)
    
    except Exception as e:
        print(f'\n\n程序发生意外错误: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)