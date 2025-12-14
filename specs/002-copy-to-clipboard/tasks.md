# 任务清单: 复制到剪贴板

**功能分支**: `002-copy-to-clipboard`
**创建时间**: 2025-12-14
**规范**: [spec.md](./spec.md) | **计划**: [plan.md](./plan.md)

## 摘要

| 指标 | 值 |
|------|-----|
| 总任务数 | 12 |
| 阶段数 | 4 |
| 预估复杂度 | 低 (单一功能增量) |
| 并行机会 | 3 组 |

## 用户故事映射

| 故事 | 优先级 | 任务数 | 独立测试标准 |
|------|--------|--------|--------------|
| US1: 一键复制网页为 Markdown | P1 | 5 | 点击按钮 → 粘贴到编辑器 → 验证 Markdown 格式 |
| US2: 包含页面元信息 | P2 | 2 | 检查 Markdown 顶部是否包含 YAML frontmatter |
| US3: 复制失败错误处理 | P2 | 2 | 模拟错误场景 → 验证错误提示显示 |

## 依赖关系图

```
阶段 1: 设置
    └── T001 (clipboardService.js)

阶段 2: 基础 (阻塞)
    └── T002 (popup 按钮 UI) ─┬─► 阶段 3
                              │
阶段 3: US1 核心复制 ◄────────┘
    ├── T003 [P] (popup.js 按钮处理)
    ├── T004 [P] (content.js 消息处理)
    └── T005 (集成验证)
         │
         ▼
阶段 4: US2+US3 增强
    ├── T006 [P] [US2] (frontmatter 集成)
    ├── T007 [US2] (US2 验证)
    ├── T008 [P] [US3] (错误处理)
    ├── T009 [US3] (US3 验证)
    └── T010-T012 (完善)
```

## 并行执行示例

**阶段 3 (US1)**: T003 和 T004 可并行
```
开发者 A: T003 (popup.js)
开发者 B: T004 (content.js)
同步点: T005 (集成验证)
```

**阶段 4 (US2+US3)**: T006 和 T008 可并行
```
开发者 A: T006 → T007 (US2 元信息)
开发者 B: T008 → T009 (US3 错误处理)
同步点: T010 (完善)
```

---

## 阶段 1: 设置

### 目标
创建剪贴板服务模块，封装 Clipboard API 操作。

- [x] T001 在 `extension/services/clipboardService.js` 中创建剪贴板服务模块
  - 实现 `copyToClipboard(text)` 函数，使用 `navigator.clipboard.writeText()`
  - 返回 `{ success: boolean, error?: string }` 结构
  - 处理 Clipboard API 权限异常
  - 参考 `research.md` 中的实现示例

**检查点**: clipboardService.js 文件存在且可导入

---

## 阶段 2: 基础 (UI)

### 目标
在弹窗界面添加 "Copy to clipboard" 按钮。

- [x] T002 在 `extension/popup/popup.html` 和 `extension/popup/popup.css` 中添加按钮 UI
  - 在现有 "Save" 按钮旁边添加 "Copy to clipboard" 按钮
  - 按钮 ID: `copyBtn`
  - 样式与现有按钮保持一致
  - 添加状态类: `.btn-processing`, `.btn-success`, `.btn-error`

**检查点**: 加载扩展后在弹窗中可见新按钮

---

## 阶段 3: US1 - 一键复制网页为 Markdown (P1)

### 故事目标
用户点击按钮，将当前网页转换为 Markdown 并复制到剪贴板。

### 独立测试
1. 访问任意文章页面
2. 点击 "Copy to clipboard" 按钮
3. 打开文本编辑器粘贴
4. 验证内容为有效 Markdown

### 任务

- [x] T003 [P] [US1] 在 `extension/popup/popup.js` 中实现按钮点击处理逻辑
  - 为 `#copyBtn` 添加 click 事件监听
  - 点击时禁用按钮，显示 "处理中..." 状态 (FR-009)
  - 向 content script 发送 `COPY_TO_CLIPBOARD` 消息
  - 接收响应后更新按钮状态 (成功/失败)
  - 操作完成后恢复按钮状态 (FR-010)
  - 成功时显示 "已复制!" 提示 (FR-006)

