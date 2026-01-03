# Web Clipper

一款强大的浏览器扩展 + 本地服务工具，让你**零摩擦**地将网页内容以 markdown 的形式一键保存到本地知识库。

![Chrome](https://img.shields.io/badge/Chrome-Supported-green?logo=googlechrome)
![Edge](https://img.shields.io/badge/Edge-Supported-green?logo=microsoftedge)
![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ 功能特性

- **🚀 一键保存** - 网页正文自动提取，转换为干净的 Markdown 格式
- **🖼️ 图片本地化** - 自动下载图片到本地，确保离线可用
- **📋 复制到剪贴板** - 无需后端服务，直接复制 Markdown 到剪贴板
- **🖍️ 高亮与批注** - 在网页上选中文字高亮，添加个人笔记
- **🤖 AI 智能总结** - 支持 OpenAI / Anthropic / OpenRouter，自动生成摘要和标签

## 📦 安装

### 1. 启动后端服务

```bash
cd server

# 下载依赖
go mod download

# 创建配置文件
cp config.example.yaml config.yaml

# 编辑配置 (设置你的 本地知识库 路径)
vim config.yaml

# 启动服务
go run main.go
```

**配置文件示例 (`config.yaml`)**:

```yaml
server:
  port: 18080
  maxBodySize: "100MB"

auth:
  token: "your-secret-token"  # 设置你的认证 Token

vault:
  path: "/path/to/your/Vault"  # 你的知识库路径
  subdir: "Inbox/WebClips"             # 保存子目录
```

### 2. 安装浏览器扩展

1. 打开 `chrome://extensions/` (Chrome) 或 `edge://extensions/` (Edge)
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目中的 `extension/` 目录

### 3. 配置扩展

1. 点击扩展图标 → **Settings**
2. 设置服务器地址: `http://localhost:18080`
3. 输入 Auth Token (与后端配置一致)
4. (可选) 配置 AI 服务的 API Key

## 🎯 使用方法

| 操作 | 步骤 |
|------|------|
| **保存到本地** | 打开网页 → 点击扩展图标 → **Save to local** |
| **复制到剪贴板** | 打开网页 → 点击扩展图标 → **Copy to clipboard** |
| **添加高亮** | 选中文字 → 点击悬浮菜单 🖍️ |
| **添加批注** | 选中文字 → 点击悬浮菜单 📝 → 输入批注 |

## 📄 生成的 Markdown 格式

```markdown
---
title: "文章标题"
url: "https://example.com/article"
date: 2025-12-14
tags:
  - AI生成标签
---

## 摘要
[AI 生成的核心论点和论据]

---

## 我的笔记
> **高亮**: 被高亮的文本
> 
> 💬 批注: 我的批注内容

---

## 正文
[文章正文 Markdown 内容]
```

## 🏗️ 项目架构

```
┌─────────────────────────────────────────────────────────┐
│                  浏览器扩展 (extension/)                 │
│  • Readability.js - 网页正文提取                        │
│  • Turndown.js - HTML → Markdown                       │
│  • Mark.js - 文本高亮                                   │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTP POST /api/v1/save
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Go 后端服务 (server/)                   │
│  • Gin Web 框架                                         │
│  • Token 鉴权                                           │
│  • 文件原子性写入                                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   本地知识库                            │
│  Inbox/WebClips/2025-12-14/文章标题/                    │
│    ├── 文章标题.md                                      │
│    └── assets/                                          │
│        └── [本地化图片]                                  │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ 构建

### 使用 Makefile (macOS/Linux)

```bash
# 查看所有命令
make help

# 打包浏览器扩展 (.zip)
make package-extension

# 构建所有平台 server
make build-server

# 打包所有组件 (扩展 + server)
make package

# 创建 Release 包
make release
```

### 使用 PowerShell (Windows)

```powershell
# 构建并打包所有组件
.\scripts\build.ps1

# 仅打包扩展
.\scripts\build.ps1 -Target ext

# 仅构建 server
.\scripts\build.ps1 -Target server

# 清理构建产物
.\scripts\build.ps1 -Clean
```

### 输出文件

构建完成后，所有发布文件位于 `dist/` 目录：

```
dist/
├── web-clipper-extension-v0.1.0.zip  # 浏览器扩展
├── clipper-server-darwin-amd64-vX.X.X.tar.gz  # macOS Intel
├── clipper-server-darwin-arm64-vX.X.X.tar.gz  # macOS Apple Silicon
├── clipper-server-windows-amd64-vX.X.X.zip    # Windows
├── clipper-server-linux-amd64-vX.X.X.tar.gz   # Linux
└── checksums.sha256                            # 校验和
```

## 🚀 开机自启动

下载的 server 包中包含安装脚本，可一键配置开机自启动。

### macOS

```bash
# 解压后进入目录
tar -xzf clipper-server-darwin-arm64-vX.X.X.tar.gz
cd darwin-arm64

# 安装并配置开机自启动
./install-macos.sh

# 查看服务状态
./install-macos.sh --status

# 停止/启动/重启服务
./install-macos.sh --stop
./install-macos.sh --start
./install-macos.sh --restart

# 卸载
./install-macos.sh --uninstall
```

### Windows

```powershell
# 解压后进入目录，以管理员身份运行 PowerShell

# 安装并配置开机自启动
.\install-windows.ps1

# 查看服务状态
.\install-windows.ps1 -Status

# 停止/启动/重启服务
.\install-windows.ps1 -Stop
.\install-windows.ps1 -Start
.\install-windows.ps1 -Restart

# 卸载
.\install-windows.ps1 -Uninstall
```

### 配置文件位置

| 平台 | 配置文件 | 日志目录 |
|------|----------|----------|
| macOS | `~/.config/web-clipper/config.yaml` | `~/Library/Logs/WebClipper/` |
| Windows | `%APPDATA%\WebClipper\config.yaml` | `%APPDATA%\WebClipper\logs\` |

## 📁 目录结构

```
web_clipper/
├── extension/              # 浏览器扩展
│   ├── manifest.json       # 扩展配置
│   ├── popup/              # 弹出窗口 UI
│   ├── options/            # 设置页面
│   ├── services/           # 业务服务
│   └── lib/                # 第三方库
├── server/                 # Go 后端服务
│   ├── main.go             # 入口
│   ├── handlers/           # HTTP 处理器
│   ├── middleware/         # 中间件 (鉴权)
│   ├── models/             # 数据模型
│   └── services/           # 业务服务
├── specs/                  # 功能规格文档
└── Makefile                # 构建脚本
```

## ⚠️ 注意事项

- 仅支持 Chromium 内核浏览器 (Chrome, Edge)
- 后端服务默认监听 `localhost:18080`
- 单张图片 > 5MB 将保留远程 URL
- 单次保存最多支持 20 张图片
- 页面刷新后高亮会丢失 (一次性会话设计)

## 📜 License

MIT License
