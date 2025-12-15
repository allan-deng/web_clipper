# 任务: 前端UI与AI功能优化

**输入**: 来自 `/specs/004-ui-and-ai-enhancements/` 的设计文档
**前置条件**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**测试**: 手动测试（浏览器扩展环境）- 无自动化测试要求

**组织结构**: 任务按用户故事分组，以便每个故事能够独立实施和测试

## 格式: `[ID] [P?] [Story] 描述`
- **[P]**: 可以并行运行（不同文件，无依赖关系）
- **[Story]**: 此任务属于哪个用户故事（US1、US2、US3、US4）
- 在描述中包含确切的文件路径

## 路径约定
- **扩展源码**: `extension/`
- **样式文件**: `extension/styles/`
- **设置页面**: `extension/options/`

---

## 阶段 1: 设置（共享基础设施）

**目的**: 准备共享的常量和基础设施

- [X] T001 在 extension/options/options.js 中定义 DEFAULT_SUMMARY_PROMPT 常量
- [X] T002 [P] 在 extension/options/options.js 中实现 loadSettings() 函数 - 从 Chrome Storage 加载设置
- [X] T003 [P] 在 extension/options/options.js 中实现 saveSettings() 函数 - 保存设置到 Chrome Storage

---

## 阶段 2: 基础（阻塞前置条件）

**目的**: 无特定基础设施阻塞 - 此功能主要是增量修改现有代码

**⚠️ 说明**: US1 和 US2 修改前端 UI，US3 和 US4 修改设置页面，两组可以并行开发

**检查点**: 基础就绪 - 现在可以开始并行实施用户故事

---

## 阶段 3: 用户故事 1 - 选择浮窗视觉优化（优先级: P1）🎯 MVP

**目标**: 标记浮窗具有半透明背景效果

**独立测试**: 选择任意文字，观察浮窗背景是否呈现半透明效果

### 用户故事 1 的实施

- [X] T004 [US1] 在 extension/styles/highlight.css 中修改 .owc-selection-menu 样式 - 将 background 改为 rgba(30, 30, 30, 0.85)
- [X] T005 [US1] 在 extension/styles/highlight.css 中为 .owc-selection-menu 添加 backdrop-filter: blur(4px) 效果
- [X] T006 [US1] 在 extension/content.js 中移除 initHighlightMode() 内联样式中的 .owc-selection-menu 背景色定义（避免覆盖 CSS 文件样式）

**检查点**: 选择文字后浮窗应显示半透明背景效果

---

## 阶段 4: 用户故事 2 - 笔记编辑浮窗优化（优先级: P1）

**目标**: 点击笔记按钮弹出自定义编辑浮窗，替代原生 prompt

**独立测试**: 选择文字、点击笔记按钮，验证是否弹出自定义编辑浮窗

### 用户故事 2 的实施

- [X] T007 [US2] 在 extension/content.js 中添加 showNoteEditorForNewHighlight(text, position) 函数 - 显示新建笔记的编辑器
- [X] T008 [US2] 在 extension/content.js 中修改 createEditorElement() 函数 - 支持新建模式（无删除按钮）
- [X] T009 [US2] 在 extension/content.js 中实现 saveNewHighlightWithNote(text, note) 函数 - 创建带笔记的高亮
- [X] T010 [US2] 在 extension/content.js 中修改标记浮窗的笔记按钮点击事件 - 调用 showNoteEditorForNewHighlight 替代 prompt
- [X] T011 [US2] 在 extension/content.js 中为新建编辑器绑定保存事件 - 调用 saveNewHighlightWithNote
- [X] T012 [US2] 在 extension/content.js 中为新建编辑器绑定取消事件 - 关闭编辑器不创建高亮
- [X] T013 [US2] 在 extension/content.js 中为新建编辑器绑定快捷键 - Enter 保存、Escape 取消

**检查点**: 点击笔记按钮应弹出自定义编辑浮窗，保存后创建带笔记的高亮

---

## 阶段 5: 用户故事 3 - OpenRouter AI Provider 支持（优先级: P2）

**目标**: 设置页面支持 OpenRouter 配置

**独立测试**: 在设置中选择 OpenRouter、输入模型名称、保存设置

### 用户故事 3 的实施

- [X] T014 [P] [US3] 在 extension/options/options.html 中添加 AI Provider 下拉菜单 - 包含 OpenAI 和 OpenRouter 选项
- [X] T015 [P] [US3] 在 extension/options/options.html 中添加 OpenRouter API Key 输入框
- [X] T016 [P] [US3] 在 extension/options/options.html 中添加 OpenRouter Model 输入框（选择 OpenRouter 时显示）
- [X] T017 [US3] 在 extension/options/options.js 中实现 renderAIProviderUI() 函数 - 根据选择的 provider 显示/隐藏相关字段
- [X] T018 [US3] 在 extension/options/options.js 中为 AI Provider 下拉菜单添加 change 事件监听
- [X] T019 [US3] 在 extension/options/options.js 中实现 validateOpenRouterModel(model) 函数 - 验证模型名称格式 (provider/model-name)
- [X] T020 [US3] 在 extension/options/options.js 中修改 saveSettings() 函数 - 保存 OpenRouter 相关配置
- [X] T021 [US3] 在 extension/options/options.js 中修改 loadSettings() 函数 - 加载 OpenRouter 相关配置
- [X] T022 [US3] 在 extension/popup/popup.js 中实现 callOpenRouterAPI(content, model, apiKey) 函数 - 调用 OpenRouter API
- [X] T023 [US3] 在 extension/popup/popup.js 中修改 AI 摘要逻辑 - 根据 provider 设置调用对应 API