- [x] T004 [P] [US1] 在 `extension/content.js` 中添加复制消息处理
  - 监听 `COPY_TO_CLIPBOARD` 消息
  - 复用 `extractor.js` 提取页面内容 (FR-002)
  - 复用 `converter.js` 转换为 Markdown (FR-003)
  - 调用 `clipboardService.copyToClipboard()` 复制到剪贴板 (FR-004)
  - 确保不发起任何网络请求 (FR-005)
  - 返回操作结果给 popup

- [x] T005 [US1] 验证 US1 核心流程 (手动测试)
  - 在文章页面测试完整复制流程
  - 验证粘贴内容为有效 Markdown
  - 验证按钮状态转换正确 (idle → processing → success)
  - 验证离线状态下功能正常 (SC-003)

**阶段检查点**: US1 可独立演示 - 用户可复制文章为 Markdown

---

## 阶段 4: US2 + US3 - 元信息与错误处理 (P2)

### US2 故事目标
复制的 Markdown 包含页面元信息 (标题、URL、时间)。

### US2 独立测试
1. 复制任意网页
2. 检查 Markdown 顶部是否有 YAML frontmatter

### US2 任务

- [x] T006 [P] [US2] 在 `extension/content.js` 的复制流程中集成 frontmatter 生成
  - 复用 `markdown.js` 中的 `generateFrontmatter()` 函数
  - 确保 frontmatter 包含: title, source (URL), clipped (时间戳)
  - 将 frontmatter 与 Markdown 正文拼接 (FR-008)

- [x] T007 [US2] 验证 US2 元信息 (手动测试)
  - 测试多个不同网站
  - 验证 frontmatter 格式正确
  - 验证时间戳为 ISO 8601 格式

**US2 检查点**: 复制的 Markdown 顶部包含完整 YAML frontmatter

---

### US3 故事目标
复制失败时显示清晰的错误提示。

### US3 独立测试
1. 模拟剪贴板权限被拒绝场景
2. 验证显示友好错误提示

### US3 任务

- [x] T008 [P] [US3] 在 `extension/popup/popup.js` 和 `extension/content.js` 中实现错误处理
  - 定义错误类型枚举 (参考 data-model.md):
    - CLIPBOARD_DENIED: "无法访问剪贴板，请检查浏览器权限设置"
    - EXTRACTION_FAILED: "无法从此页面提取内容"
    - NO_CONTENT: "此页面没有可提取的文章内容"
    - UNKNOWN_ERROR: "复制失败，请重试"
  - 在 popup 中显示错误消息 (FR-007)
  - 按钮显示错误状态后 3 秒恢复

- [x] T009 [US3] 验证 US3 错误处理 (手动测试)
  - 测试 about:blank 页面 (无内容场景)
  - 验证错误提示显示正确
  - 验证按钮状态恢复正常

**US3 检查点**: 所有错误场景显示用户友好提示

---

## 阶段 5: 完善

### 目标
边界情况处理和代码质量优化。

- [x] T010 处理边界情况
  - 长内容 (>100,000 字符): 确保不阻塞 UI
  - 快速重复点击: 按钮禁用机制防止重复执行
  - 复杂页面结构 (表格、代码块): 验证 Markdown 格式正确

- [x] T011 代码质量检查
  - 确保所有 async 函数使用 try-catch
  - 确保所有 DOM 操作有空值检查
  - 移除调试代码和 console.log

- [x] T012 按照 quickstart.md 执行完整验收测试 (手动测试)
  - 执行所有验收检查清单项目
  - 验证性能目标 (< 3 秒)
  - 记录任何发现的问题

**最终检查点**: 功能完成，可合并到主分支

---

## 实现策略

### MVP 范围
**仅 US1 (阶段 1-3)** 即为可交付的 MVP:
- 用户可点击按钮复制网页为 Markdown
- 无需元信息或错误处理即可使用

### 增量交付
1. **MVP**: US1 (T001-T005) - 核心复制功能
2. **增强**: US2 (T006-T007) - 元信息
3. **完善**: US3 (T008-T009) - 错误处理
4. **收尾**: T010-T012 - 边界情况和验收

### 风险缓解
- **低风险**: 复用现有模块 (extractor.js, converter.js)
- **已验证**: Clipboard API 在目标浏览器中可用
- **无后端依赖**: 无集成风险
