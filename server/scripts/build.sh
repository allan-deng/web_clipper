#!/bin/bash
#
# Build script for Web Clipper Backend
# 
# Builds binaries for Windows, Linux, and macOS
# Creates tar packages for each platform
#
# Usage: ./build.sh [version]
# Example: ./build.sh 1.0.0
#

# Don't use set -e as it causes issues with counters and loops

# Configuration
APP_NAME="web_clipper_backend"
DEFAULT_VERSION="0.1.0"
VERSION="${1:-$DEFAULT_VERSION}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
DIST_DIR="$PROJECT_ROOT/dist"

# Build targets: OS/ARCH combinations
TARGETS=(
    "windows/amd64"
    "windows/arm64"
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Clean previous builds
clean() {
    print_info "Cleaning previous builds..."
    rm -rf "$BUILD_DIR"
    rm -rf "$DIST_DIR"
    mkdir -p "$BUILD_DIR"
    mkdir -p "$DIST_DIR"
}

# Get binary name based on OS
get_binary_name() {
    local os=$1
    if [ "$os" = "windows" ]; then
        echo "${APP_NAME}.exe"
    else
        echo "$APP_NAME"
    fi
}

# Get archive name
get_archive_name() {
    local os=$1
    local arch=$2
    echo "${APP_NAME}_${os}_${arch}_v${VERSION}.tar.gz"
}

# Get friendly platform name
get_platform_name() {
    local os=$1
    case "$os" in
        "windows") echo "Windows" ;;
        "linux") echo "Linux" ;;
        "darwin") echo "macOS" ;;
        *) echo "$os" ;;
    esac
}

# Create README for platform package
create_platform_readme() {
    local output_dir=$1
    local os=$2
    local arch=$3
    local binary_name=$4
    local platform_name
    platform_name=$(get_platform_name "$os")
    
    cat > "$output_dir/README.md" << READMEEOF
# Web Clipper Backend

Version: $VERSION
Platform: $platform_name ($arch)

## Quick Start

1. Copy config.example.yaml to config.yaml and edit it:
   cp config.example.yaml config.yaml

2. Edit config.yaml to set your local vault path and auth token.

3. Run the server:
READMEEOF

    if [ "$os" = "windows" ]; then
        cat >> "$output_dir/README.md" << READMEEOF
   .\\${binary_name}
READMEEOF
    else
        cat >> "$output_dir/README.md" << READMEEOF
   chmod +x $binary_name
   ./$binary_name
READMEEOF
    fi

    cat >> "$output_dir/README.md" << READMEEOF

4. The server will start on the configured port (default: 18080).

## Configuration

See config.example.yaml for all available options.

## License

MIT License
READMEEOF
}

# Build for a specific target
build_target() {
    local target=$1
    local os="${target%/*}"
    local arch="${target#*/}"
    local binary_name
    local platform_name
    local output_dir
    
    binary_name=$(get_binary_name "$os")
    platform_name=$(get_platform_name "$os")
    output_dir="$BUILD_DIR/${os}_${arch}"
    
    print_info "Building for $platform_name ($arch)..."
    
    mkdir -p "$output_dir"
    
    # Set build environment
    export GOOS="$os"
    export GOARCH="$arch"
    export CGO_ENABLED=0
    
    # Build with version info
    local ldflags="-s -w -X main.Version=$VERSION -X main.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    # Run go build
    cd "$PROJECT_ROOT" || return 1
    if go build -ldflags "$ldflags" -o "$output_dir/$binary_name" . 2>&1; then
        print_success "Built $platform_name ($arch)"
        
        # Copy config example
        if [ -f "$PROJECT_ROOT/config.example.yaml" ]; then
            cp "$PROJECT_ROOT/config.example.yaml" "$output_dir/"
        fi
        
        # Create README for this platform
        create_platform_readme "$output_dir" "$os" "$arch" "$binary_name"
        
        return 0
    else
        print_error "Failed to build for $platform_name ($arch)"
        return 1
    fi
}

# Create tar archive for a target
create_archive() {
    local target=$1
    local os="${target%/*}"
    local arch="${target#*/}"
    local archive_name
    local source_dir
    local platform_name
    
    archive_name=$(get_archive_name "$os" "$arch")
    source_dir="$BUILD_DIR/${os}_${arch}"
    platform_name=$(get_platform_name "$os")
    
    if [ ! -d "$source_dir" ]; then
        print_warning "Build directory not found for $platform_name ($arch), skipping archive"
        return 1
    fi
    
    print_info "Creating archive for $platform_name ($arch)..."
    
    cd "$BUILD_DIR" || return 1
    tar -czf "$DIST_DIR/$archive_name" "${os}_${arch}"
    
    if [ -f "$DIST_DIR/$archive_name" ]; then
        local size
        size=$(du -h "$DIST_DIR/$archive_name" | cut -f1)
        print_success "Created $archive_name ($size)"
        return 0
    else
        print_error "Failed to create archive for $platform_name ($arch)"
        return 1
    fi
}

# Generate checksums
generate_checksums() {
    print_info "Generating checksums..."
    
    cd "$DIST_DIR" || return 1
    
    # Generate SHA256 checksums
    if command -v sha256sum &> /dev/null; then
        sha256sum ./*.tar.gz > checksums.sha256
    elif command -v shasum &> /dev/null; then
        shasum -a 256 ./*.tar.gz > checksums.sha256
    else
        print_warning "No sha256sum or shasum found, skipping checksum generation"
        return 0
    fi
    
    print_success "Generated checksums.sha256"
}

# Print build summary
print_summary() {
    local success_count=$1
    local fail_count=$2
    
    echo ""
    echo "=============================================="
    echo "  Build Summary"
    echo "=============================================="
    echo ""
    echo "  Version: $VERSION"
    echo "  Output:  $DIST_DIR"
    echo ""
    echo "  Archives:"
    
    cd "$DIST_DIR" || return
    for archive in *.tar.gz; do
        if [ -f "$archive" ]; then
            local size
            size=$(du -h "$archive" | cut -f1)
            echo "    - $archive ($size)"
        fi
    done
    
    echo ""
    echo "  Build Results: $success_count succeeded, $fail_count failed"
    if [ -f "checksums.sha256" ]; then
        echo "  Checksums: checksums.sha256"
    fi
    echo ""
    echo "=============================================="
}

# Main build process
main() {
    echo ""
    echo "=============================================="
    echo "  Web Clipper Backend Build"
    echo "  Version: $VERSION"
    echo "=============================================="
    echo ""
    
    # Check Go installation
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed. Please install Go 1.21+ first."
        exit 1
    fi
    
    local go_version
    go_version=$(go version | awk '{print $3}')
    print_info "Using $go_version"
    
    # Clean and prepare
    clean
    
    # Download dependencies
    print_info "Downloading dependencies..."
    cd "$PROJECT_ROOT" || exit 1
    go mod download
    
    # Build all targets
    local success_count=0
    local fail_count=0
    
    for target in "${TARGETS[@]}"; do
        if build_target "$target"; then
            success_count=$((success_count + 1))
        else
            fail_count=$((fail_count + 1))
        fi
    done
    
    echo ""
    print_info "Build completed: $success_count succeeded, $fail_count failed"
    echo ""
    
    # Create archives
    for target in "${TARGETS[@]}"; do
        create_archive "$target" || true
    done
    
    # Generate checksums
    generate_checksums
    
    # Print summary
    print_summary "$success_count" "$fail_count"
    
    if [ "$fail_count" -gt 0 ]; then
        exit 1
    fi
}

# Run main
main "$@"
