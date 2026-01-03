#!/bin/bash
#
# Web Clipper - 跨平台构建脚本
#
# 用法:
#   ./build.sh              # 构建并打包所有组件
#   ./build.sh server       # 仅构建 server
#   ./build.sh extension    # 仅打包扩展
#   ./build.sh package      # 仅打包 (使用现有构建)
#   ./build.sh clean        # 清理构建产物
#   ./build.sh help         # 显示帮助
#

set -e

# ============================================
# 配置
# ============================================
APP_NAME="clipper-server"
SERVER_DIR="server"
EXTENSION_DIR="extension"
BUILD_DIR="build"
DIST_DIR="dist"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# 版本号
VERSION="${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo "0.1.0")}"
BUILD_TIME=$(date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS="-s -w -X main.Version=$VERSION -X main.BuildTime=$BUILD_TIME"

# 从 manifest.json 获取扩展版本
EXT_VERSION=$(grep '"version"' "$EXTENSION_DIR/manifest.json" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')

# 构建目标
TARGETS=(
    "darwin/amd64"
    "darwin/arm64"
    "windows/amd64"
    "linux/amd64"
)

# ============================================
# 颜色输出
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARNING]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ============================================
# 辅助函数
# ============================================

# 获取二进制文件名
get_binary_name() {
    local os=$1
    if [ "$os" = "windows" ]; then
        echo "${APP_NAME}.exe"
    else
        echo "$APP_NAME"
    fi
}

# 获取平台显示名称
get_platform_name() {
    case "$1" in
        "darwin")  echo "macOS" ;;
        "windows") echo "Windows" ;;
        "linux")   echo "Linux" ;;
        *)         echo "$1" ;;
    esac
}

# ============================================
# 构建函数
# ============================================

# 清理
clean() {
    info "清理构建产物..."
    rm -rf "$BUILD_DIR"
    rm -rf "$DIST_DIR"
    cd "$SERVER_DIR" && go clean 2>/dev/null || true
    cd "$PROJECT_ROOT"
    success "清理完成"
}

# 构建单个目标
build_target() {
    local target=$1
    local os="${target%/*}"
    local arch="${target#*/}"
    local platform_name=$(get_platform_name "$os")
    local binary_name=$(get_binary_name "$os")
    local output_dir="$BUILD_DIR/${os}-${arch}"
    
    info "构建 $platform_name ($arch)..."
    
    mkdir -p "$output_dir"
    
    export GOOS="$os"
    export GOARCH="$arch"
    export CGO_ENABLED=0
    
    cd "$SERVER_DIR"
    if go build -ldflags "$LDFLAGS" -o "../$output_dir/$binary_name" . 2>&1; then
        cd "$PROJECT_ROOT"
        
        # 复制配置文件
        if [ -f "$SERVER_DIR/config.example.yaml" ]; then
            cp "$SERVER_DIR/config.example.yaml" "$output_dir/"
        fi
        
        # 复制安装脚本
        if [ "$os" = "windows" ]; then
            cp "$PROJECT_ROOT/scripts/install-windows.ps1" "$output_dir/"
        elif [ "$os" = "darwin" ]; then
            cp "$PROJECT_ROOT/scripts/install-macos.sh" "$output_dir/"
        elif [ "$os" = "linux" ]; then
            cp "$PROJECT_ROOT/scripts/install-macos.sh" "$output_dir/install.sh"
        fi
        
        success "构建完成: $platform_name ($arch)"
        return 0
    else
        cd "$PROJECT_ROOT"
        error "构建失败: $platform_name ($arch)"
        return 1
    fi
}

# 构建所有 Server
build_servers() {
    echo ""
    echo -e "${CYAN}========================================"
    echo "  构建 Server (所有平台)"
    echo -e "========================================${NC}"
    echo ""
    
    local success_count=0
    local fail_count=0
    
    for target in "${TARGETS[@]}"; do
        if build_target "$target"; then
            ((success_count++))
        else
            ((fail_count++))
        fi
    done
    
    echo ""
    info "构建结果: $success_count 成功, $fail_count 失败"
    
    [ "$fail_count" -eq 0 ]
}

