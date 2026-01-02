# Obsidian Web Clipper - Build Makefile
#
# 构建目标:
#   - 浏览器扩展 (Chrome/Edge)
#   - 后端服务 (Windows/macOS/Linux)

# ============================================
# 变量定义
# ============================================
BINARY_NAME=clipper-server
SERVER_DIR=server
EXTENSION_DIR=extension
BUILD_DIR=build
DIST_DIR=dist

# 版本信息
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "0.1.0")
BUILD_TIME=$(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS=-ldflags "-s -w -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

# 扩展版本 (从 manifest.json 读取)
EXT_VERSION=$(shell grep '"version"' $(EXTENSION_DIR)/manifest.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')

.PHONY: all clean build build-server build-extension \
        build-linux build-darwin build-windows build-all \
        package package-extension package-server package-all \
        run test help deps lint fmt

# ============================================
# 默认目标
# ============================================
all: build

# ============================================
# 帮助信息
# ============================================
help:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║         Obsidian Web Clipper - 构建命令                       ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📦 构建命令:"
	@echo "  make build              构建当前平台 server"
	@echo "  make build-server       构建所有平台 server"
	@echo "  make build-extension    准备浏览器扩展 (无需构建)"
	@echo "  make build-all          构建所有组件"
	@echo ""
	@echo "🎁 打包命令:"
	@echo "  make package            打包所有组件"
	@echo "  make package-extension  打包浏览器扩展 (.zip)"
	@echo "  make package-server     打包所有平台 server (.tar.gz/.zip)"
	@echo ""
	@echo "🖥️  平台构建:"
	@echo "  make build-darwin       构建 macOS (amd64 + arm64)"
	@echo "  make build-windows      构建 Windows (amd64)"
	@echo "  make build-linux        构建 Linux (amd64)"
	@echo ""
	@echo "🔧 开发命令:"
	@echo "  make run                本地运行 server"
	@echo "  make test               运行测试"
	@echo "  make deps               下载依赖"
	@echo "  make lint               代码检查"
	@echo "  make fmt                代码格式化"
	@echo "  make clean              清理构建产物"
	@echo ""
	@echo "📋 当前版本:"
	@echo "  Server:    $(VERSION)"
	@echo "  Extension: $(EXT_VERSION)"
	@echo ""

# ============================================
# 构建命令
# ============================================

# 构建当前平台
build:
	@echo "🔨 构建当前平台 server..."
	@mkdir -p $(BUILD_DIR)
	cd $(SERVER_DIR) && go build $(LDFLAGS) -o ../$(BUILD_DIR)/$(BINARY_NAME) .
	@echo "✅ 构建完成: $(BUILD_DIR)/$(BINARY_NAME)"

# 构建所有平台 server
build-server: build-darwin build-windows build-linux
	@echo ""
	@echo "✅ 所有平台 server 构建完成"

# 准备浏览器扩展 (JavaScript 无需编译)
build-extension:
	@echo "📦 浏览器扩展无需编译，使用 'make package-extension' 打包"

# 构建所有组件
build-all: build-server
	@echo ""
	@echo "✅ 所有组件构建完成"

# ============================================
# 平台构建
# ============================================

# macOS (Intel + Apple Silicon)
build-darwin:
	@echo "🍎 构建 macOS..."
	@mkdir -p $(BUILD_DIR)/darwin-amd64
	@mkdir -p $(BUILD_DIR)/darwin-arm64
	cd $(SERVER_DIR) && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/darwin-amd64/$(BINARY_NAME) .
	cd $(SERVER_DIR) && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/darwin-arm64/$(BINARY_NAME) .
	@cp $(SERVER_DIR)/config.example.yaml $(BUILD_DIR)/darwin-amd64/
	@cp $(SERVER_DIR)/config.example.yaml $(BUILD_DIR)/darwin-arm64/
	@cp scripts/install-macos.sh $(BUILD_DIR)/darwin-amd64/
	@cp scripts/install-macos.sh $(BUILD_DIR)/darwin-arm64/
	@echo "✅ macOS 构建完成"

# Windows
build-windows:
	@echo "🪟 构建 Windows..."
	@mkdir -p $(BUILD_DIR)/windows-amd64
	cd $(SERVER_DIR) && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/windows-amd64/$(BINARY_NAME).exe .
	@cp $(SERVER_DIR)/config.example.yaml $(BUILD_DIR)/windows-amd64/
	@cp scripts/install-windows.ps1 $(BUILD_DIR)/windows-amd64/
	@echo "✅ Windows 构建完成"

# Linux
build-linux:
	@echo "🐧 构建 Linux..."
	@mkdir -p $(BUILD_DIR)/linux-amd64
	cd $(SERVER_DIR) && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/linux-amd64/$(BINARY_NAME) .
	@cp $(SERVER_DIR)/config.example.yaml $(BUILD_DIR)/linux-amd64/
	@cp scripts/install-macos.sh $(BUILD_DIR)/linux-amd64/install.sh
	@echo "✅ Linux 构建完成"

# ============================================
# 打包命令
# ============================================

# 打包所有组件
package: package-extension package-server
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║                    打包完成                                   ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📁 输出目录: $(DIST_DIR)/"
	@echo ""
	@ls -lh $(DIST_DIR)/
	@echo ""

# 打包浏览器扩展
package-extension:
	@echo "📦 打包浏览器扩展..."
	@mkdir -p $(DIST_DIR)
	@rm -f $(DIST_DIR)/obsidian-web-clipper-extension-v$(EXT_VERSION).zip
	@cd $(EXTENSION_DIR) && zip -r ../$(DIST_DIR)/obsidian-web-clipper-extension-v$(EXT_VERSION).zip \
		manifest.json \
		background.js \
		content.js \
		popup/ \
		options/ \
		services/ \
		utils/ \
		lib/ \
		styles/ \
		icons/ \
		-x "*.DS_Store" -x "*/.git/*"
	@echo "✅ 扩展打包完成: $(DIST_DIR)/obsidian-web-clipper-extension-v$(EXT_VERSION).zip"

# 打包所有平台 server
package-server: build-server
	@echo "📦 打包 server..."
	@mkdir -p $(DIST_DIR)
	@# macOS Intel
	@cd $(BUILD_DIR) && tar -czf ../$(DIST_DIR)/clipper-server-darwin-amd64-v$(VERSION).tar.gz darwin-amd64
	@# macOS Apple Silicon
	@cd $(BUILD_DIR) && tar -czf ../$(DIST_DIR)/clipper-server-darwin-arm64-v$(VERSION).tar.gz darwin-arm64
	@# Windows (使用 zip)
	@cd $(BUILD_DIR) && zip -r ../$(DIST_DIR)/clipper-server-windows-amd64-v$(VERSION).zip windows-amd64
	@# Linux
	@cd $(BUILD_DIR) && tar -czf ../$(DIST_DIR)/clipper-server-linux-amd64-v$(VERSION).tar.gz linux-amd64
	@# 生成校验和
	@cd $(DIST_DIR) && shasum -a 256 clipper-server-* > checksums.sha256 2>/dev/null || sha256sum clipper-server-* > checksums.sha256 2>/dev/null || true
	@echo "✅ Server 打包完成"

# 仅打包所有 (不重新构建)
package-all: package-extension
	@echo "📦 打包 server (使用现有构建)..."
	@mkdir -p $(DIST_DIR)
	@if [ -d "$(BUILD_DIR)/darwin-amd64" ]; then cd $(BUILD_DIR) && tar -czf ../$(DIST_DIR)/clipper-server-darwin-amd64-v$(VERSION).tar.gz darwin-amd64; fi
	@if [ -d "$(BUILD_DIR)/darwin-arm64" ]; then cd $(BUILD_DIR) && tar -czf ../$(DIST_DIR)/clipper-server-darwin-arm64-v$(VERSION).tar.gz darwin-arm64; fi
	@if [ -d "$(BUILD_DIR)/windows-amd64" ]; then cd $(BUILD_DIR) && zip -rq ../$(DIST_DIR)/clipper-server-windows-amd64-v$(VERSION).zip windows-amd64; fi
	@if [ -d "$(BUILD_DIR)/linux-amd64" ]; then cd $(BUILD_DIR) && tar -czf ../$(DIST_DIR)/clipper-server-linux-amd64-v$(VERSION).tar.gz linux-amd64; fi
	@cd $(DIST_DIR) && shasum -a 256 clipper-server-* > checksums.sha256 2>/dev/null || sha256sum clipper-server-* > checksums.sha256 2>/dev/null || true
	@echo "✅ 打包完成"

# ============================================
# 开发命令
# ============================================

# 本地运行
run:
	@echo "🚀 启动 server..."
	cd $(SERVER_DIR) && go run . -config config.yaml

# 使用示例配置运行
run-example:
	@echo "🚀 使用示例配置启动 server..."
	cd $(SERVER_DIR) && go run . -config config.example.yaml

# 运行测试
test:
	@echo "🧪 运行测试..."
	cd $(SERVER_DIR) && go test -v ./...

# 下载依赖
deps:
	@echo "📥 下载依赖..."
	cd $(SERVER_DIR) && go mod download
	cd $(SERVER_DIR) && go mod tidy
	@echo "✅ 依赖更新完成"

# 代码检查
lint:
	@echo "🔍 代码检查..."
	cd $(SERVER_DIR) && go vet ./...
	@echo "✅ 检查完成"

# 代码格式化
fmt:
	@echo "✨ 代码格式化..."
	cd $(SERVER_DIR) && go fmt ./...
	@echo "✅ 格式化完成"

# 清理构建产物
clean:
	@echo "🧹 清理构建产物..."
	rm -rf $(BUILD_DIR)
	rm -rf $(DIST_DIR)
	cd $(SERVER_DIR) && go clean
	@echo "✅ 清理完成"

# ============================================
# 发布命令
# ============================================

# 创建 GitHub Release 包
release: clean package
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║                  Release 包准备完成                           ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📋 版本信息:"
	@echo "   Server:    v$(VERSION)"
	@echo "   Extension: v$(EXT_VERSION)"
	@echo ""
	@echo "📁 发布文件:"
	@ls -lh $(DIST_DIR)/
	@echo ""
	@echo "📝 下一步:"
	@echo "   1. 在 GitHub 创建 Release"
	@echo "   2. 上传 $(DIST_DIR)/ 目录下的所有文件"
	@echo "   3. 将扩展 zip 上传到 Chrome Web Store (可选)"
	@echo ""
