# 数据模型: Obsidian Web Clipper & Assistant

**功能分支**: `001-web-clipper-core`
**创建时间**: 2025-12-14
**关联规范**: [spec.md](./spec.md)

## 概述

本文档定义系统中的核心数据实体及其关系。这些模型将用于前后端通信和数据持久化。

## 核心实体

### 1. WebClip (网页剪藏)

代表一次完整的网页剪藏操作，是系统的核心数据结构。

```
WebClip {
    // 元数据
    title: string           // 文章标题
    url: string             // 原始网页 URL
    domain: string          // 来源域名 (如 "medium.com")
    savedAt: datetime       // 保存时间 (ISO 8601 格式)
    
    // 内容
    markdown: string        // 转换后的 Markdown 正文
    aiSummary: AISummary?   // AI 生成的总结 (可选)
    highlights: Highlight[] // 用户高亮和批注列表
    
    // 资源
    assets: Asset[]         // 本地化的图片资源列表
    
    // 生成的标签
    tags: string[]          // AI 自动生成的标签 (3-5 个)
}
```

**约束条件**:
- `title` 不能为空，用于生成文件名
- `url` 必须是有效的 HTTP/HTTPS URL
- `tags` 数组长度为 0-5，AI 不可用时为空数组

---

### 2. Asset (资源文件)

代表一个本地化的资源文件，主要是图片。

```
Asset {
    filename: string        // 生成的文件名 (hash + 扩展名)
    originalUrl: string     // 原始远程 URL
    base64Data: string      // Base64 编码的文件内容
    mimeType: string        // MIME 类型 (如 "image/png")
    size: number            // 文件大小 (字节)
    status: AssetStatus     // 下载状态
}

enum AssetStatus {
    SUCCESS,                // 成功下载
    SKIPPED_TOO_LARGE,      // 跳过 (超过 5MB)
    FAILED_DOWNLOAD,        // 下载失败
    FAILED_CORS             // 跨域限制
}
```

**约束条件**:
- `filename` 格式: `{sha256_hash_8chars}.{ext}`
- `base64Data` 仅在 `status == SUCCESS` 时有值
- `size` 限制: 单个文件 <= 5MB

---

### 3. Highlight (高亮批注)

代表用户在页面上的一次高亮操作。

```
Highlight {
    id: string              // 唯一标识符 (UUID)
    text: string            // 高亮的文本内容
    note: string?           // 用户批注 (可选)
    color: string           // 高亮颜色 (CSS 颜色值)
    position: number        // 在文档中的顺序位置
    createdAt: datetime     // 创建时间
}
```

**约束条件**:
- `text` 不能为空
- `color` 默认值: "#ffeb3b" (黄色)
- `position` 用于按出现顺序排列高亮

---

### 4. AISummary (AI 总结)

代表 AI 生成的文章总结。

```
AISummary {
    keyPoints: string[]     // 核心论点列表 (3-7 条)
    evidence: Evidence[]    // 支撑论据引用
    mermaidDiagram: string  // Mermaid 格式的逻辑图
    generatedAt: datetime   // 生成时间
    model: string           // 使用的 AI 模型标识
    status: SummaryStatus   // 生成状态
}

Evidence {
    point: string           // 关联的论点
    quote: string           // 原文引用
}

enum SummaryStatus {
    SUCCESS,                // 成功生成
    PENDING,                // 待生成 (占位符状态)
    FAILED                  // 生成失败
}
```

**约束条件**:
- `keyPoints` 数组长度 3-7
- `mermaidDiagram` 必须是有效的 Mermaid 语法
- `status == PENDING` 时，其他字段可为空

---

## API 请求/响应模型

### SaveRequest (保存请求)

前端发送给后端的请求体结构。

```
SaveRequest {
    metadata: {
        title: string
        url: string
        domain: string
        savedAt: string     // ISO 8601
        tags: string[]
    }
    content: {
        markdown: string
        aiSummary: {
            keyPoints: string[]
            evidence: Evidence[]
            mermaidDiagram: string
            status: string
        }?
        highlights: Highlight[]
    }
    assets: {
        filename: string
        base64: string      // 不含 data:xxx;base64, 前缀
        mimeType: string
    }[]
}
```

---

### SaveResponse (保存响应)

后端返回给前端的响应结构。

```
// 成功响应
SaveResponse {
    code: 0
    msg: "success"
    data: {
        savedPath: string   // 保存的完整路径
        articleDir: string  // 文章目录名
        assetsCount: number // 保存的图片数量
    }
}

// 错误响应
SaveResponse {
    code: number            // 错误码 (非 0)
    msg: string             // 错误描述
    data: null
}
```

**错误码定义**:

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 认证失败 (Token 无效) |
| 1002 | 请求体解析失败 |
| 2001 | 目录创建失败 |
| 2002 | Markdown 写入失败 |
| 2003 | 图片写入失败 |
| 2004 | 权限不足 |
| 3001 | 内部服务器错误 |

---

## 文件系统模型

### 目录结构

```
{VaultRoot}/
└── Inbox/
    └── WebClips/
        └── {YYYY-MM-DD}/           # 日期目录
            └── {SanitizedTitle}/   # 文章目录 (清洗后的标题)
                ├── {Title}.md      # Markdown 主文件
                └── assets/         # 图片目录
                    ├── a1b2c3d4.png
                    ├── e5f6g7h8.jpg
                    └── ...
```

### 文件名清洗规则

**标题清洗 (SanitizeTitle)**:
1. 移除非法字符: `< > : " / \ | ? *`
2. 替换空格为下划线或保留
3. 限制长度: 最大 100 字符
4. 处理重复: 添加 `_v2`, `_v3` 后缀

**示例**:
- 输入: `"分布式系统: 原理与实践 (第2版)"`
- 输出: `"分布式系统 原理与实践 (第2版)"`

---

## Markdown 文件结构

```markdown
---
title: "{title}"
url: "{url}"
date: "{YYYY-MM-DD}"
tags:
  - {tag1}
  - {tag2}
  - {tag3}
---

## AI 摘要

### 核心观点

- {keyPoint1}
- {keyPoint2}
- {keyPoint3}

### 逻辑关系图

```mermaid
{mermaidDiagram}
```

---

## 我的笔记

> **高亮**: {highlightText1}
> 
> 💬 批注: {note1}

> **高亮**: {highlightText2}

---

## 正文

{markdownContent}
```

---

## 实体关系图

```
┌─────────────┐
│   WebClip   │
├─────────────┤
│ title       │
│ url         │
│ domain      │
│ savedAt     │
│ markdown    │
│ tags[]      │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐      ┌─────────────┐
│   Asset     │      │  Highlight  │
├─────────────┤      ├─────────────┤
│ filename    │      │ id          │
│ originalUrl │      │ text        │
│ base64Data  │      │ note        │
│ mimeType    │      │ color       │
│ size        │      │ position    │
│ status      │      │ createdAt   │
└─────────────┘      └─────────────┘
       │
       │ 1:1 (可选)
       ▼
┌─────────────┐
│  AISummary  │
├─────────────┤
│ keyPoints[] │
│ evidence[]  │
│ mermaidDiag │
│ generatedAt │
│ model       │
│ status      │
└─────────────┘
```
