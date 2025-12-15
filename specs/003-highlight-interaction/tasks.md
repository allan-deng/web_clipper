# 任务: 高亮交互优化

**输入**: 来自 `/specs/003-highlight-interaction/` 的设计文档
**前置条件**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**测试**: 手动测试（浏览器扩展环境）- 无自动化测试要求

**组织结构**: 任务按用户故事分组，以便每个故事能够独立实施和测试

## 格式: `[ID] [P?] [Story] 描述`
- **[P]**: 可以并行运行（不同文件，无依赖关系）
- **[Story]**: 此任务属于哪个用户故事（US1、US2、US3）
- 在描述中包含确切的文件路径

## 路径约定
- **扩展源码**: `extension/`
- **样式文件**: `extension/styles/`

---

## 阶段 1: 设置（共享基础设施）

**目的**: 创建交互功能所需的 DOM 容器和基础样式

- [x] T001 在 extension/content.js 中创建浮窗和编辑器的 DOM 容器函数
- [x] T002 [P] 在 extension/styles/highlight.css 中添加浮窗基础样式（位置、尺寸、颜色）
- [x] T003 [P] 在 extension/styles/highlight.css 中添加编辑器基础样式（布局、按钮、输入框）

---

## 阶段 2: 基础（阻塞前置条件）

**目的**: 实现所有用户故事共享的工具函数

**⚠️ 关键**: 在此阶段完成之前，无法开始任何用户故事工作

- [x] T004 在 extension/content.js 中实现 getTooltipPosition() 函数 - 计算浮窗/编辑器位置并处理视口边界
- [x] T005 在 extension/content.js 中实现 getHighlightById() 函数 - 根据 ID 查找高亮数据
- [x] T006 在 extension/content.js 中实现 initHighlightInteractions() 函数骨架 - 为高亮元素绑定事件

**检查点**: ✅ 基础就绪 - 位置计算和事件绑定框架已完成

---

## 阶段 3: 用户故事 1 - 悬停查看笔记浮窗（优先级: P1）🎯 MVP

**目标**: 用户悬停到带笔记的高亮时显示笔记内容浮窗

**独立测试**: 创建带笔记的高亮，悬停验证浮窗显示，移出验证浮窗消失

### 用户故事 1 的实施

- [x] T007 [US1] 在 extension/content.js 中实现 createTooltipElement() 函数 - 动态创建浮窗 DOM 元素
- [x] T008 [US1] 在 extension/content.js 中实现 showNoteTooltip(highlight, targetElement) 函数 - 显示浮窗并设置内容和位置
- [x] T009 [US1] 在 extension/content.js 中实现 hideNoteTooltip() 函数 - 隐藏浮窗
- [x] T010 [US1] 在 extension/content.js 中实现 hideNoteTooltipDelayed() 函数 - 延迟 300ms 隐藏浮窗
- [x] T011 [US1] 在 extension/content.js 的 initHighlightInteractions() 中添加 mouseenter 事件处理 - 检查笔记存在性并调用 showNoteTooltip
- [x] T012 [US1] 在 extension/content.js 的 initHighlightInteractions() 中添加 mouseleave 事件处理 - 调用 hideNoteTooltipDelayed
- [x] T013 [US1] 在 extension/content.js 中为浮窗元素添加 mouseenter/mouseleave 事件 - 允许鼠标移入浮窗时保持显示
- [x] T014 [US1] 在 extension/styles/highlight.css 中添加浮窗滚动条样式 - 长内容时显示滚动条

**检查点**: ✅ 悬停浮窗功能完成 - 可独立测试 US1

---

## 阶段 4: 用户故事 2 - 点击编辑笔记（优先级: P1）

**目标**: 用户点击高亮时打开笔记编辑器，支持编辑和保存

**独立测试**: 点击高亮验证编辑器打开，输入内容保存，再次悬停验证更新

### 用户故事 2 的实施

- [x] T015 [US2] 在 extension/content.js 中实现 createEditorElement() 函数 - 动态创建编辑器 DOM（textarea + 按钮组）
- [x] T016 [US2] 在 extension/content.js 中实现 showNoteEditor(highlight, targetElement) 函数 - 显示编辑器，预填充现有笔记
- [x] T017 [US2] 在 extension/content.js 中实现 hideNoteEditor() 函数 - 隐藏编辑器不保存
- [x] T018 [US2] 在 extension/content.js 中实现 saveNoteFromEditor() 函数 - 保存编辑器内容到高亮对象
- [x] T019 [US2] 在 extension/content.js 中实现 updateHighlightNote(highlightId, newNote) 函数 - 更新 highlights 数组中的笔记
- [x] T020 [US2] 在 extension/content.js 的 initHighlightInteractions() 中添加 click 事件处理 - 隐藏浮窗并调用 showNoteEditor
- [x] T021 [US2] 在 extension/content.js 中为编辑器保存按钮添加 click 事件 - 调用 saveNoteFromEditor
- [x] T022 [US2] 在 extension/content.js 中为编辑器取消按钮添加 click 事件 - 调用 hideNoteEditor
- [x] T023 [US2] 在 extension/content.js 中为编辑器 textarea 添加 keydown 事件 - Enter 保存，Escape 取消
- [x] T024 [US2] 在 extension/content.js 中实现点击编辑器外部关闭功能 - document click 事件监听

