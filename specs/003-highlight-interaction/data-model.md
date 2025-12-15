# 数据模型: 高亮交互优化

**功能分支**: `003-highlight-interaction`
**创建时间**: 2025-12-15
**状态**: 完成

## 概述

此功能增强现有高亮系统的交互能力。数据模型沿用现有的 Highlight 实体，无需新增实体。

## 现有实体 (来自 001-web-clipper-core)

### Highlight (高亮)

用户在网页上标记的文本区域。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 高亮唯一标识符 (自增) |
| text | string | 是 | 高亮的文本内容 |
| note | string | 否 | 用户添加的笔记/批注 |
| color | string | 是 | 高亮颜色 (默认 #ffeb3b) |
| position | number | 是 | 高亮在页面中的顺序位置 |

**DOM 关联**: 每个高亮对应一个带有 `data-highlight-id` 属性的 span 元素

```html
<span class="owc-highlight" data-highlight-id="1">高亮的文本</span>
<span class="owc-highlight has-note" data-highlight-id="2">带笔记的高亮</span>
```

## 新增 UI 状态

### TooltipState (浮窗状态)

浮窗的显示状态，用于控制悬停交互。

| 字段 | 类型 | 说明 |
|------|------|------|
| visible | boolean | 浮窗是否可见 |
| highlightId | number | 当前显示的高亮 ID |
| position | {left, top} | 浮窗位置坐标 |

### EditorState (编辑器状态)

编辑器的显示状态，用于控制点击编辑交互。

| 字段 | 类型 | 说明 |
|------|------|------|
| visible | boolean | 编辑器是否可见 |
| highlightId | number | 当前编辑的高亮 ID |
| noteContent | string | 编辑器中的笔记内容 |
| position | {left, top} | 编辑器位置坐标 |
| mode | 'edit' \| 'confirm-delete' | 编辑模式或删除确认模式 |

## 操作流程

### 悬停显示浮窗

```
User hovers highlight
       │
       ▼
┌──────────────────┐
│ 检查 note 是否存在 │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 有笔记     无笔记
    │         │
    ▼         ▼
显示浮窗   不显示/显示简单提示
```

### 点击编辑笔记

```
User clicks highlight
       │
       ▼
┌──────────────────┐
│ 隐藏浮窗（如有）   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 打开编辑器        │
│ 预填充现有笔记    │
└────────┬─────────┘
         │
    ┌────┴────────┬────────────┐
    │             │            │
    ▼             ▼            ▼
  保存          取消         删除
    │             │            │
    ▼             ▼            ▼
更新 note     关闭编辑器    显示确认
    │                          │
    ▼                     ┌────┴────┐
关闭编辑器                ▼         ▼
                       确认       取消
                         │         │
                         ▼         ▼
                   移除高亮   返回编辑器
```

## 与现有代码的集成点

```
extension/content.js
├── highlights = []              # 高亮数据数组 [复用]
├── highlightIdCounter           # ID 计数器 [复用]
├── addHighlight()               # 添加高亮 [复用]
├── collectHighlights()          # 收集高亮 [复用]
│
├── [新增] showNoteTooltip()     # 显示笔记浮窗
├── [新增] hideNoteTooltip()     # 隐藏笔记浮窗
├── [新增] showNoteEditor()      # 显示笔记编辑器
├── [新增] hideNoteEditor()      # 隐藏笔记编辑器
├── [新增] updateHighlightNote() # 更新高亮笔记
├── [新增] removeHighlight()     # 删除高亮
└── [新增] initHighlightInteractions() # 初始化交互事件
```
