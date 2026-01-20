# 环境配置指南

本文档将指导你如何正确配置GitHub Trending排行榜项目的环境变量。

## 🚀 快速开始

1. **复制环境变量模板**
   ```bash
   cp .env.example .env
   ```

2. **编辑 .env 文件，填入真实的配置值**

## 🔑 必需配置

### GitHub API Token

**获取步骤：**

1. 登录 GitHub -> 点击头像 -> Settings
2. 左侧菜单 -> Developer settings -> Personal access tokens -> Tokens (classic)
3. 点击 "Generate new token" -> "Generate new token (classic)"
4. 设置权限：
   - `public_repo` - 访问公开仓库
   - `read:user` - 读取用户信息
   - `repo:status` - 访问仓库状态
5. 复制生成的token到 `.env` 文件：
   ```env
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 硅基流动 API Key

**获取步骤：**

1. 访问 [硅基流动官网](https://siliconflow.cn)
2. 注册/登录账号
3. 进入控制台 -> API管理 -> 创建新的API Key
4. 复制API Key到 `.env` 文件：
   ```env
   SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## 🔧 可选配置

### 项目爬取配置

```env
# 每次获取的项目数量（1-100）
REPO_LIMIT=10

# 时间范围
SINCE=weekly  # daily/weekly/monthly

# 编程语言过滤（留空=所有语言）
LANGUAGE=      # 例如: python, javascript, go

# 重试配置
RETRY_ATTEMPTS=3
RETRY_DELAY=5000
```

### 图片爬取配置

```env
# 最大图片文件大小（5MB = 5242880字节）
MAX_IMAGE_SIZE=5242880

# 图片下载超时时间（30秒 = 30000毫秒）
IMAGE_TIMEOUT=30000
```

### 数据管理配置

```env
# 数据保留时间（52周 = 1年）
KEEP_WEEKS=52

# 是否自动清理过期数据
AUTO_CLEANUP=true
```

## 🔒 安全注意事项

### 1. 保护API密钥
- ✅ **永远不要**将 `.env` 文件提交到Git仓库
- ✅ **定期更换**API密钥
- ✅ **使用最小权限**原则设置GitHub Token

### 2. 环境隔离
```env
# 开发环境
DEBUG=true
LOG_LEVEL=debug

# 生产环境  
DEBUG=false
LOG_LEVEL=info
```

### 3. 监控API使用
- GitHub API 限制：5000次请求/小时（有token）
- 硅基流动：查看控制台的使用量统计

## 🚨 常见问题

### Q: GitHub Token权限不足
**A:** 确保token包含 `public_repo` 权限

### Q: 硅基流动API调用失败
**A:** 检查：
1. API Key是否正确
2. 账户余额是否充足
3. 网络连接是否正常

### Q: 图片下载失败
**A:** 可能原因：
1. 网络超时 -> 增加 `IMAGE_TIMEOUT` 值
2. 文件过大 -> 调整 `MAX_IMAGE_SIZE` 值
3. 防盗链保护 -> 某些网站禁止外部访问

### Q: 内存不足
**A:** 减少 `REPO_LIMIT` 值，分批处理

## 🧪 配置测试

运行配置检查命令：
```bash
node scripts/update-trending.js --check
```

应该看到：
```
✅ GitHub API 配置正常
✅ AI API 配置正常
✅ README验证通过
✅ 配置检查通过
```

## 📊 性能优化

### 1. API调用优化
```env
# 减少重试延迟（但增加失败风险）
RETRY_DELAY=3000

# 减少重试次数
RETRY_ATTEMPTS=2
```

### 2. 图片爬取优化
```env
# 跳过大图片
MAX_IMAGE_SIZE=2097152  # 2MB

# 减少超时时间
IMAGE_TIMEOUT=15000     # 15秒
```

### 3. 数据存储优化
```env
# 减少数据保留时间
KEEP_WEEKS=26          # 半年

# 启用自动清理
AUTO_CLEANUP=true
```

## 🔄 环境变量优先级

1. **系统环境变量** (最高优先级)
2. **`.env` 文件**
3. **代码默认值** (最低优先级)

示例：
```bash
# 临时覆盖配置
REPO_LIMIT=20 node scripts/update-trending.js
```

## 📝 配置模板

完整的 `.env` 配置示例：

```env
# 必需配置
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 基础配置
AI_BASE_URL=https://api.siliconflow.cn/v1
AI_MODEL=Pro/moonshotai/Kimi-K2-Instruct
REPO_LIMIT=10
SINCE=weekly

# 性能配置
RETRY_ATTEMPTS=3
RETRY_DELAY=5000
MAX_IMAGE_SIZE=5242880
IMAGE_TIMEOUT=30000

# 数据管理
KEEP_WEEKS=52
AUTO_CLEANUP=true

# 调试配置
DEBUG=false
LOG_LEVEL=info
```

---

如果遇到其他配置问题，请查看项目的 [Issues](https://github.com/your-username/GitHub-Trending/issues) 或提交新的问题。