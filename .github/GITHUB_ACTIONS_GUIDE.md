# GitHub Actions 配置指南

本文档说明如何配置和使用GitHub Actions自动化功能。

## 🤖 自动化功能

### 1. 定时更新
- **频率**: 每周一凌晨2点（UTC时间）
- **内容**: 自动爬取GitHub趋势、生成AI总结、更新README
- **提交**: 自动提交更改到仓库

### 2. 手动触发
- **位置**: GitHub仓库 -> Actions -> Update GitHub Trending -> Run workflow
- **参数**: 可自定义项目数量、编程语言、时间范围

### 3. 数据清理
- **频率**: 每月第一周自动执行
- **内容**: 清理过期的归档数据和图片文件

## 🔑 必需配置

### 1. Repository Secrets

进入 GitHub仓库 -> Settings -> Secrets and variables -> Actions，添加以下密钥：

#### 必需密钥

| 名称 | 说明 | 获取方式 |
|------|------|----------|
| `GITHUB_TOKEN` | GitHub API访问令牌 | GitHub默认提供，通常无需手动设置 |
| `SILICONFLOW_API_KEY` | 硅基流动API密钥 | [硅基流动官网](https://siliconflow.cn) |

#### 可选密钥

| 名称 | 说明 | 默认值 |
|------|------|--------|
| `AI_BASE_URL` | AI服务基础URL | `https://api.siliconflow.cn/v1` |
| `AI_MODEL` | AI模型名称 | `deepseek-chat` |

### 2. Repository 权限

确保GitHub Actions有必要的权限：

1. 进入 Settings -> Actions -> General
2. 在 "Workflow permissions" 部分选择：
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests

## 📅 定时任务配置

### Cron表达式说明

当前配置：`0 2 * * 1`（每周一凌晨2点UTC）

```bash
# ┌───────────── 分钟 (0 - 59)
# │ ┌───────────── 小时 (0 - 23) 
# │ │ ┌───────────── 日 (1 - 31)
# │ │ │ ┌───────────── 月 (1 - 12)
# │ │ │ │ ┌───────────── 星期 (0 - 6, 0=Sunday)
# │ │ │ │ │
# * * * * *
```

### 常用时间配置

```yaml
# 每天凌晨2点
- cron: '0 2 * * *'

# 每周日凌晨2点  
- cron: '0 2 * * 0'

# 每月1号凌晨2点
- cron: '0 2 1 * *'

# 每6小时执行一次
- cron: '0 */6 * * *'
```

### 时区说明

- **Cron时间**: UTC时区
- **北京时间**: UTC+8
- **示例**: UTC 2:00 = 北京时间 10:00

## 🚀 手动执行

### 1. 通过GitHub网页

1. 进入仓库 -> Actions
2. 选择 "Update GitHub Trending" 工作流
3. 点击 "Run workflow"
4. 设置参数：
   - **项目数量**: 1-100（默认10）
   - **编程语言**: 留空=所有语言
   - **时间范围**: daily/weekly/monthly

### 2. 通过API调用

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/USERNAME/REPO/actions/workflows/update-trending.yml/dispatches \
  -d '{"ref":"main","inputs":{"repo_limit":"20","language":"python"}}'
```

## 📊 监控和日志

### 1. 查看执行状态

- **位置**: GitHub仓库 -> Actions
- **信息**: 执行时间、状态、日志详情

### 2. 执行摘要

每次成功执行后会生成摘要，包含：
- 更新时间和触发方式
- 执行参数（手动触发时）
- 相关链接

### 3. 失败通知

当工作流失败时：
- GitHub会发送邮件通知
- 可在Actions页面查看详细错误日志

## 🛠️ 故障排除

### 常见问题

#### 1. API密钥错误
```
Error: 请设置 SILICONFLOW_API_KEY 环境变量
```
**解决**: 检查Repository Secrets中的API密钥设置

#### 2. GitHub API限制
```
Error: API rate limit exceeded
```
**解决**: 
- 等待限制重置（每小时重置）
- 检查是否设置了GITHUB_TOKEN

#### 3. 权限不足
```
Error: Permission denied
```
**解决**: 检查Repository的Actions权限设置

#### 4. 网络超时
```
Error: timeout of 30000ms exceeded
```
**解决**: 
- 重新运行工作流
- 检查外部服务状态

### 调试方法

#### 1. 启用调试日志
在Repository Secrets中添加：
```
ACTIONS_STEP_DEBUG = true
ACTIONS_RUNNER_DEBUG = true
```

#### 2. 本地测试
```bash
# 检查配置
node scripts/update-trending.js --check

# 手动执行（小数据量测试）
node scripts/update-trending.js --limit 3
```

## ⚙️ 高级配置

### 1. 并发控制

```yaml
concurrency:
  group: update-trending
  cancel-in-progress: true
```

### 2. 缓存优化

```yaml
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 3. 多环境支持

```yaml
strategy:
  matrix:
    environment: [staging, production]
```

### 4. 条件执行

```yaml
# 仅在主分支执行
if: github.ref == 'refs/heads/main'

# 仅在特定文件变更时执行
if: contains(github.event.head_commit.modified, 'src/')
```

## 📈 性能优化

### 1. 减少执行时间
- 调整 `REPO_LIMIT` 减少处理项目数量
- 使用缓存减少重复下载
- 并行处理独立任务

### 2. 节省API配额
- 合理设置执行频率
- 实现智能重试机制
- 缓存不经常变化的数据

### 3. 存储优化
- 定期清理过期数据
- 压缩图片文件
- 使用Git LFS处理大文件

## 🔧 自定义配置

如需修改自动化行为，编辑 `.github/workflows/update-trending.yml`：

```yaml
# 修改执行频率
schedule:
  - cron: '0 6 * * *'  # 改为每天早上6点

# 修改默认参数
env:
  DEFAULT_REPO_LIMIT: '20'
  DEFAULT_LANGUAGE: 'javascript'
```

---

如有其他问题，请查看 [GitHub Actions 官方文档](https://docs.github.com/en/actions) 或提交 Issue。