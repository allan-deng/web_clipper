# 变更：重构 Markdown 生成逻辑 - 引入模版系统

## 为什么

当前 Markdown 文档结构被硬编码在 Go 服务端代码中（`server/services/filewriter.go`），导致：
1. 用户无法自定义最终保存的 Markdown 格式
2. 修改文档结构需要修改后端代码并重新编译
3. 浏览器插件和服务端存在重复的 Markdown 生成逻辑（复制到剪贴板 vs 保存到 Obsidian）

## 变更内容

### 核心变更
1. **将 Markdown 生成逻辑从 Server 移至浏览器插件**
   - 插件负责根据模版生成完整的 Markdown 内容
   - Server 仅负责接收并保存 Markdown 文件和资源

2. **引入可配置的 Markdown 模版系统**
   - 在浏览器设置页面提供模版编辑器
   - 支持占位符替换（如 `{title}`, `{content}`, `{highlights}` 等）
   - 提供默认模版，用户可自定义

3. **简化 API 协议** (**重大变更**)
   - 移除 `content` 对象中的复杂结构（`aiSummary`, `highlights`）
   - `content.markdown` 字段改为包含完整的、已渲染的 Markdown 内容
   - 保留 `metadata` 和 `assets` 结构不变

### 新增功能
- 模版编辑器 UI（设置页面）
- 模版占位符系统
- 模版预览功能
- 恢复默认模版按钮

## 影响

### 受影响规范
- `001-web-clipper-core` - API 协议变更
- 新增 `markdown-template` 功能规范

### 受影响代码
- **Server 端**
  - `server/models/webclip.go` - 简化 Content 结构
  - `server/services/filewriter.go` - 移除 `generateMarkdown` 函数，直接写入接收到的 markdown
- **浏览器插件**
  - `extension/options/options.html` - 新增模版编辑器 UI
  - `extension/options/options.js` - 模版保存/加载逻辑
  - `extension/services/templateService.js` - 新增模版渲染服务
  - `extension/popup/popup.js` - 调用模版服务生成 Markdown
  - `extension/content.js` - 调整数据提取逻辑

### 向后兼容性
- **重大变更**：API 协议不向后兼容
- 需要同时更新浏览器插件和服务端
