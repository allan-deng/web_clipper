# 任务: Web Clipper & Assistant

**输入**: 来自 `/specs/001-web-clipper-core/` 的设计文档
**前置条件**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | contracts/ ✅

**组织结构**: 任务按用户故事分组，以便每个故事能够独立实施和测试。

## 格式说明
- **[P]**: 可以并行运行（不同文件，无依赖关系）
- **[USx]**: 此任务属于哪个用户故事
- 每个任务包含确切的文件路径

## 路径约定
- **浏览器扩展**: `extension/`
- **Go 后端**: `server/`

---

## 阶段 1: 设置（共享基础设施）

**目的**: 项目初始化和基本结构

- [x] T001 根据 plan.md 创建项目目录结构：`extension/` 和 `server/`
- [x] T002 [P] 在 `server/` 中初始化 Go 模块：创建 `server/go.mod` 文件，模块名 `obsidian-clipper-server`
- [x] T003 [P] 创建浏览器扩展清单文件 `extension/manifest.json`，配置 Manifest V3、权限和脚本
- [x] T004 [P] 下载并放置第三方库到 `extension/lib/`：readability.js、turndown.js、mark.js
- [x] T005 创建后端配置示例文件 `server/config.example.yaml`，包含 port、auth.token、vault.path 等配置项

**检查点**: 项目骨架就绪，可以开始基础设施开发

---

## 阶段 2: 基础（阻塞前置条件）

**目的**: 在任何用户故事可以实施之前必须完成的核心基础设施

**⚠️ 关键**: 在此阶段完成之前，无法开始任何用户故事工作

### 后端基础

- [x] T006 在 `server/config/config.go` 中实现配置加载模块：读取 YAML 配置文件，支持环境变量覆盖
- [x] T007 [P] 在 `server/models/webclip.go` 中定义数据结构：SaveRequest、SaveResponse、Metadata、Content、Asset、Highlight 结构体
- [x] T008 [P] 在 `server/middleware/auth.go` 中实现 Token 鉴权中间件：验证 Authorization Header
- [x] T009 在 `server/services/sanitizer.go` 中实现文件名/路径清洗服务：移除非法字符、防止路径穿越、限制长度
- [x] T010 在 `server/main.go` 中设置 Gin 路由和中间件：配置 CORS、最大请求体、健康检查端点
- [x] T011 在 `server/handlers/health.go` 中实现健康检查端点 `GET /health`

### 前端基础

- [x] T012 [P] 在 `extension/background.js` 中创建 Service Worker 骨架：消息监听、配置存储访问
- [x] T013 [P] 在 `extension/services/apiClient.js` 中实现后端 API 客户端：封装 fetch 调用、Token 携带、错误处理
- [x] T014 在 `extension/popup/popup.html` 中创建弹出窗口 UI 骨架：保存按钮、状态显示、设置入口
- [x] T015 [P] 在 `extension/popup/popup.css` 中创建基础样式
- [x] T016 在 `extension/popup/popup.js` 中实现弹出窗口逻辑骨架：按钮点击处理、状态更新
- [x] T017 在 `extension/options/options.html` 和 `extension/options/options.js` 中创建设置页面：服务器地址、Token、AI 配置

**检查点**: 基础就绪 - 前后端可以通信，现在可以开始并行实施用户故事

---

## 阶段 3: 用户故事 1+2 - 基础网页剪藏 + 图片本地化（优先级: P1）🎯 MVP

**目标**: 用户可以一键将网页正文提取为 Markdown 并保存到 Obsidian，图片自动下载到本地

**独立测试**: 在任意新闻网站点击保存，验证 Markdown 和图片是否正确保存到 Obsidian 目录

> **注意**: US1 和 US2 合并为一个阶段，因为图片本地化是剪藏的核心组成部分，无法独立交付价值。

### 用户故事 1+2 的实施 - 前端

