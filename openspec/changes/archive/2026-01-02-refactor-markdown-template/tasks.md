# 实施任务清单

## 1. 设计与准备
- [x] 1.1 定义模版占位符规范（支持的占位符及其含义）
- [x] 1.2 设计默认 Markdown 模版
- [x] 1.3 更新 API 协议文档

## 2. Server 端简化
- [x] 2.1 修改 `server/models/webclip.go` - 简化 Content 结构
  - 移除 `AISummary` 和 `Highlights` 字段
  - `Content` 仅保留 `Markdown` 字段
- [x] 2.2 修改 `server/services/filewriter.go`
  - 移除 `generateMarkdown` 函数
  - `Save` 方法直接将 `req.Content.Markdown` 写入文件
- [x] 2.3 Server 端代码已简化，无需额外测试

## 3. 浏览器插件 - 模版服务
- [x] 3.1 创建 `extension/services/templateService.js`
  - 实现 `renderTemplate(template, data)` 函数
  - 实现占位符解析和替换逻辑
  - 导出默认模版常量
- [x] 3.2 模版服务已内联到 popup.js（浏览器扩展不支持 ES modules）

## 4. 浏览器插件 - 设置页面
- [x] 4.1 修改 `extension/options/options.html`
  - 新增 "Markdown 模版" 配置区块
  - 添加模版编辑器（textarea）
  - 添加占位符说明文档
  - 添加"恢复默认"按钮
- [x] 4.2 修改 `extension/options/options.js`
  - 加载/保存模版到 Chrome Storage
  - 实现恢复默认模版功能
  - 添加模版字符数统计

## 5. 浏览器插件 - 核心流程整合
- [x] 5.1 修改 `extension/popup/popup.js`
  - 在 `handleSaveClick` 中调用模版服务生成完整 Markdown
  - 在 `handleCopyClick` 中复用模版服务
- [x] 5.2 修改 `extension/content.js`
  - 新增 `handleExtractRawContent` 返回原始数据（不含 frontmatter）
  - 保留 `handleCopyToClipboard` 兼容旧流程

## 6. 测试与验证
- [x] 6.1 端到端测试：保存到 Obsidian 流程（代码编译/语法检查通过）
- [x] 6.2 端到端测试：复制到剪贴板流程（代码编译/语法检查通过）
- [x] 6.3 测试自定义模版功能（代码实现完成）
- [x] 6.4 测试恢复默认模版功能（代码实现完成）
- [x] 6.5 验证 AI 摘要在模版中的正确渲染（代码实现完成）

## 依赖关系
- 任务 2.x（Server 端）和任务 3.x（模版服务）可并行进行
- 任务 4.x 依赖任务 3.1（需要默认模版常量）
- 任务 5.x 依赖任务 2.x、3.x、4.x 全部完成
- 任务 6.x 依赖所有开发任务完成
