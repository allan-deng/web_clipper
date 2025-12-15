# 研究文档: 前端UI与AI功能优化

**功能分支**: `004-ui-and-ai-enhancements`
**创建时间**: 2025-12-15
**状态**: 完成

## 研究摘要

此功能的技术实现路径明确，主要涉及 CSS 样式调整、DOM 操作和 Chrome Storage API。研究重点为 OpenRouter API 集成方式和设置页面 UI 设计。

## 研究任务

### R1: 浮窗半透明背景实现

**Decision**: 使用 CSS `rgba()` 或 `background-color` + `opacity` 的组合

**Rationale**: 
- `rgba()` 可以精确控制背景透明度而不影响子元素
- 与现有 CSS 变量系统兼容
- 浏览器兼容性良好

**Implementation Strategy**:
```css
.owc-selection-menu {
  background: rgba(30, 30, 30, 0.85); /* 85% 不透明度 */
  backdrop-filter: blur(4px); /* 可选：毛玻璃效果 */
}
```

**Alternatives considered**:
- 使用 `opacity` 属性：会影响所有子元素，不适用
- 使用 CSS 变量定义透明度：增加复杂性，收益不大

### R2: 笔记编辑浮窗复用策略

**Decision**: 复用现有 `showNoteEditor()` 函数和编辑器样式

**Rationale**:
- 003 功能已实现完整的编辑器组件
- 保持 UI 一致性
- 减少代码重复

**Implementation Pattern**:
```javascript
// 在标记浮窗的笔记按钮点击事件中
function handleNoteButtonClick(text, targetElement) {
  // 先创建高亮
  addHighlightWithEditor(text, targetElement);
}

// 或者：显示编辑器但不立即创建高亮
function showNoteEditorForNewHighlight(text, targetElement) {
  // 显示编辑器，保存时才创建高亮
}
```

**Key Decision**: 点击笔记按钮后的流程
- 方案 A：先创建高亮，再打开编辑器（与点击已有高亮一致）
- 方案 B：先显示编辑器，保存时才创建高亮（用户可能取消）
- **选择方案 B**：更符合用户预期，取消时不留下空高亮

### R3: OpenRouter API 集成

**Decision**: 使用 OpenRouter 的 OpenAI 兼容端点

**Rationale**:
- OpenRouter 提供 `https://openrouter.ai/api/v1/chat/completions` 端点
- 完全兼容 OpenAI API 格式
- 只需更改 base URL 和添加 HTTP-Referer header

**API Format**:
```javascript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': window.location.origin, // 可选但推荐
    'X-Title': 'Obsidian Web Clipper' // 可选
  },
  body: JSON.stringify({
    model: userSelectedModel, // 如 "openai/gpt-4o", "anthropic/claude-3-opus"
    messages: [{ role: 'user', content: promptWithContent }]
  })
});
```

**Model Name Format**: `provider/model-name`
- 示例: `openai/gpt-4o`, `anthropic/claude-3-opus`, `google/gemini-pro`

### R4: 设置页面 UI 布局

**Decision**: 在现有设置页面添加 AI 配置区块

**Rationale**:
- 保持设置页面的一致性
- 分组展示相关设置项

**UI Structure**:
```
AI 摘要设置
├── AI Provider [下拉选择]
│   ├── OpenAI
│   ├── OpenRouter ← 新增
│   └── ...
├── API Key [密码输入框]
├── Model [文本输入框] ← OpenRouter 时显示
└── Summary Prompt [多行文本框] ← 新增
    └── [恢复默认] 按钮
```

### R5: Chrome Storage 数据结构

**Decision**: 扩展现有设置存储结构

**Data Structure**:
```javascript
{
  aiProvider: 'openrouter', // 'openai' | 'openrouter' | ...
  openrouterApiKey: '...', 
  openrouterModel: 'openai/gpt-4o',
  customSummaryPrompt: '...' | null, // null 表示使用默认
  // 其他现有设置...
}
```

**Default Prompt Location**: 代码中定义常量 `DEFAULT_SUMMARY_PROMPT`

## 技术决策总结

| 决策点 | 选择 | 置信度 |
|--------|------|--------|
| 浮窗透明度 | rgba() + 可选 backdrop-filter | 高 |
| 笔记编辑器 | 复用现有组件，保存时创建高亮 | 高 |
| OpenRouter 集成 | OpenAI 兼容端点 | 高 |
| 设置 UI | 扩展现有页面，添加 AI 配置区块 | 高 |
| 数据存储 | Chrome Storage local | 高 |

## 无需研究的领域

- **后端交互**: 此功能不涉及后端
- **持久化**: 使用标准 Chrome Storage API
- **跨浏览器兼容**: 目标浏览器 (Chrome/Edge 88+) 完全支持所需 API