- [x] T018 [P] [US1] 在 `extension/utils/hash.js` 中实现 SHA256 hash 生成工具：用于图片文件名
- [x] T019 [P] [US1] 在 `extension/utils/markdown.js` 中实现 Markdown 格式化工具：YAML frontmatter 生成、内容拼接
- [x] T020 [US1] 在 `extension/services/extractor.js` 中实现内容提取服务：使用 Readability 提取正文 HTML、获取标题和元数据
- [x] T021 [US2] 在 `extension/services/imageProcessor.js` 中实现图片处理服务：遍历 img 标签、fetch 下载、转 Base64、生成 hash 文件名、替换 src 为相对路径、跳过 >5MB 图片
- [x] T022 [US1] 在 `extension/services/converter.js` 中实现 HTML 到 Markdown 转换服务：配置 Turndown、处理代码块、表格、引用
- [x] T023 [US1] 在 `extension/content.js` 中实现内容脚本主逻辑：协调 extractor、imageProcessor、converter，组装 SaveRequest
- [x] T024 [US1] 在 `extension/background.js` 中完善消息处理：接收 content script 数据，调用 apiClient 发送保存请求
- [x] T025 [US1] 在 `extension/popup/popup.js` 中完善保存按钮逻辑：发送消息到 content script、显示进度、处理结果

### 用户故事 1+2 的实施 - 后端

- [x] T026 [US1] 在 `server/services/fileWriter.go` 中实现文件写入服务：创建日期目录、文章子目录、写入 Markdown 文件
- [x] T027 [US2] 在 `server/services/fileWriter.go` 中扩展图片写入功能：解码 Base64、创建 assets 目录、并发写入图片
- [x] T028 [US1] 在 `server/services/fileWriter.go` 中实现原子性写入：临时目录写入、成功后重命名、失败时清理
- [x] T029 [US1] 在 `server/services/fileWriter.go` 中实现版本控制：检测重复保存、生成 _v2/_v3 后缀
- [x] T030 [US1] 在 `server/handlers/save.go` 中实现 `POST /api/v1/save` 处理器：解析请求、调用 fileWriter、返回结果

### 集成和验证

- [ ] T031 [US1] 端到端测试：在浏览器中加载扩展，访问测试网页，点击保存，验证文件生成
- [ ] T032 [US2] 图片本地化验证：保存含图片文章，断开网络，在 Obsidian 中验证图片显示

**检查点**: MVP 完成 - 用户可以保存网页和图片到 Obsidian

---

## 阶段 4: 用户故事 3 - 高亮与笔记（优先级: P2）

**目标**: 用户可以在网页上高亮文字并添加批注，保存时导出到 Markdown

**独立测试**: 选中文字添加高亮和批注，保存后验证 Markdown 中包含"我的笔记"区域

### 用户故事 3 的实施

- [x] T033 [P] [US3] 在 `extension/styles/highlight.css` 中创建高亮样式：背景色、批注气泡
- [x] T034 [US3] 在 `extension/services/highlighter.js` 中实现高亮服务：监听文本选择、显示悬浮菜单、应用高亮样式、管理高亮数据
- [x] T035 [US3] 在 `extension/services/highlighter.js` 中实现批注功能：显示批注输入框、关联批注与高亮
- [x] T036 [US3] 在 `extension/content.js` 中集成高亮服务：初始化 highlighter、在保存时收集高亮数据
- [x] T037 [US3] 在 `extension/utils/markdown.js` 中扩展 Markdown 生成：添加"我的笔记"区域、格式化高亮和批注
- [ ] T038 [US3] 验证高亮功能：添加多个高亮和批注，保存后检查 Markdown 格式

**检查点**: 高亮与笔记功能完成，可独立使用

---

## 阶段 5: 用户故事 4 - AI 深度总结（优先级: P3）

**目标**: 系统自动生成 AI 总结，包含核心观点和 Mermaid 逻辑图

**独立测试**: 配置 AI 服务后保存长文，验证 Markdown 中包含 AI 摘要区

### 用户故事 4 的实施

- [x] T039 [P] [US4] 在 `extension/services/aiService.js` 中实现 AI 服务接口：支持 OpenAI/Anthropic API 调用
- [x] T040 [US4] 在 `extension/services/aiService.js` 中实现总结生成逻辑：构建 prompt、解析响应、提取 keyPoints/evidence/mermaid
- [x] T041 [US4] 在 `extension/services/aiService.js` 中实现标签生成功能：请求 AI 生成 3-5 个相关标签
- [x] T042 [US4] 在 `extension/services/aiService.js` 中实现错误处理：服务不可用时返回 PENDING 状态占位符
- [ ] T043 [US4] 在 `extension/content.js` 中集成 AI 服务：在保存流程中调用 aiService（可配置开关）
- [x] T044 [US4] 在 `extension/utils/markdown.js` 中扩展 Markdown 生成：添加 AI 摘要区、Mermaid 代码块
- [x] T045 [US4] 在 `extension/options/options.js` 中添加 AI 配置界面：启用开关、API Provider、API Key、模型选择
- [ ] T046 [US4] 验证 AI 功能：配置 API Key，保存文章，检查 AI 摘要和标签

