# 实施计划: Obsidian Web Clipper & Assistant

**分支**: `001-web-clipper-core` | **日期**: 2025-12-14 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/001-web-clipper-core/spec.md` 的功能规范

## 摘要

本计划描述 Obsidian Web Clipper & Assistant 的 MVP 实施方案，包括：
- **浏览器扩展 (Frontend)**: 使用原生 JavaScript + Manifest V3，负责内容提取、图片下载、高亮批注、AI 总结请求
- **本地 Go 服务 (Backend)**: 使用 Golang + Gin，负责文件写入、目录管理、原子性保存

核心功能按用户故事优先级实施：
1. P1: 基础网页剪藏 + 图片本地化（MVP 核心）
2. P2: 高亮与笔记
3. P3: AI 深度总结

## 技术背景

**语言/版本**:
- Frontend: JavaScript ES6+ (原生，无构建工具)
- Backend: Go 1.21+

**主要依赖**:
- Frontend: Readability.js (DOM 清洗), Turndown.js (HTML→MD), mark.js (高亮)
- Backend: Gin (HTTP 框架), 标准库 (文件操作)

**存储**: 本地文件系统 (Obsidian Vault 目录)

**测试**:
- Frontend: 手动测试 + 浏览器开发者工具
- Backend: Go testing 包

**目标平台**:
- Frontend: Chrome/Edge (Chromium 内核), Manifest V3
- Backend: Windows/macOS/Linux (跨平台 Go 编译)

**项目类型**: 浏览器扩展 + 本地服务 (C/S 架构)

**性能目标**: 单篇文章保存 < 10 秒 (含 20 张图片)

**约束条件**:
- 单张图片 > 5MB 跳过本地化
- HTTP Body 最大 100MB (应对多图片场景)
- 原子性写入保证

**规模/范围**: 个人使用工具，单用户场景

## 章程检查

*门控: 基于 `.specify/memory/constitution.md` 的合规验证*

| 原则 | 要求 | 计划合规性 | 备注 |
|------|------|------------|------|
| I. 桥接模式架构 | 前端不写文件，后端负责 I/O | ✅ 符合 | 所有文件操作通过 Go Server API |
| II. 数据安全 | 图片在前端下载，API 需鉴权 | ✅ 符合 | 前端 fetch + Base64，Token 鉴权 |
| III. 技术栈 | 原生 JS + Go | ✅ 符合 | 无 React/Vue，使用 Gin 框架 |
| IV. 工程标准 | 原子性写入，路径清洗 | ✅ 符合 | 事务性保存，filepath.Clean |
| V. 数据一致性 | 原子性 + 幂等性 | ✅ 符合 | 全部成功才返回 200，URL Hash 去重 |

## 项目结构

### 文档(此功能)

```
specs/001-web-clipper-core/
├── spec.md              # 功能规范 (已完成)
├── plan.md              # 此文件 - 实施计划
├── research.md          # 技术研究笔记 (可选)
├── data-model.md        # 数据模型定义
├── contracts/           # API 合约定义
│   └── save-api.md      # POST /api/v1/save 合约
├── checklists/
│   └── requirements.md  # 需求检查清单 (已完成)
└── tasks.md             # 实施任务列表 (/speckit.tasks 生成)
```

### 源代码(仓库根目录)

```
obsidian_web_clipper/
├── extension/                    # 浏览器扩展 (Frontend)
│   ├── manifest.json             # MV3 配置
│   ├── background.js             # Service Worker
│   ├── content.js                # 内容脚本 (DOM 操作)
│   ├── popup/
│   │   ├── popup.html            # 弹出窗口 UI
│   │   ├── popup.js              # 弹出窗口逻辑
│   │   └── popup.css             # 样式
│   ├── lib/
│   │   ├── readability.js        # Mozilla Readability
│   │   ├── turndown.js           # HTML→Markdown
│   │   └── mark.js               # 文本高亮
│   ├── services/
│   │   ├── extractor.js          # 内容提取服务
│   │   ├── imageProcessor.js     # 图片处理服务
│   │   ├── highlighter.js        # 高亮服务
│   │   ├── aiService.js          # AI 总结服务
│   │   └── apiClient.js          # 后端 API 客户端
│   └── utils/
│       ├── hash.js               # Hash 生成
│       └── markdown.js           # Markdown 格式化
│
├── server/                       # Go 后端 (Backend)
│   ├── main.go                   # 入口点
│   ├── go.mod                    # Go 模块定义
│   ├── go.sum                    # 依赖锁定
│   ├── config/
│   │   └── config.go             # 配置加载
│   ├── handlers/
│   │   └── save.go               # POST /api/v1/save 处理
│   ├── middleware/
│   │   └── auth.go               # Token 鉴权中间件
│   ├── services/
│   │   ├── fileWriter.go         # 文件写入服务
│   │   └── sanitizer.go          # 路径/文件名清洗
│   └── models/
│       └── webclip.go            # 数据结构定义
│
├── docs/                         # 输入文档 (已存在)
├── specs/                        # 规范文档 (已存在)
└── .specify/                     # SpecKit 框架 (已存在)
```

**结构决策**: 采用分离的 `extension/` 和 `server/` 目录，清晰区分前后端职责。前端为纯静态文件（无构建），后端为独立 Go 模块。

## 技术方案

### 阶段 0: 技术研究

#### 0.1 Readability.js 集成
- 使用 Mozilla 的 `@mozilla/readability` 库
- 需要克隆 DOM 避免修改原页面
- 输出: 清洗后的 HTML + 标题 + 元数据

#### 0.2 Turndown.js 配置
- 自定义规则: 保留代码块语言标记
- 图片处理: 先替换 src 为相对路径，再转换
- 表格支持: 使用 turndown-plugin-gfm

#### 0.3 图片下载策略
- 使用 `fetch()` 在 content script 中下载（利用页面 Cookie）
- 转换为 Blob → Base64
- 生成 SHA256 hash 作为文件名
- 跳过 > 5MB 的图片

#### 0.4 Manifest V3 限制
- Service Worker 替代 Background Page
- 无持久化后台脚本，需处理唤醒
- 使用 `chrome.storage` 存储配置

### 阶段 1: 核心设计

#### 1.1 数据流

```
用户点击保存
    ↓
