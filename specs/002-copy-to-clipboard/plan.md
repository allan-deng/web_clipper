# 实施计划: 复制到剪贴板

**分支**: `002-copy-to-clipboard` | **日期**: 2025-12-14 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/002-copy-to-clipboard/spec.md` 的功能规范

## 摘要

在浏览器扩展弹窗中添加 "Copy to clipboard" 按钮，允许用户一键将当前网页内容转换为 Markdown 格式并复制到系统剪贴板。此功能完全在浏览器端运行，不依赖后端服务，复用现有的内容提取（Readability）和 Markdown 转换（Turndown）逻辑。

**核心技术方法**:
- 复用 `extractor.js` 提取网页内容
- 复用 `converter.js` 转换为 Markdown
- 复用 `markdown.js` 生成 YAML frontmatter
- 使用 Clipboard API (`navigator.clipboard.writeText()`) 写入剪贴板
- 纯前端实现，无网络请求

## 技术背景

**语言/版本**: JavaScript ES6+ (Manifest V3)
**主要依赖**: Readability.js (内容提取), Turndown.js (HTML→MD), Clipboard API (浏览器原生)
**存储**: N/A (无持久化需求)
**测试**: 手动测试 (浏览器扩展环境)
**目标平台**: Chrome 88+, Edge 88+ (Manifest V3 兼容)
**项目类型**: 浏览器扩展 (纯前端功能)
**性能目标**: < 3 秒完成复制流程 (普通长度文章)
**约束条件**: 离线可用, 无网络请求, 复用现有模块
**规模/范围**: 单一功能增量, 影响文件 < 5 个

## 章程检查

*门控: 必须在阶段 0 研究前通过. 阶段 1 设计后重新检查.*

| 章程原则 | 适用性 | 合规状态 | 说明 |
|----------|--------|----------|------|
| I. 桥接模式架构 | ✅ 适用 | ✅ 通过 | 此功能在浏览器端完成，符合"前端负责数据采集和 UI 渲染"原则 |
| II. 数据安全与隐私 | ⚪ 不适用 | N/A | 无资源下载需求，不涉及防盗链问题 |
| III. 技术栈选型 | ✅ 适用 | ✅ 通过 | 使用原生 JavaScript，复用 Readability/Turndown |
| IV. 工程标准 (原子性) | ⚪ 不适用 | N/A | 无文件写入操作 |
| V. 数据一致性 | ⚪ 不适用 | N/A | 无持久化需求 |
| JavaScript 编码规范 | ✅ 适用 | ✅ 通过 | 使用 async/await，DOM 操作需做空值检查 |

**门控结果**: ✅ 通过 - 无违规项，可继续执行

## 项目结构

### 文档(此功能)

```
specs/002-copy-to-clipboard/
├── spec.md              # 功能规范
├── plan.md              # 此文件
├── research.md          # 阶段 0 输出
├── data-model.md        # 阶段 1 输出
├── quickstart.md        # 阶段 1 输出
├── contracts/           # N/A (无 API)
└── tasks.md             # 阶段 2 输出
```

### 源代码(仓库根目录)

```
extension/
├── popup/
│   ├── popup.html       # [修改] 添加 Copy to clipboard 按钮
│   ├── popup.css        # [修改] 按钮样式
│   └── popup.js         # [修改] 按钮点击处理逻辑
├── services/
│   ├── extractor.js     # [复用] 内容提取
│   ├── converter.js     # [复用] HTML→Markdown
│   └── clipboardService.js  # [新增] 剪贴板操作封装
├── utils/
│   └── markdown.js      # [复用] frontmatter 生成
└── content.js           # [修改] 添加复制消息处理
```

**结构决策**: 遵循现有扩展结构，新增 `clipboardService.js` 封装剪贴板操作，保持关注点分离

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
| 复用现有模块 | ✅ | extractor.js, converter.js, markdown.js |
| 符合 JS 编码规范 | ✅ | async/await, 空值检查 |
