#!/bin/bash
#
# Obsidian Web Clipper - macOS 安装脚本
#
# 功能:
#   - 安装 clipper-server 到 /usr/local/bin
#   - 配置 LaunchAgent 实现开机自启动
#   - 创建默认配置文件
#
# 用法:
#   ./install-macos.sh [选项]
#
# 选项:
#   --no-autostart    不配置开机自启动
#   --uninstall       卸载
#   --help            显示帮助
#

set -e

# ============================================
# 配置
# ============================================
APP_NAME="clipper-server"
PLIST_LABEL="com.obsidian-web-clipper"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="$HOME/.config/obsidian-web-clipper"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$PLIST_DIR/$PLIST_LABEL.plist"
LOG_DIR="$HOME/Library/Logs/ObsidianWebClipper"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARNING]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ============================================
# 帮助
# ============================================
show_help() {
    echo ""
    echo "Obsidian Web Clipper - macOS 安装脚本"
    echo ""
    echo "用法: ./install-macos.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --no-autostart    不配置开机自启动"
    echo "  --uninstall       卸载程序"
    echo "  --status          查看服务状态"
    echo "  --start           启动服务"
    echo "  --stop            停止服务"
    echo "  --restart         重启服务"
    echo "  --help            显示帮助"
    echo ""
}

# ============================================
# 查找二进制文件
# ============================================
find_binary() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local search_paths=(
        "$script_dir/$APP_NAME"
        "$script_dir/../$APP_NAME"
        "./$APP_NAME"
        "$INSTALL_DIR/$APP_NAME"
    )
    
    for path in "${search_paths[@]}"; do
        if [ -f "$path" ] && [ -x "$path" ]; then
            echo "$(cd "$(dirname "$path")" && pwd)/$(basename "$path")"
            return 0
        fi
    done
    
    return 1
}

# ============================================
# 创建配置文件
# ============================================
create_config() {
    if [ -f "$CONFIG_DIR/config.yaml" ]; then
        info "配置文件已存在: $CONFIG_DIR/config.yaml"
        return
    fi
    
    mkdir -p "$CONFIG_DIR"
    
    cat > "$CONFIG_DIR/config.yaml" << 'EOF'
# Obsidian Web Clipper 配置文件

server:
  port: 18080
  maxBodySize: "100MB"

auth:
  # 请修改为你自己的 token
  token: "your-secret-token-change-me"

vault:
  # 请修改为你的 Obsidian 库路径
  path: ""
  subdir: "Inbox/WebClips"

logging:
  level: "info"
EOF
    
    success "已创建配置文件: $CONFIG_DIR/config.yaml"
    warn "请编辑配置文件，设置你的 Obsidian 库路径和 token"
}

# ============================================
# 创建 LaunchAgent
# ============================================
create_launchagent() {
    local binary_path="$1"
    
    mkdir -p "$PLIST_DIR"
    mkdir -p "$LOG_DIR"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_LABEL</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>$binary_path</string>
        <string>-config</string>
        <string>$CONFIG_DIR/config.yaml</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>$LOG_DIR/stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/stderr.log</string>
    
    <key>WorkingDirectory</key>
    <string>$CONFIG_DIR</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF
    
    success "已创建 LaunchAgent: $PLIST_FILE"
}