[Content Script]
    ├── Readability 提取正文 HTML
    ├── 遍历 <img>，fetch 下载图片
    ├── 图片转 Base64，生成 hash 文件名
    ├── 替换 HTML 中图片 src 为相对路径
    ├── Turndown 转换 HTML → Markdown
    ├── 收集高亮和批注数据
    └── (可选) 调用 AI 服务生成总结
    ↓
[Background Script]
    └── 打包 JSON Payload，发送到本地服务
    ↓
[Go Server - POST /api/v1/save]
    ├── Token 鉴权
    ├── 清洗文件名/路径
    ├── 创建日期目录 + 文章子目录
    ├── 并发写入图片文件
    ├── 写入 Markdown 文件
    └── 原子性确认，返回保存路径
```

#### 1.2 错误处理策略

| 场景 | 处理方式 |
|------|----------|
| 图片下载失败 | 保留原始 URL，添加注释标记 |
| AI 服务不可用 | 显示占位符 "[AI 总结待生成]" |
| 后端连接失败 | 前端显示错误，引导启动服务 |
| 磁盘写入失败 | 回滚已写入文件，返回具体错误 |
| 重复保存 | 生成版本号文件名 (如 _v2) |

#### 1.3 配置项

**前端配置 (chrome.storage)**:
- `serverUrl`: 后端地址 (默认 `http://localhost:18080`)
- `authToken`: 鉴权 Token
- `aiEnabled`: 是否启用 AI 总结
- `aiApiKey`: LLM API Key
- `aiModel`: LLM 模型选择

**后端配置 (config.yaml 或环境变量)**:
- `port`: 监听端口 (默认 18080)
- `vaultPath`: Obsidian Vault 根目录
- `authToken`: 鉴权 Token
- `maxBodySize`: 最大请求体 (默认 100MB)

## 复杂度跟踪

*本计划无章程违规，无需复杂度证明*

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 构建工具引入 | ❌ 未引入 | 使用原生 JS，无 Webpack/Vite |
| 框架引入 | ✅ Gin | 轻量级，符合章程 III |
| 数据库引入 | ❌ 未引入 | 纯文件系统存储 |

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 大文件 JSON 导致内存问题 | 中 | 高 | 5MB 图片限制，100MB 总限制 |
| 跨域图片下载失败 | 中 | 中 | 降级为保留原始 URL |
| AI 服务响应慢 | 高 | 低 | 异步处理，不阻塞保存 |
| Windows 路径兼容性 | 中 | 中 | 使用 filepath 包 |

## 下一步

1. 运行 `/speckit.tasks` 生成详细任务列表
2. 按用户故事优先级实施：
   - 先完成 P1 (基础剪藏 + 图片) 作为 MVP
   - 再添加 P2 (高亮笔记)
   - 最后添加 P3 (AI 总结)
