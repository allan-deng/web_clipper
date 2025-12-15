# 实施计划: 前端UI与AI功能优化

**分支**: `004-ui-and-ai-enhancements` | **日期**: 2025-12-15 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/004-ui-and-ai-enhancements/spec.md` 的功能规范

## 摘要

本功能包含两大模块优化：
1. **前端 UI 优化**：标记浮窗半透明背景、笔记按钮弹出自定义编辑浮窗（替代原生 prompt）
2. **AI 功能优化**：新增 OpenRouter provider 支持、设置页面展示和编辑 AI summary prompt

**核心技术方法**:
- 使用 CSS rgba 实现半透明背景效果
- 复用现有编辑器组件实现笔记编辑浮窗
- 扩展设置页面支持 OpenRouter 配置和 prompt 自定义
- 使用 Chrome Storage API 持久化用户设置

## 技术背景

**语言/版本**: JavaScript ES6+ (Manifest V3)
**主要依赖**: 原生 DOM API, CSS, Chrome Storage API
**存储**: Chrome Storage API (local)
**测试**: 手动测试 (浏览器扩展环境)
**目标平台**: Chrome 88+, Edge 88+ (Manifest V3 兼容)
**项目类型**: 浏览器扩展 (纯前端功能)
**性能目标**: 浮窗显示 < 100ms, 设置保存 < 500ms
**约束条件**: 纯前端实现, 与现有高亮功能集成
**规模/范围**: 增量功能, 主要修改 content.js、options.js、highlight.css

## 章程检查

*门控: 必须在阶段 0 研究前通过. 阶段 1 设计后重新检查.*

| 章程原则 | 适用性 | 合规状态 | 说明 |
|----------|--------|----------|------|
| I. 桥接模式架构 | ✅ 适用 | ✅ 通过 | 纯前端 UI 交互，符合"前端负责渲染 UI"原则 |
| II. 数据安全与隐私 | ⚪ 部分适用 | ✅ 通过 | OpenRouter API 调用在前端完成，API key 存储在本地 |
| III. 技术栈选型 | ✅ 适用 | ✅ 通过 | 使用原生 JavaScript，无额外框架依赖 |
| IV. 工程标准 | ⚪ 不适用 | N/A | 无文件写入操作 |
| V. 数据一致性 | ⚪ 不适用 | N/A | 设置存储使用 Chrome Storage API |
| JavaScript 编码规范 | ✅ 适用 | ✅ 通过 | 使用 async/await，DOM 操作需做空值检查 |

**门控结果**: ✅ 通过 - 无违规项，可继续执行

## 项目结构

### 文档(此功能)

```
specs/004-ui-and-ai-enhancements/
├── spec.md              # 功能规范
├── plan.md              # 此文件
├── research.md          # 阶段 0 输出
├── data-model.md        # 阶段 1 输出
├── quickstart.md        # 阶段 1 输出
├── contracts/           # N/A (无 API 合约)
└── tasks.md             # 阶段 2 输出
```

### 源代码(仓库根目录)

```
extension/
├── content.js           # [修改] 标记浮窗透明度、笔记编辑浮窗逻辑
├── options/
│   ├── options.html     # [修改] 添加 OpenRouter 和 prompt 设置 UI
│   └── options.js       # [修改] 添加 OpenRouter 和 prompt 保存逻辑
├── popup/
│   └── popup.js         # [可能修改] AI 摘要调用逻辑
└── styles/
    └── highlight.css    # [修改] 浮窗半透明样式
```

**结构决策**: 所有修改集中在现有文件，无需新增文件。UI 优化在 content.js 和 highlight.css，AI 功能优化在 options 目录

## 复杂度跟踪

*无章程违规需要证明*

| 违规 | 为什么需要 | 拒绝更简单替代方案的原因 |
|------|------------|--------------------------|
| 无   | N/A        | N/A                      |

## 设计后章程重检

*阶段 1 设计完成后填写*

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 无后端依赖 | ✅ | 纯前端实现 |
| 原生 JavaScript | ✅ | 无框架依赖 |
| DOM 空值检查 | ✅ | 所有 querySelector 结果需检查 |
| API key 安全存储 | ✅ | 使用 Chrome Storage local |