# 打包浏览器扩展
package_extension() {
    echo ""
    echo -e "${CYAN}========================================"
    echo "  打包浏览器扩展"
    echo -e "========================================${NC}"
    echo ""
    
    mkdir -p "$DIST_DIR"
    
    local zip_name="web-clipper-extension-v${EXT_VERSION}.zip"
    local zip_path="$DIST_DIR/$zip_name"
    
    rm -f "$zip_path"
    
    info "打包扩展..."
    
    cd "$EXTENSION_DIR"
    zip -r "../$zip_path" \
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
        -x "*.DS_Store" -x "*/.git/*" -x "*.map"
    cd "$PROJECT_ROOT"
    
    local size=$(du -h "$zip_path" | cut -f1)
    success "扩展打包完成: $zip_name ($size)"
}

# 打包 Server
package_servers() {
    echo ""
    echo -e "${CYAN}========================================"
    echo "  打包 Server"
    echo -e "========================================${NC}"
    echo ""
    
    mkdir -p "$DIST_DIR"
    
    for target in "${TARGETS[@]}"; do
        local os="${target%/*}"
        local arch="${target#*/}"
        local source_dir="$BUILD_DIR/${os}-${arch}"
        local platform_name=$(get_platform_name "$os")
        
        if [ ! -d "$source_dir" ]; then
            warn "跳过 $platform_name ($arch) - 未构建"
            continue
        fi
        
        local archive_name="clipper-server-${os}-${arch}-v${VERSION}"
        
        info "打包 $platform_name ($arch)..."
        
        cd "$BUILD_DIR"
        if [ "$os" = "windows" ]; then
            zip -rq "../$DIST_DIR/${archive_name}.zip" "${os}-${arch}"
        else
            tar -czf "../$DIST_DIR/${archive_name}.tar.gz" "${os}-${arch}"
        fi
        cd "$PROJECT_ROOT"
        
        success "打包完成: ${archive_name}"
    done
    
    # 生成校验和
    info "生成校验和..."
    cd "$DIST_DIR"
    if command -v sha256sum &> /dev/null; then
        sha256sum clipper-server-* > checksums.sha256 2>/dev/null || true
    elif command -v shasum &> /dev/null; then
        shasum -a 256 clipper-server-* > checksums.sha256 2>/dev/null || true
    fi
    cd "$PROJECT_ROOT"
    success "校验和已生成"
}

# 显示帮助
show_help() {
    echo ""
    echo -e "${CYAN}Web Clipper - 构建脚本${NC}"
    echo ""
    echo "用法:"
    echo "  ./build.sh              # 构建并打包所有组件"
    echo "  ./build.sh server       # 仅构建 server"
    echo "  ./build.sh extension    # 仅打包扩展"
    echo "  ./build.sh package      # 仅打包 (使用现有构建)"
    echo "  ./build.sh clean        # 清理构建产物"
    echo "  ./build.sh help         # 显示帮助"
    echo ""
    echo "环境变量:"
    echo "  VERSION=x.x.x           # 指定版本号"
    echo ""
    echo "版本信息:"
    echo "  Server:    v$VERSION"
    echo "  Extension: v$EXT_VERSION"
    echo ""
}

# 显示构建摘要
show_summary() {
    echo ""
    echo -e "${GREEN}========================================"
    echo "  构建完成!"
    echo -e "========================================${NC}"
    echo ""
    
    if [ -d "$DIST_DIR" ]; then
        echo -e "${CYAN}输出文件:${NC}"
        ls -lh "$DIST_DIR/" | tail -n +2 | while read line; do
            echo "  $line"
        done
        echo ""
    fi
}

# ============================================
# 主函数
# ============================================
main() {
    local target="${1:-all}"
    
    echo ""
    echo -e "${CYAN}========================================"
    echo "  Web Clipper Build"
    echo "  Version: $VERSION"
    echo -e "========================================${NC}"
    
    # 检查 Go
    if ! command -v go &> /dev/null; then
        error "Go 未安装，请先安装 Go 1.21+"
        exit 1
    fi
    
    local go_version=$(go version | awk '{print $3}')
    info "使用 $go_version"
    
    case "$target" in
        "all")
            build_servers
            package_extension
            package_servers
            show_summary
            ;;
        "server"|"servers")
            build_servers
            ;;
        "ext"|"extension")
            package_extension
            ;;
        "package")
            package_extension
            package_servers
            show_summary
            ;;
        "clean")
            clean
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "未知目标: $target"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
