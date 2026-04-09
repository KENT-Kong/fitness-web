# 健身网站部署指南

## 📋 系统概述

这是一个智能健身记录系统，包含：
- Google Sheets云端数据同步
- DeepSeek AI健身助手
- 本地数据缓存和离线支持
- 响应式Web界面

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd fitness-web

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env
```

### 2. 配置环境变量

编辑 `.env` 文件，填入以下必要配置：

#### Google Sheets API 配置
1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 创建新的API密钥
3. 启用Google Sheets API
4. 将API密钥填入 `GOOGLE_SHEETS_API_KEY`

#### Google Sheets ID 获取
1. 打开你的Google Sheets
2. 从URL中复制ID：`https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
3. 填入 `GOOGLE_SHEETS_ID`

#### DeepSeek AI 配置
1. 访问 [DeepSeek平台](https://platform.deepseek.com/api_keys)
2. 获取API密钥
3. 填入 `DEEPSEEK_API_KEY`

### 3. Google Sheets 数据结构要求

你的Google Sheets需要包含以下列：
- 日期 (YYYY-MM-DD格式)
- 体重 (kg)
- 体脂率 (%)
- 早餐、午餐、晚餐、加餐
- 日总摄入 (kcal)、蛋白质 (g)、碳水 (g)、脂肪 (g)
- 饮水 (ml)
- 运动类型和消耗 (kcal)
- 睡眠时长 (小时)、睡眠质量 (1-5)

## 📁 文件结构

```
fitness-web/
├── index.html              # 主页面
├── server.js               # Node.js服务器
├── package.json           # 项目依赖
├── .env.example           # 环境变量模板
├── .env                   # 实际环境变量（不提交）
├── lib/                   # 第三方库
│   ├── chart.umd.min.js   # Chart.js图表库
│   └── xlsx.full.min.js   # Excel处理库
├── data.json             # 本地数据缓存
└── DEPLOYMENT.md         # 部署文档
```

## 🖥️ 本地开发

### 启动开发服务器

```bash
# 启动服务器
npm start

# 或直接运行
node server.js
```

服务器将在 `http://localhost:8080` 启动。

### 运行测试

```bash
# API端点测试
node test-api.js

# Google Sheets连接测试
npm run test:sheets

# 性能测试
# 打开浏览器访问 http://localhost:8080/api/health
```

## ☁️ 云端部署

### Cloudflare Pages 部署

1. **创建新项目**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 进入 Pages → 创建项目

2. **配置构建设置**
   ```
   构建命令：npm install && npm run build
   输出目录：/public
   根目录：fitness-web
   ```

3. **环境变量配置**
   在Cloudflare Pages设置中添加：
   - `GOOGLE_SHEETS_API_KEY`
   - `GOOGLE_SHEETS_ID`
   - `DEEPSEEK_API_KEY`
   - `NODE_ENV=production`

### Vercel 部署

```bash
# 安装Vercel CLI
npm i -g vercel

# 部署
vercel
```

### Railway 部署

1. 连接GitHub仓库
2. 自动检测Node.js项目
3. 设置环境变量
4. 部署完成

## 🔧 配置选项

### 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 否 | 8080 | 服务器端口 |
| `HOST` | 否 | 0.0.0.0 | 服务器监听地址 |
| `CACHE_DURATION` | 否 | 300000 | 数据缓存时长(ms) |
| `ALLOWED_ORIGINS` | 否 | http://localhost:8080 | 允许的跨域来源 |

### 性能优化配置

```env
# 减少Google Sheets API调用
CACHE_DURATION=600000  # 10分钟缓存

# 限制AI助手响应时间
AI_TIMEOUT=10000      # 10秒超时

# 启用Gzip压缩（默认已启用）
ENABLE_GZIP=true
```

## 🚨 故障排除

### 常见问题

#### 1. Google Sheets API错误
```
错误：Google Sheets数据获取失败
原因：API密钥无效或Sheets API未启用
解决：
1. 检查GOOGLE_SHEETS_API_KEY是否正确
2. 确保已启用Google Sheets API
3. 确认Google Sheets ID正确且有访问权限
```

#### 2. AI助手不工作
```
错误：AI功能未配置
解决：设置DEEPSEEK_API_KEY环境变量
```

#### 3. 数据不更新
```
解决：
1. 手动刷新：访问 /api/records/refresh
2. 检查网络连接
3. 查看服务器日志
```

#### 4. 页面加载缓慢
```
优化建议：
1. 启用浏览器缓存
2. 减少第三方库大小
3. 压缩静态资源
```

### 服务器日志

```bash
# 查看实时日志
node server.js

# 生产环境日志
NODE_ENV=production node server.js
```

## 📊 监控与维护

### 健康检查端点
```
GET /api/health
```
返回服务器状态、缓存信息、配置状态。

### 数据统计
- 当前记录数：从 `/api/health` 获取
- 缓存命中率：通过服务器日志分析
- API响应时间：通过性能监控中间件

### 备份策略

1. **自动备份**
   ```bash
   # 创建备份脚本
   node scripts/backup-data.js
   ```

2. **Google Sheets原生备份**
   - 使用Google Sheets的版本历史
   - 定期导出为Excel文件

## 🔐 安全建议

### 生产环境配置

1. **HTTPS强制**
   ```javascript
   // 在生产环境中强制HTTPS
   if (process.env.NODE_ENV === 'production') {
     app.use(require('helmet')());
   }
   ```

2. **API密钥保护**
   - 不要提交 `.env` 文件到版本控制
   - 使用环境变量管理
   - 定期轮换API密钥

3. **访问控制**
   - 限制跨域来源
   - 设置请求频率限制
   - 启用日志审计

### 数据隐私

- 所有数据存储在用户的Google Sheets中
- 服务器仅作为数据中转，不永久存储
- AI聊天内容通过加密传输

## 🔄 更新与维护

### 更新依赖
```bash
npm update
npm audit fix
```

### 数据迁移
如果需要迁移数据格式：
1. 导出当前数据：`/api/records`
2. 转换格式
3. 导入新Google Sheets

### 版本控制
使用语义化版本号：
- `package.json` 中的 `version` 字段
- 每次部署前更新版本号

## 📞 支持与反馈

### 问题报告
1. 查看服务器日志
2. 检查环境变量配置
3. 测试API端点连通性

### 功能请求
通过GitHub Issues提交功能请求或改进建议。

---

**🎯 部署状态检查清单**

- [ ] 环境变量已配置
- [ ] Google Sheets API已启用
- [ ] Google Sheets ID正确
- [ ] DeepSeek API密钥有效
- [ ] 服务器端口可访问
- [ ] 静态资源加载正常
- [ ] API端点响应正常
- [ ] AI助手工作正常
- [ ] 数据同步正常

完成以上检查后，你的健身网站就部署完成了！🎉