**检查点**: AI 总结功能完成，所有核心功能已实现

---

## 阶段 6: 完善与横切关注点

**目的**: 影响多个用户故事的改进和收尾工作

- [x] T047 [P] 在 `extension/popup/popup.css` 中完善 UI 样式：加载动画、成功/失败状态、响应式布局
- [x] T048 [P] 在 `server/` 中添加日志记录：请求日志、错误日志、性能日志
- [x] T049 边界情况处理：无正文内容提示、服务未运行提示、权限不足错误
- [ ] T050 [P] 创建 `README.md`：项目介绍、安装说明、使用指南
- [x] T051 创建后端构建脚本：支持 Windows/macOS/Linux 交叉编译
- [ ] T052 运行 `specs/001-web-clipper-core/quickstart.md` 完整验证流程

---

## 依赖关系与执行顺序

### 阶段依赖关系

```
阶段 1: 设置
    ↓
阶段 2: 基础 ← 阻塞所有用户故事
    ↓
阶段 3: US1+US2 (P1) ← MVP 核心
    ↓
阶段 4: US3 (P2) ← 可选增强
    ↓
阶段 5: US4 (P3) ← 可选增强
    ↓
阶段 6: 完善
```

### 用户故事依赖关系

- **US1+US2 (P1)**: 基础完成后可开始，是 MVP 核心
- **US3 (P2)**: 依赖 US1 的 content.js 和 markdown.js，但可独立测试
- **US4 (P3)**: 依赖 US1 的提取流程，但可独立测试

### 每个阶段内部

- 标记 [P] 的任务可以并行执行
- 模型/工具 → 服务 → 处理器/集成 → 验证
- 前端和后端任务可以并行开发

### 并行机会

- T002, T003, T004 可以并行（阶段 1）
- T007, T008, T012, T013, T015 可以并行（阶段 2）
- T018, T019 可以并行（阶段 3）
- 前端团队和后端团队可以并行工作

---

## 并行示例

### 阶段 2 并行任务

```bash
# 后端并行任务:
T007: 在 server/models/webclip.go 中定义数据结构
T008: 在 server/middleware/auth.go 中实现鉴权中间件

# 前端并行任务:
T012: 在 extension/background.js 中创建 Service Worker
T013: 在 extension/services/apiClient.js 中实现 API 客户端
T015: 在 extension/popup/popup.css 中创建样式
```

### 阶段 3 并行任务

```bash
# 前端工具可并行:
T018: 在 extension/utils/hash.js 中实现 hash 工具
T019: 在 extension/utils/markdown.js 中实现 Markdown 工具

# 前后端可并行开发:
前端: T020-T025 (内容提取、图片处理、转换)
后端: T026-T030 (文件写入、原子性、API)
```

---

## 实施策略

### 仅 MVP（推荐首次交付）

1. 完成阶段 1: 设置 (T001-T005)
2. 完成阶段 2: 基础 (T006-T017)
3. 完成阶段 3: US1+US2 (T018-T032)
4. **停止并验证**: 测试完整的保存流程
5. 可交付 MVP 版本

### 增量交付

1. MVP 完成后 → 发布 v0.1
2. 添加 US3 高亮功能 → 发布 v0.2
3. 添加 US4 AI 功能 → 发布 v0.3
4. 完善收尾 → 发布 v1.0

---

## 任务统计

| 阶段 | 任务数 | 并行任务 |
|------|--------|----------|
| 阶段 1: 设置 | 5 | 3 |
| 阶段 2: 基础 | 12 | 6 |
| 阶段 3: US1+US2 | 15 | 2 |
| 阶段 4: US3 | 6 | 1 |
| 阶段 5: US4 | 8 | 1 |
| 阶段 6: 完善 | 6 | 3 |
| **总计** | **52** | **16** |

### 按用户故事统计

| 用户故事 | 任务数 | 说明 |
|----------|--------|------|
| US1+US2 | 15 | MVP 核心 |
| US3 | 6 | 高亮笔记 |
| US4 | 8 | AI 总结 |
| 基础/完善 | 23 | 共享基础设施 |

---

## 注意事项

- [P] 任务 = 不同文件，无依赖关系，可并行执行
- [USx] 标签将任务映射到用户故事以实现可追溯性
- MVP 仅需完成阶段 1-3 (32 个任务)
- 每个任务完成后应立即提交
- 在每个检查点停止以验证功能