**检查点**: ✅ 编辑器功能完成 - 可独立测试 US1 和 US2

---

## 阶段 5: 用户故事 3 - 删除高亮和笔记（优先级: P2）

**目标**: 用户可以删除已创建的高亮，文本恢复为普通文本

**独立测试**: 在编辑器中点击删除，确认后验证高亮被移除

### 用户故事 3 的实施

- [x] T025 [US3] 在 extension/content.js 的 createEditorElement() 中添加删除按钮 DOM
- [x] T026 [US3] 在 extension/content.js 中实现 showDeleteConfirmation() 函数 - 切换编辑器到删除确认模式
- [x] T027 [US3] 在 extension/content.js 中实现 hideDeleteConfirmation() 函数 - 返回编辑模式
- [x] T028 [US3] 在 extension/content.js 中实现 removeHighlight(highlightId) 函数 - 从 DOM 移除高亮元素，恢复原始文本
- [x] T029 [US3] 在 extension/content.js 中为删除按钮添加 click 事件 - 调用 showDeleteConfirmation
- [x] T030 [US3] 在 extension/content.js 中为确认删除按钮添加 click 事件 - 调用 removeHighlight 并关闭编辑器
- [x] T031 [US3] 在 extension/content.js 中为取消删除按钮添加 click 事件 - 调用 hideDeleteConfirmation
- [x] T032 [US3] 在 extension/styles/highlight.css 中添加删除确认模式样式

**检查点**: ✅ 所有用户故事现在应该独立功能化

---

## 阶段 6: 完善与横切关注点

**目的**: 影响多个用户故事的改进

- [x] T033 在 extension/content.js 的 addHighlight() 函数中调用 initHighlightInteractions() - 确保新创建的高亮也有交互
- [x] T034 为浮窗和编辑器添加 CSS 过渡动画 - 提升视觉体验
- [x] T035 运行 quickstart.md 验收检查清单 - 验证所有功能正常

---

## 依赖关系与执行顺序

### 阶段依赖关系

- **设置（阶段 1）**: ✅ 完成
- **基础（阶段 2）**: ✅ 完成
- **用户故事（阶段 3-5）**: ✅ 全部完成
- **完善（阶段 6）**: 🔄 进行中

### 用户故事依赖关系

- **用户故事 1（P1 - 浮窗）**: ✅ 完成
- **用户故事 2（P1 - 编辑器）**: ✅ 完成
- **用户故事 3（P2 - 删除）**: ✅ 完成

### 每个用户故事内部

- DOM 创建函数在显示/隐藏函数之前
- 显示/隐藏函数在事件处理之前
- 核心实施在集成之前

### 并行机会

- T002 和 T003（样式任务）可并行
- US1（T007-T014）和 US2（T015-T024）可并行开发（不同功能模块）
- 同一故事内的 DOM 创建可与样式开发并行

---

## 并行示例

```bash
# 阶段 1 - 样式任务可并行:
任务: "在 extension/styles/highlight.css 中添加浮窗基础样式"
任务: "在 extension/styles/highlight.css 中添加编辑器基础样式"

# 阶段 3-4 - 用户故事 1 和 2 可并行开发:
# 开发者 A: 浮窗功能 (T007-T014)
# 开发者 B: 编辑器功能 (T015-T024)
```

---

## 实施策略

### 仅 MVP（仅用户故事 1）

1. 完成阶段 1: 设置 ✅
2. 完成阶段 2: 基础 ✅
3. 完成阶段 3: 用户故事 1（浮窗）✅
4. **停止并验证**: 悬停高亮时浮窗正常显示
5. 如准备好则发布

### 推荐: 增量交付

1. 完成设置 + 基础 → 基础就绪 ✅
2. 添加用户故事 1（浮窗）→ 手动测试 → 可发布（MVP）✅
3. 添加用户故事 2（编辑器）→ 手动测试 → 可发布 ✅
4. 添加用户故事 3（删除）→ 手动测试 → 可发布 ✅
5. 完善阶段 → 最终验证 🔄

---

## 注意事项

- [P] 任务 = 不同文件或功能模块，无依赖关系
- [Story] 标签将任务映射到特定用户故事以实现可追溯性
- 所有 DOM 操作需做空值检查（遵循 JavaScript 编码规范）
- 在每个任务或逻辑组后提交代码
- 在任何检查点停止以手动验证功能
- 主要修改文件: extension/content.js, extension/styles/highlight.css