**检查点**: 可以配置 OpenRouter 并使用其生成摘要

---

## 阶段 6: 用户故事 4 - 自定义 AI Summary Prompt（优先级: P2）

**目标**: 设置页面展示和编辑 AI summary prompt

**独立测试**: 在设置中修改 prompt、保存设置、验证摘要使用自定义 prompt

### 用户故事 4 的实施

- [X] T024 [P] [US4] 在 extension/options/options.html 中添加 AI Summary Prompt 文本框区域
- [X] T025 [P] [US4] 在 extension/options/options.html 中添加"恢复默认"按钮
- [X] T026 [P] [US4] 在 extension/options/options.css 中添加 prompt 文本框样式（多行、适当高度）- 已在 options.html 内联样式中实现
- [X] T027 [US4] 在 extension/options/options.js 中实现显示当前 prompt 逻辑 - 有自定义则显示自定义，否则显示默认
- [X] T028 [US4] 在 extension/options/options.js 中实现 resetPromptToDefault() 函数 - 重置为默认 prompt
- [X] T029 [US4] 在 extension/options/options.js 中为"恢复默认"按钮添加点击事件
- [X] T030 [US4] 在 extension/options/options.js 中修改 saveSettings() 函数 - 保存自定义 prompt（空时使用默认）
- [X] T031 [US4] 在 extension/options/options.js 中添加 prompt 字符限制验证（最大 2000 字符）
- [X] T032 [US4] 在 extension/popup/popup.js 中修改 AI 摘要逻辑 - 使用用户自定义 prompt 或默认 prompt

**检查点**: 可以自定义 prompt 并验证摘要使用该 prompt

---

## 阶段 7: 完善与横切关注点

**目的**: 影响多个用户故事的改进

- [X] T033 在 extension/options/options.html 中添加保存成功/失败的提示 UI - 已有 status 元素
- [X] T034 在 extension/options/options.js 中添加设置保存后的用户反馈 - 已有 showStatus 函数
- [ ] T035 运行 quickstart.md 验收检查清单 - 验证所有功能正常

---

## 依赖关系与执行顺序

### 阶段依赖关系

- **设置（阶段 1）**: 无依赖关系 - 可立即开始
- **基础（阶段 2）**: 无实际阻塞任务
- **用户故事（阶段 3-6）**: 
  - US1 和 US2 修改前端 UI，可与 US3/US4 并行开发
  - US3 和 US4 修改设置页面，有共享代码依赖
- **完善（阶段 7）**: 依赖于所有用户故事完成

### 用户故事依赖关系

- **用户故事 1（P1 - 浮窗透明度）**: 独立，仅修改 CSS
- **用户故事 2（P1 - 笔记编辑浮窗）**: 独立，复用现有编辑器组件
- **用户故事 3（P2 - OpenRouter）**: 需要阶段 1 的 loadSettings/saveSettings
- **用户故事 4（P2 - 自定义 Prompt）**: 需要阶段 1 的常量定义和 loadSettings/saveSettings

### 并行机会

- T002 和 T003（设置函数）可并行
- T004、T005、T006（US1 样式任务）可并行
- T014、T015、T016（US3 HTML 任务）可并行
- T024、T025、T026（US4 HTML/CSS 任务）可并行
- US1/US2（前端 UI）与 US3/US4（设置页面）可并行开发

---

## 并行示例

```bash
# 阶段 1 - 设置函数可并行:
任务: "在 extension/options/options.js 中实现 loadSettings() 函数"
任务: "在 extension/options/options.js 中实现 saveSettings() 函数"

# US1 和 US3/US4 可并行开发:
# 开发者 A: US1 + US2 (前端 UI)
# 开发者 B: US3 + US4 (设置页面)
```

---

## 实施策略

### 仅 MVP（仅用户故事 1）

1. 完成阶段 1: 设置
2. 完成阶段 3: 用户故事 1（浮窗透明度）
3. **停止并验证**: 浮窗应显示半透明背景
4. 如准备好则发布

### 推荐: 增量交付

1. 完成设置 → 基础就绪
2. 添加用户故事 1（浮窗透明度）→ 手动测试 → 可发布（MVP）
3. 添加用户故事 2（笔记编辑浮窗）→ 手动测试 → 可发布
4. 添加用户故事 3（OpenRouter）→ 手动测试 → 可发布
5. 添加用户故事 4（自定义 Prompt）→ 手动测试 → 可发布
6. 完善阶段 → 最终验证

---

## 注意事项

- [P] 任务 = 不同文件或功能模块，无依赖关系
- [Story] 标签将任务映射到特定用户故事以实现可追溯性
- 所有 DOM 操作需做空值检查（遵循 JavaScript 编码规范）
- 在每个任务或逻辑组后提交代码
- 在任何检查点停止以手动验证功能
- 主要修改文件: extension/content.js, extension/styles/highlight.css, extension/options/options.html, extension/options/options.js, extension/popup/popup.js