# ============================================
# 安装
# ============================================
install() {
    local no_autostart=false
    
    for arg in "$@"; do
        case "$arg" in
            --no-autostart) no_autostart=true ;;
        esac
    done
    
    echo ""
    echo "========================================"
    echo "  Obsidian Web Clipper 安装程序"
    echo "========================================"
    echo ""
    
    # 查找二进制文件
    info "查找 $APP_NAME..."
    local binary_path
    if ! binary_path=$(find_binary); then
        error "找不到 $APP_NAME，请确保它在当前目录或脚本同目录下"
    fi
    info "找到: $binary_path"
    
    # 复制到安装目录
    info "安装到 $INSTALL_DIR..."
    if [ ! -w "$INSTALL_DIR" ]; then
        sudo cp "$binary_path" "$INSTALL_DIR/$APP_NAME"
        sudo chmod +x "$INSTALL_DIR/$APP_NAME"
    else
        cp "$binary_path" "$INSTALL_DIR/$APP_NAME"
        chmod +x "$INSTALL_DIR/$APP_NAME"
    fi
    success "已安装: $INSTALL_DIR/$APP_NAME"
    
    # 创建配置
    create_config
    
    # 配置开机自启动
    if [ "$no_autostart" = false ]; then
        info "配置开机自启动..."
        
        # 先停止现有服务
        launchctl unload "$PLIST_FILE" 2>/dev/null || true
        
        # 创建 LaunchAgent
        create_launchagent "$INSTALL_DIR/$APP_NAME"
        
        # 加载服务
        launchctl load "$PLIST_FILE"
        success "已启用开机自启动"
        
        # 启动服务
        info "启动服务..."
        sleep 1
        if launchctl list | grep -q "$PLIST_LABEL"; then
            success "服务已启动"
        else
            warn "服务可能未正常启动，请检查配置文件"
        fi
    fi
    
    echo ""
    echo "========================================"
    echo "  安装完成!"
    echo "========================================"
    echo ""
    echo "配置文件: $CONFIG_DIR/config.yaml"
    echo "日志目录: $LOG_DIR/"
    echo ""
    echo "常用命令:"
    echo "  $0 --status     查看状态"
    echo "  $0 --start      启动服务"
    echo "  $0 --stop       停止服务"
    echo "  $0 --restart    重启服务"
    echo "  $0 --uninstall  卸载"
    echo ""
}

# ============================================
# 卸载
# ============================================
uninstall() {
    echo ""
    echo "========================================"
    echo "  Obsidian Web Clipper 卸载程序"
    echo "========================================"
    echo ""
    
    # 停止并卸载 LaunchAgent
    if [ -f "$PLIST_FILE" ]; then
        info "停止服务..."
        launchctl unload "$PLIST_FILE" 2>/dev/null || true
        rm -f "$PLIST_FILE"
        success "已移除 LaunchAgent"
    fi
    
    # 删除二进制文件
    if [ -f "$INSTALL_DIR/$APP_NAME" ]; then
        info "删除程序..."
        if [ ! -w "$INSTALL_DIR" ]; then
            sudo rm -f "$INSTALL_DIR/$APP_NAME"
        else
            rm -f "$INSTALL_DIR/$APP_NAME"
        fi
        success "已删除: $INSTALL_DIR/$APP_NAME"
    fi
    
    echo ""
    echo "卸载完成!"
    echo ""
    echo "以下文件已保留 (如需删除请手动操作):"
    echo "  配置文件: $CONFIG_DIR/"
    echo "  日志文件: $LOG_DIR/"
    echo ""
}

# ============================================
# 服务控制
# ============================================
service_status() {
    echo ""
    if launchctl list | grep -q "$PLIST_LABEL"; then
        success "服务运行中"
        launchctl list | grep "$PLIST_LABEL"
    else
        warn "服务未运行"
    fi
    echo ""
}

service_start() {
    if [ ! -f "$PLIST_FILE" ]; then
        error "LaunchAgent 未安装，请先运行安装"
    fi
    info "启动服务..."
    launchctl load "$PLIST_FILE" 2>/dev/null || true
    sleep 1
    service_status
}

service_stop() {
    info "停止服务..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    success "服务已停止"
}

service_restart() {
    service_stop
    sleep 1
    service_start
}

# ============================================
# 主函数
# ============================================
main() {
    case "${1:-}" in
        --help|-h)
            show_help
            ;;
        --uninstall)
            uninstall
            ;;
        --status)
            service_status
            ;;
        --start)
            service_start
            ;;
        --stop)
            service_stop
            ;;
        --restart)
            service_restart
            ;;
        *)
            install "$@"
            ;;
    esac
}

main "$@"
