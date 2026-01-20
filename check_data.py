#!/usr/bin/env python3
from database import SessionLocal
from app.models import WeeklyReport
from datetime import datetime

# 获取当前时间
now = datetime.now()
year = now.year
week_num = now.isocalendar()[1]

# 创建数据库会话
db = SessionLocal()

# 检查是否存在本周的数据
existing = db.query(WeeklyReport).filter(
    WeeklyReport.year == year,
    WeeklyReport.week == week_num
).first()

# 打印结果
print(f'{year}年第{week_num}周的数据存在: {existing is not None}')
if existing:
    print(f'报告ID: {existing.id}, 标题: {existing.report_title}, 生成日期: {existing.generation_date}')
else:
    print('没有找到本周的数据')

# 关闭数据库会话
db.close()