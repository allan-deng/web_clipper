# 项目上下文

## 目的

Obsidian Web Clipper 是一个浏览器扩展 + 本地服务的工具组合，允许用户在浏览网页时，零摩擦地将网页正文、高亮笔记、以及 AI 生成的深度总结，一键保存到本地 Obsidian 知识库中。

**核心价值主张**：
- 一键保存网页正文为 Markdown 格式
- 图片自动本地化，确保离线可用
- 支持文本高亮和批注
- AI 智能总结和标签生成

## 技术栈

### 浏览器扩展 (extension/)
- **平台**: Chrome/Chromium 扩展 (Manifest V3)
- **语言**: JavaScript (ES6+)
- **核心库**:
  - Readability.js - 网页正文提取
  - Turndown.js - HTML 转 Markdown
  - Mark.js - 文本高亮

### 后端服务 (server/)
- **语言**: Go 1.21+
- **Web 框架**: Gin
- **配置**: YAML (gopkg.in/yaml.v3)
- **跨域**: gin-contrib/cors

### 构建工具
- **Make**: 跨平台构建脚本
- **Shell**: Bash 脚本用于构建和测试

## 项目约定

### 代码风格

**Go 代码**:
- 使用 `go fmt` 格式化
- 使用 `go vet` 进行静态检查
- 包名使用小写单词
- 导出函数使用 PascalCase

**JavaScript 代码**:
- ES6+ 语法
- 模块化设计 (services/, utils/)
- 函数命名使用 camelCase

### 架构模式

**浏览器扩展架构**:
```
extension/
├── background.js      # Service Worker (后台脚本)
├── content.js         # 内容脚本 (注入网页)
├── popup/             # 弹出窗口 UI
├── options/           # 设置页面
├── services/          # 业务逻辑服务
│   ├── aiService.js       # AI 总结服务
│   ├── apiClient.js       # 与后端通信
│   ├── clipboardService.js # 剪贴板操作
│   ├── converter.js       # 格式转换
│   ├── extractor.js       # 内容提取
│   ├── highlighter.js     # 高亮功能
│   └── imageProcessor.js  # 图片处理
├── utils/             # 工具函数
└── lib/               # 第三方库
```

**后端服务架构**:
```
server/
├── main.go            # 入口
├── config/            # 配置管理
├── handlers/          # HTTP 处理器
├── middleware/        # 中间件 (Auth)
├── models/            # 数据模型
└── services/          # 业务服务
    ├── filewriter.go  # 文件写入
    ├── logger.go      # 日志
    └── sanitizer.go   # 安全清洗
```

### 测试策略

- **Go 测试**: `go test -v ./...`
- **构建验证**: `make test`
- **手动测试**: 在真实网页上验证剪藏效果

### Git 工作流

- **主分支**: `master`
- **功能分支**: `xxx-feature-name` (如 `001-web-clipper-core`)
- **提交信息**: 使用中文，简洁描述变更内容

## 领域上下文

### Obsidian 知识库结构
- 保存路径: `{Vault}/Inbox/WebClips/{YYYY-MM-DD}/{文章标题}/`
- 每篇文章独立子目录，包含 `assets/` 存放图片
- Markdown 文件包含 YAML frontmatter (title, url, date, tags)

### Markdown 排版规范
1. YAML Frontmatter
2. AI 摘要区 (核心论点、Mermaid 图)
3. 用户笔记区 (高亮和批注)
4. 正文区

### 图片处理规则
- 小于 5MB 的图片本地化
- 使用 Hash 生成唯一文件名
- 相对路径引用: `./assets/[hash].png`

## 重要约束

- **浏览器兼容**: 仅支持 Chromium 内核浏览器 (Chrome, Edge)
- **本地服务**: 默认端口 `localhost:18080`
- **认证方式**: 简单静态 Token 鉴权
- **图片大小限制**: 单张 > 5MB 保留远程 URL
- **单次保存限制**: 支持 20 张以内图片，避免浏览器崩溃

## 外部依赖

### AI 服务
- 用户自行配置 LLM API (OpenAI, Claude 等)
- 用于生成文章总结和标签

### 本地依赖
- **Obsidian**: 用户需安装并配置 Obsidian 库路径
- **Go 运行时**: 后端服务需要 Go 1.21+

### 第三方库
| 组件 | 用途 |
|------|------|
| Readability.js | Mozilla 的正文提取库 |
| Turndown.js | HTML 转 Markdown |
| Mark.js | 文本高亮标记 |
| Gin | Go Web 框架 |
