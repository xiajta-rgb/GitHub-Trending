import sqlite3

# 连接到数据库
conn = sqlite3.connect('github_trending.db')
cursor = conn.cursor()

# 查询技术栈数据
cursor.execute('SELECT tech_stack FROM repositories LIMIT 10;')
rows = cursor.fetchall()

print('技术栈数据（前10条）：')
for i, row in enumerate(rows):
    tech_stack = row[0]
    print(f'{i+1}: {tech_stack} (类型: {type(tech_stack)})')

# 查询primary_language数据
cursor.execute('SELECT primary_language FROM repositories LIMIT 10;')
rows = cursor.fetchall()

print('\nprimary_language数据（前10条）：')
for i, row in enumerate(rows):
    primary_language = row[0]
    print(f'{i+1}: {primary_language}')

# 关闭连接
conn.close()