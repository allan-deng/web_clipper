# 数据模型: 复制到剪贴板

**功能分支**: `002-copy-to-clipboard`
**创建时间**: 2025-12-14
**状态**: 完成

## 概述

此功能为纯前端操作，不涉及持久化存储。数据模型描述运行时的内存数据结构。

## 实体定义

### ClippedContent (剪藏内容)

从网页提取的结构化内容，用于生成最终的 Markdown 文本。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 页面标题 |
| content | string | 是 | 正文内容 (HTML 格式，由 Readability 提取) |
| url | string | 是 | 原始页面 URL |
| clippedAt | Date | 是 | 剪藏时间戳 |
| siteName | string | 否 | 网站名称 (如 og:site_name) |
| author | string | 否 | 作者信息 (如可提取) |
| excerpt | string | 否 | 文章摘要 |

**来源**: 复用 001-web-clipper-core 中 `extractor.js` 的输出结构

### MarkdownOutput (Markdown 输出)

转换后的 Markdown 内容，包含 YAML frontmatter。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| frontmatter | string | 是 | YAML 元信息区块 |
| body | string | 是 | Markdown 正文 |
| fullText | string | 是 | 完整 Markdown 文本 (frontmatter + body) |

**格式示例**:
```markdown
---
title: "文章标题"
source: "https://example.com/article"
clipped: "2025-12-14T10:30:00Z"
---

# 文章标题

正文内容...
```

### CopyOperation (复制操作)

表示一次复制操作的状态和结果。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | enum | 是 | 操作状态: 'idle' \| 'processing' \| 'success' \| 'error' |
| errorType | string | 否 | 错误类型 (仅 status='error' 时) |
| errorMessage | string | 否 | 用户友好的错误提示 |
| startTime | number | 否 | 操作开始时间 (用于性能追踪) |
| endTime | number | 否 | 操作结束时间 |

**状态转换图**:
```
idle → processing → success
                 ↘ error
```

## 错误类型枚举

| 错误类型 | 说明 | 用户提示 |
|----------|------|----------|
| CLIPBOARD_DENIED | 剪贴板权限被拒绝 | "无法访问剪贴板，请检查浏览器权限设置" |
| EXTRACTION_FAILED | 内容提取失败 | "无法从此页面提取内容" |
| NO_CONTENT | 页面无可提取内容 | "此页面没有可提取的文章内容" |
| CONVERSION_FAILED | Markdown 转换失败 | "内容转换失败，请重试" |
| UNKNOWN_ERROR | 未知错误 | "复制失败，请重试" |

## 与现有模型的关系

```
┌─────────────────────────────────────────────────────────┐
│                   001-web-clipper-core                   │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ extractor.js │ →  │ converter.js │ →  │ apiClient │ │
│  └──────────────┘    └──────────────┘    └───────────┘ │
│         ↓                   ↓                   ↓       │
│   ClippedContent      MarkdownOutput      → Backend    │
└─────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│                  002-copy-to-clipboard                   │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ extractor.js │ →  │ converter.js │ →  │ clipboard │ │
│  │   (复用)     │    │   (复用)     │    │  Service  │ │
│  └──────────────┘    └──────────────┘    └───────────┘ │
│         ↓                   ↓                   ↓       │
│   ClippedContent      MarkdownOutput      → Clipboard  │
└─────────────────────────────────────────────────────────┘
```

**关键差异**: 
- 001 将 MarkdownOutput 发送到后端 API
- 002 将 MarkdownOutput.fullText 写入系统剪贴板
