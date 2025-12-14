# 研究文档: 复制到剪贴板

**功能分支**: `002-copy-to-clipboard`
**创建时间**: 2025-12-14
**状态**: 完成

## 研究摘要

此功能的技术实现路径明确，主要复用现有模块。研究重点为 Clipboard API 的使用方式和浏览器兼容性。

## 研究任务

### R1: Clipboard API 使用方式

**Decision**: 使用 `navigator.clipboard.writeText()` 异步 API

**Rationale**: 
- 现代 Clipboard API 是 W3C 标准，Chrome 66+ / Edge 79+ 完全支持
- 异步 API 返回 Promise，与现有 async/await 代码风格一致
- 相比废弃的 `document.execCommand('copy')`，更安全且不需要临时 DOM 元素

**Alternatives considered**:
- `document.execCommand('copy')`: 已废弃，需要创建临时文本域，同步阻塞
- `navigator.clipboard.write()` (ClipboardItem): 支持富文本/图片，但对纯文本复制过于复杂

**Implementation**:
```javascript
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### R2: 浏览器扩展中 Clipboard API 权限

**Decision**: 在 popup 上下文中直接使用，无需额外权限声明

**Rationale**:
- Manifest V3 扩展的 popup 页面属于扩展的 origin
- 用户主动点击按钮触发复制，满足"用户手势"(user gesture) 要求
- 无需在 manifest.json 中声明 `clipboardWrite` 权限（该权限仅对 content script 必需）

**Alternatives considered**:
- 添加 `clipboardWrite` 权限: 不必要，增加用户安装时的权限提示
- 通过 content script 复制: 需要额外消息传递，复杂且无必要

### R3: 内容提取模块复用策略

**Decision**: 直接调用现有 `extractor.js` 和 `converter.js`

**Rationale**:
- 001-web-clipper-core 功能已实现完整的内容提取和 Markdown 转换
- 代码已封装为独立模块，易于复用
- 保持代码一致性，减少维护负担

**复用模块清单**:
| 模块 | 路径 | 复用方式 |
|------|------|----------|
| extractor.js | extension/services/extractor.js | 直接 import |
| converter.js | extension/services/converter.js | 直接 import |
| markdown.js | extension/utils/markdown.js | 直接 import (frontmatter 生成) |

### R4: 错误处理策略

**Decision**: 分层错误处理，向用户展示友好提示

**Rationale**:
- 用户无需了解技术细节，只需知道操作是否成功
- 错误信息应可操作（告诉用户下一步该怎么做）

**错误类型映射**:
| 技术错误 | 用户提示 |
|----------|----------|
| Clipboard API 权限被拒 | "无法访问剪贴板，请检查浏览器权限设置" |
| 内容提取失败 | "无法从此页面提取内容" |
| Readability 返回空 | "此页面没有可提取的文章内容" |
| 未知错误 | "复制失败，请重试" |

## 技术决策总结

| 决策点 | 选择 | 置信度 |
|--------|------|--------|
| 剪贴板 API | navigator.clipboard.writeText() | 高 |
| 权限需求 | 无需额外权限 | 高 |
| 模块复用 | 直接 import 现有服务 | 高 |
| 错误处理 | 分层映射为用户友好提示 | 高 |

## 无需研究的领域

- **图片处理**: 规范明确图片以 URL 引用形式保留，无需 Base64 转换
- **后端交互**: 此功能不涉及后端
- **持久化**: 此功能不涉及存储
