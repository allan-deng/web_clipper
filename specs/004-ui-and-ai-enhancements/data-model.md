# 数据模型: 前端UI与AI功能优化

**功能分支**: `004-ui-and-ai-enhancements`
**创建时间**: 2025-12-15
**状态**: 完成

## 概述

此功能主要涉及用户设置的存储和扩展。UI 优化部分不涉及新的数据模型，AI 功能优化需要扩展设置存储结构。

## 现有实体 (复用)

### Highlight (高亮)

用户在网页上标记的文本区域。（来自 001-web-clipper-core，003-highlight-interaction）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 高亮唯一标识符 (自增) |
| text | string | 是 | 高亮的文本内容 |
| note | string | 否 | 用户添加的笔记/批注 |
| color | string | 是 | 高亮颜色 (默认 #ffeb3b) |
| position | number | 是 | 高亮在页面中的顺序位置 |

## 扩展实体

### UserSettings (用户设置)

存储在 Chrome Storage local 中的用户配置。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| aiProvider | string | 是 | AI 服务商: 'openai' \| 'openrouter' |
| openaiApiKey | string | 否 | OpenAI API key |
| openrouterApiKey | string | 否 | OpenRouter API key |
| openrouterModel | string | 否 | OpenRouter 模型名称 (如 "openai/gpt-4o") |
| customSummaryPrompt | string | 否 | 用户自定义的 AI 摘要 prompt，null 时使用默认 |

**存储位置**: `chrome.storage.local`

**默认值**:
```javascript
{
  aiProvider: 'openai',
  openaiApiKey: '',
  openrouterApiKey: '',
  openrouterModel: 'openai/gpt-4o',
  customSummaryPrompt: null
}
```

## 新增常量

### DEFAULT_SUMMARY_PROMPT

系统默认的 AI 摘要 prompt，定义在代码中。

```javascript
const DEFAULT_SUMMARY_PROMPT = `请为以下网页内容生成一个简洁的摘要：

要求：
1. 摘要长度在 100-200 字之间
2. 突出文章的核心观点
3. 使用与原文相同的语言

内容：
{content}`;
```

## 新增 UI 状态

### NoteEditorState (笔记编辑器状态) - 扩展

在选择文字后点击笔记按钮时的编辑器状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| visible | boolean | 编辑器是否可见 |
| mode | 'new' \| 'edit' | 新建模式或编辑模式 |
| pendingText | string | 待高亮的文本（新建模式） |
| highlightId | number | 当前编辑的高亮 ID（编辑模式） |
| noteContent | string | 编辑器中的笔记内容 |
| position | {left, top} | 编辑器位置坐标 |

## 操作流程

### 笔记按钮点击流程

```
User clicks note button in selection menu
       │
       ▼
┌──────────────────┐
│ 隐藏选择菜单      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 显示笔记编辑器    │
│ mode = 'new'     │
│ pendingText = 选中文本 │
└────────┬─────────┘
         │
    ┌────┴────────┬────────────┐
    │             │            │
    ▼             ▼            ▼
  保存          取消         Escape
    │             │            │
    ▼             ▼            ▼
创建高亮+笔记  关闭编辑器    关闭编辑器
    │
    ▼
关闭编辑器
```

### OpenRouter 配置流程

```
User opens settings page
       │
       ▼
┌──────────────────┐
│ 加载现有设置      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 显示 AI Provider │
│ 下拉菜单         │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 OpenAI   OpenRouter
    │         │
    ▼         ▼
显示 API    显示 API Key
Key 输入    + Model 输入
    │         │
    └────┬────┘
         │
         ▼
┌──────────────────┐
│ 用户点击保存      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 保存到 Storage   │
└──────────────────┘
```

## 与现有代码的集成点

```
extension/content.js
├── highlights = []              # 高亮数据数组 [复用]
├── addHighlight()               # 添加高亮 [修改: 支持带编辑器的新建模式]
├── showNoteEditor()             # 显示笔记编辑器 [修改: 支持新建模式]
│
├── [修改] selection menu click handler  # 笔记按钮点击处理
└── [修改] CSS 样式引用                   # 半透明背景

extension/options/options.js
├── [新增] loadSettings()        # 加载设置
├── [新增] saveSettings()        # 保存设置
├── [新增] renderAIProviderUI()  # 渲染 AI provider 相关 UI
├── [新增] resetPromptToDefault() # 重置 prompt 为默认值
└── [新增] DEFAULT_SUMMARY_PROMPT # 默认 prompt 常量

extension/popup/popup.js (如果有 AI 摘要功能)
├── [修改] generateSummary()     # 根据 provider 调用不同 API
└── [新增] callOpenRouterAPI()   # OpenRouter API 调用
```
