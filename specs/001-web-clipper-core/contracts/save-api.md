# API 合约: POST /api/v1/save

**功能分支**: `001-web-clipper-core`
**创建时间**: 2025-12-14
**版本**: 2.0.0

## 概述

此 API 端点是系统唯一的写操作入口，用于将网页剪藏数据（Markdown 内容 + 图片资源）原子性地写入本地 Obsidian Vault。

## 端点定义

```
POST /api/v1/save
Content-Type: application/json
Authorization: Bearer {token}
```

## 认证

**方式**: Bearer Token

请求头必须包含:
```
Authorization: Bearer {your-auth-token}
```

**Token 来源**: 在后端配置文件和浏览器扩展设置中配置相同的静态 Token。

**认证失败响应**:
```json
{
  "code": 1001,
  "msg": "invalid auth token",
  "data": null
}
```

## 请求

### 请求头

| 头字段 | 必需 | 值 |
|--------|------|-----|
| Content-Type | 是 | application/json |
| Authorization | 是 | Bearer {token} |

### 请求体

```json
{
  "metadata": {
    "title": "分布式系统原理与实践",
    "url": "https://example.com/article/distributed-systems",
    "domain": "example.com",
    "savedAt": "2025-12-14T10:30:00Z",
    "tags": ["分布式系统", "技术", "架构"]
  },
  "content": {
    "markdown": "---\ntitle: \"分布式系统原理与实践\"\nurl: \"https://example.com/article/distributed-systems\"\ndate: 2025-12-14\ntags:\n  - 分布式系统\n  - 技术\n  - 架构\n---\n\n## 摘要\n\n本文探讨了分布式系统的核心挑战...\n\n---\n\n## 我的笔记\n\n> **高亮**: 分布式系统的核心挑战是一致性与可用性的权衡\n> \n> 💬 批注: 这是本文的核心论点\n\n---\n\n## 正文\n\n# 分布式系统原理\n\n正文内容...\n\n![图片](./assets/a1b2c3d4.png)"
  },
  "assets": [
    {
      "filename": "a1b2c3d4.png",
      "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "mimeType": "image/png"
    },
    {
      "filename": "e5f6g7h8.jpg",
      "base64": "/9j/4AAQSkZJRgABAQEASABIAAD...",
      "mimeType": "image/jpeg"
    }
  ]
}
```

### 字段说明

#### metadata (必需)

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| title | string | 是 | 文章标题，用于生成文件名 |
| url | string | 是 | 原始网页 URL |
| domain | string | 是 | 来源域名 |
| savedAt | string | 是 | 保存时间 (ISO 8601 格式) |
| tags | string[] | 否 | 标签数组，无标签时可省略或为空数组 |

#### content (必需)

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| markdown | string | 是 | **完整的、已渲染的 Markdown 文档**，包含 frontmatter、AI 摘要、高亮笔记和正文内容。由浏览器扩展使用模版生成。 |

> **注意 (v2.0 变更)**：`content` 对象不再包含 `aiSummary` 和 `highlights` 字段。浏览器扩展现在负责使用模版系统生成完整的 Markdown 内容。

#### assets (必需)

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| filename | string | 是 | 文件名 (hash + 扩展名) |
| base64 | string | 是 | Base64 编码内容 (不含 data URI 前缀) |
| mimeType | string | 是 | MIME 类型 |

## 响应

### 成功响应 (200 OK)

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "savedPath": "/Users/user/Obsidian/Inbox/WebClips/2025-12-14/分布式系统原理与实践/分布式系统原理与实践.md",
    "articleDir": "分布式系统原理与实践",
    "assetsCount": 2
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| savedPath | string | Markdown 文件的完整路径 |
| articleDir | string | 文章目录名 (清洗后的标题) |
| assetsCount | number | 成功保存的图片数量 |

### 错误响应

#### 认证失败 (401 Unauthorized)

```json
{
  "code": 1001,
  "msg": "invalid auth token",
  "data": null
}
```

#### 请求体解析失败 (400 Bad Request)

```json
{
  "code": 1002,
  "msg": "invalid JSON format: unexpected end of JSON input",
  "data": null
}
```

#### 目录创建失败 (500 Internal Server Error)

```json
{
  "code": 2001,
  "msg": "failed to create directory: /path/to/vault/Inbox/WebClips/2025-12-14/Article: permission denied",
  "data": null
}
```

#### 文件写入失败 (500 Internal Server Error)

```json
{
  "code": 2002,
  "msg": "failed to write markdown file: disk full",
  "data": null
}
```

#### 图片解码/写入失败 (500 Internal Server Error)

```json
{
  "code": 2003,
  "msg": "failed to process asset 'a1b2c3d4.png': invalid base64 encoding",
  "data": null
}
```

#### 路径安全校验失败 (400 Bad Request)

```json
{
  "code": 3001,
  "msg": "invalid filename: path traversal detected in '../../../etc/passwd'",
  "data": null
}
```

## 错误码汇总

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| 0 | 200 | 成功 |
| 1001 | 401 | 认证失败 |
| 1002 | 400 | 请求体解析失败 |
| 2001 | 500 | 目录创建失败 |
| 2002 | 500 | Markdown 写入失败 |
| 2003 | 500 | 图片处理失败 |
| 2004 | 500 | 权限不足 |
| 3001 | 400 | 安全校验失败 |
| 9999 | 500 | 未知错误 |

## 行为规范

### 原子性写入

1. 创建临时目录存放所有文件
2. 写入所有图片文件
3. 直接写入浏览器扩展提供的 Markdown 文件（不进行任何生成或转换）
4. 全部成功后，将临时目录重命名为最终目录
5. 任何步骤失败，清理已写入的文件

### 幂等性处理

- 如果目标目录已存在同名文章，添加版本后缀
- 版本命名规则: `{Title}_v2`, `{Title}_v3`, ...
- 最多尝试 100 个版本

### 文件名清洗

服务端必须对所有输入的文件名进行清洗:

1. 检测并拒绝路径穿越攻击 (`..`, `/`, `\`)
2. 移除操作系统非法字符
3. 限制文件名长度

### 请求大小限制

- 最大请求体: 100MB
- 单个图片 base64 上限: 约 6.7MB (对应 5MB 二进制)

## 使用示例

### cURL

```bash
curl -X POST http://localhost:18080/api/v1/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token" \
  -d '{
    "metadata": {
      "title": "测试文章",
      "url": "https://example.com/test",
      "domain": "example.com",
      "savedAt": "2025-12-14T10:00:00Z",
      "tags": ["测试"]
    },
    "content": {
      "markdown": "---\ntitle: \"测试文章\"\nurl: \"https://example.com/test\"\ndate: 2025-12-14\ntags:\n  - 测试\n---\n\n## 正文\n\n# 测试\n\n这是测试内容"
    },
    "assets": []
  }'
```

### JavaScript (浏览器扩展)

```javascript
async function saveWebClip(webClip) {
  const config = await chrome.storage.sync.get(['serverUrl', 'authToken']);
  
  const response = await fetch(`${config.serverUrl}/api/v1/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.authToken}`
    },
    body: JSON.stringify(webClip)
  });
  
  const result = await response.json();
  
  if (result.code !== 0) {
    throw new Error(result.msg);
  }
  
  return result.data;
}
```

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 2.0.0 | 2025-01-03 | **重大变更**: 简化 content 结构，移除 aiSummary 和 highlights 字段。Markdown 生成逻辑移至浏览器扩展，Server 直接写入接收到的完整 Markdown。 |
| 1.0.0 | 2025-12-14 | 初始版本 |
