<!--
================================================================================
同步影响报告

版本更改: 无 → 1.0.0 (初始版本)
批准日期: 2025-12-14
最后修正: 2025-12-14

修改的原则:
  - [新增] I. 桥接模式架构 (Bridge Pattern Architecture)
  - [新增] II. 数据安全与隐私 (Data Security & Privacy)
  - [新增] III. 技术栈选型 (Tech Stack)
  - [新增] IV. 工程标准 (Engineering Standards)
  - [新增] V. 数据一致性 (Data Integrity)

添加的部分:
  - 核心原则 (5 项)
  - 编码规范 (Golang, JavaScript)
  - 治理

删除的部分: 无 (初始版本)

需要更新的模板:
  - .specify/templates/plan-template.md     ✅ 无需更新 (通用引用章程)
  - .specify/templates/spec-template.md     ✅ 无需更新 (与章程兼容)
  - .specify/templates/tasks-template.md    ✅ 无需更新 (与章程兼容)
  - .specify/templates/checklist-template.md ✅ 无需更新 (通用模板)
  - .specify/templates/agent-file-template.md ✅ 无需更新 (通用模板)

后续 TODO: 无
================================================================================
-->

# Obsidian Web Clipper 项目章程

## 核心原则

### I. 桥接模式架构 (Bridge Pattern Architecture)

本项目采用 C/S (Client-Server) 架构，而非传统浏览器插件模式。

**浏览器端 (Client)**
- 被视为"不可信且受限"的沙箱环境
- 唯一职责：数据采集、清洗、渲染 UI
- **禁止**：直接尝试写入本地文件系统（包括 Downloads API，本项目禁用）

**本地 Go 服务 (Server)**
- 是系统的"核心引擎"
- **强制**：所有文件写入操作必须通过 Go Server 完成
- **强制**：图片必须在前端转换为 Base64 或 Blob 传输，禁止后端直接下载（规避防盗链）
- **强制**：核心业务逻辑（清洗、AI 总结）优先在插件端完成，后端主要负责 I/O 和持久化

### II. 数据安全与隐私 (Data Security & Privacy)

**反爬策略优先**
- 所有图片下载、网页内容抓取，必须在浏览器端完成（利用当前 Session 的 Cookie 和 Referer）
- 后端严禁直接通过 URL 下载资源，以避免防盗链（403 Forbidden）问题

**访问控制**
- 尽管是 Localhost 服务，为防止恶意网页扫描本地端口写入垃圾文件，API 调用必须携带简单的 Auth Token 进行鉴权

### III. 技术栈选型 (Tech Stack)

**Frontend (轻量化)**
- 坚持使用原生 JavaScript (ES6+)，配合 Manifest V3
- 不引入 React/Vue 等构建流程，保持插件轻便、易维护
- 核心依赖：Readability（清洗）、Turndown（转 MD）、mark.js（高亮）

**Backend (高性能)**
- 使用 Golang（Gin 或标准库）
- 利用 Go 的并发优势处理多图片写入

### IV. 工程标准 (Engineering Standards)

**原子性写入 (Atomicity)**
- 这是一个"事务性"操作
- 只有当 Markdown 文本和所有引用的图片都成功写入磁盘后，才向前端返回 200 OK
- 如果中途失败，应尝试清理已写入的垃圾文件

**路径安全**
- 所有输入的文件名必须经过 Sanitization（清洗）
- 严防 `../../` 路径穿越攻击

### V. 数据一致性 (Data Integrity)

- **原子性要求**：只有当 Markdown 和图片都写入成功，才返回成功状态
- **幂等性**：重复保存同一网页，应通过 Hash 或版本号处理，避免文件覆盖或生成重复内容

## 编码规范

### Golang

- 必须处理所有 error，禁止简单的 `_` 忽略
- 文件路径操作必须使用 `filepath` 包以兼容 Windows/macOS/Linux
- API 响应必须统一封装结构：`{ code, msg, data }`
- 必须对输入的文件名进行 Sanitize（去除非法字符），防止路径穿越攻击

### JavaScript

- 使用 async/await 处理异步操作
- DOM 操作必须做空值检查（Null Check），防止页面结构变化导致 Crash

## 治理

**章程优先级**
- 本章程优先于所有其他开发实践
- 修正需要文档化、批准和迁移计划

**合规要求**
- 所有 PR/审查必须验证与章程原则的合规性
- 复杂性偏离必须在实施计划中得到明确证明

**版本控制**
- MAJOR：向后不兼容的治理/原则删除或重新定义
- MINOR：新原则/部分添加或实质性扩展指导
- PATCH：澄清、措辞、拼写错误修复、非语义优化

**版本**: 1.0.0 | **批准日期**: 2025-12-14 | **最后修正**: 2025-12-14
