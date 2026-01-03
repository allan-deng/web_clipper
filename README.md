# Web Clipper

[中文文档](README_ZH.md)

A powerful browser extension + local service tool that allows you to **effortlessly** save web content to your local knowledge base in markdown format with one click.

![Chrome](https://img.shields.io/badge/Chrome-Supported-green?logo=googlechrome)
![Edge](https://img.shields.io/badge/Edge-Supported-green?logo=microsoftedge)
![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- **🚀 One-Click Save** - Automatically extract web content and convert to clean Markdown format
- **🖼️ Local Image Storage** - Automatically download images locally for offline access
- **📋 Copy to Clipboard** - Copy Markdown directly to clipboard without backend service
- **🖍️ Highlight & Annotate** - Highlight selected text on web pages and add personal notes
- **🤖 AI Smart Summary** - Support OpenAI / Anthropic / OpenRouter for auto-generating summaries and tags

## 📦 Installation

### 1. Start Backend Service

```bash
cd server

# Download dependencies
go mod download

# Create config file
cp config.example.yaml config.yaml

# Edit config (set your local knowledge base path)
vim config.yaml

# Start service
go run main.go
```

**Config file example (`config.yaml`)**:

```yaml
server:
  port: 18080
  maxBodySize: "100MB"

auth:
  token: "your-secret-token"  # Set your auth token

vault:
  path: "/path/to/your/Vault"  # Your knowledge base path
  subdir: "Inbox/WebClips"     # Save subdirectory
```

### 2. Install Browser Extension

1. Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` directory in the project

### 3. Configure Extension

1. Click extension icon → **Settings**
2. Set server address: `http://localhost:18080`
3. Enter Auth Token (same as backend config)
4. (Optional) Configure AI service API Key

## 🎯 Usage

| Action | Steps |
|--------|-------|
| **Save to Local** | Open webpage → Click extension icon → **Save to local** |
| **Copy to Clipboard** | Open webpage → Click extension icon → **Copy to clipboard** |
| **Add Highlight** | Select text → Click floating menu 🖍️ |
| **Add Annotation** | Select text → Click floating menu 📝 → Enter annotation |

## 📄 Generated Markdown Format

```markdown
---
title: "Article Title"
url: "https://example.com/article"
date: 2025-12-14
tags:
  - AI-generated-tag
---

## Summary
[AI-generated key points and arguments]

---

## My Notes
> **Highlight**: Highlighted text
> 
> 💬 Annotation: My annotation content

---

## Content
[Article content in Markdown]
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Browser Extension (extension/)            │
│  • Readability.js - Web content extraction              │
│  • Turndown.js - HTML → Markdown                        │
│  • Mark.js - Text highlighting                          │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTP POST /api/v1/save
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Go Backend (server/)                    │
│  • Gin Web Framework                                    │
│  • Token Authentication                                 │
│  • Atomic File Writing                                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 Local Knowledge Base                     │
│  Inbox/WebClips/2025-12-14/Article-Title/               │
│    ├── Article-Title.md                                 │
│    └── assets/                                          │
│        └── [localized images]                           │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Build

### Using Makefile (macOS/Linux)

```bash
# View all commands
make help

# Package browser extension (.zip)
make package-extension

# Build server for all platforms
make build-server

# Package all components (extension + server)
make package

# Create Release package
make release
```

### Using PowerShell (Windows)

```powershell
# Build and package all components
.\scripts\build.ps1

# Package extension only
.\scripts\build.ps1 -Target ext

# Build server only
.\scripts\build.ps1 -Target server

# Clean build artifacts
.\scripts\build.ps1 -Clean
```

### Output Files

After building, all release files are located in the `dist/` directory:

```
dist/
├── web-clipper-extension-v0.1.0.zip  # Browser extension
├── clipper-server-darwin-amd64-vX.X.X.tar.gz  # macOS Intel
├── clipper-server-darwin-arm64-vX.X.X.tar.gz  # macOS Apple Silicon
├── clipper-server-windows-amd64-vX.X.X.zip    # Windows
├── clipper-server-linux-amd64-vX.X.X.tar.gz   # Linux
└── checksums.sha256                            # Checksums
```

## 🚀 Auto-Start on Boot

The downloaded server package includes installation scripts for one-click auto-start configuration.

### macOS

```bash
# Extract and enter directory
tar -xzf clipper-server-darwin-arm64-vX.X.X.tar.gz
cd darwin-arm64

# Install and configure auto-start
./install-macos.sh

# Check service status
./install-macos.sh --status

# Stop/Start/Restart service
./install-macos.sh --stop
./install-macos.sh --start
./install-macos.sh --restart

# Uninstall
./install-macos.sh --uninstall
```

### Windows

```powershell
# Extract and enter directory, run PowerShell as Administrator

# Install and configure auto-start
.\install-windows.ps1

# Check service status
.\install-windows.ps1 -Status

# Stop/Start/Restart service
.\install-windows.ps1 -Stop
.\install-windows.ps1 -Start
.\install-windows.ps1 -Restart

# Uninstall
.\install-windows.ps1 -Uninstall
```

### Config File Locations

| Platform | Config File | Log Directory |
|----------|-------------|---------------|
| macOS | `~/.config/web-clipper/config.yaml` | `~/Library/Logs/WebClipper/` |
| Windows | `%APPDATA%\WebClipper\config.yaml` | `%APPDATA%\WebClipper\logs\` |

## 📁 Directory Structure

```
web_clipper/
├── extension/              # Browser extension
│   ├── manifest.json       # Extension config
│   ├── popup/              # Popup UI
│   ├── options/            # Settings page
│   ├── services/           # Business services
│   └── lib/                # Third-party libraries
├── server/                 # Go backend service
│   ├── main.go             # Entry point
│   ├── handlers/           # HTTP handlers
│   ├── middleware/         # Middleware (auth)
│   ├── models/             # Data models
│   └── services/           # Business services
├── specs/                  # Feature specifications
└── Makefile                # Build scripts
```

## ⚠️ Notes

- Only supports Chromium-based browsers (Chrome, Edge)
- Backend service listens on `localhost:18080` by default
- Images > 5MB will keep remote URL
- Maximum 20 images per save
- Highlights are lost after page refresh (one-time session design)

## 📜 License

MIT License
