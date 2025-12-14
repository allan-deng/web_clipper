# Obsidian Web Clipper - Build Makefile

# Variables
BINARY_NAME=clipper-server
SERVER_DIR=server
EXTENSION_DIR=extension
BUILD_DIR=build
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS=-ldflags "-X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

.PHONY: all clean build build-linux build-darwin build-windows run test help

# Default target
all: build

# Help
help:
	@echo "Obsidian Web Clipper - Build Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make build         Build for current OS"
	@echo "  make build-linux   Build for Linux (amd64)"
	@echo "  make build-darwin  Build for macOS (amd64 + arm64)"
	@echo "  make build-windows Build for Windows (amd64)"
	@echo "  make build-all     Build for all platforms"
	@echo "  make run           Run the server locally"
	@echo "  make test          Run tests"
	@echo "  make clean         Remove build artifacts"
	@echo ""

# Build for current OS
build:
	@echo "Building for current OS..."
	@mkdir -p $(BUILD_DIR)
	cd $(SERVER_DIR) && go build $(LDFLAGS) -o ../$(BUILD_DIR)/$(BINARY_NAME) .
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

# Build for Linux
build-linux:
	@echo "Building for Linux (amd64)..."
	@mkdir -p $(BUILD_DIR)
	cd $(SERVER_DIR) && GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64"

# Build for macOS
build-darwin:
	@echo "Building for macOS..."
	@mkdir -p $(BUILD_DIR)
	cd $(SERVER_DIR) && GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 .
	cd $(SERVER_DIR) && GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 .
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64"
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64"

# Build for Windows
build-windows:
	@echo "Building for Windows (amd64)..."
	@mkdir -p $(BUILD_DIR)
	cd $(SERVER_DIR) && GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o ../$(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe .
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe"

# Build for all platforms
build-all: build-linux build-darwin build-windows
	@echo ""
	@echo "All builds complete. Artifacts in $(BUILD_DIR)/"
	@ls -la $(BUILD_DIR)/

# Run locally
run:
	@echo "Starting server..."
	cd $(SERVER_DIR) && go run . -config config.yaml

# Run with example config
run-example:
	@echo "Starting server with example config..."
	cd $(SERVER_DIR) && go run . -config config.example.yaml

# Run tests
test:
	@echo "Running tests..."
	cd $(SERVER_DIR) && go test -v ./...

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
	cd $(SERVER_DIR) && go clean
	@echo "Clean complete"

# Download dependencies
deps:
	@echo "Downloading dependencies..."
	cd $(SERVER_DIR) && go mod download
	cd $(SERVER_DIR) && go mod tidy
	@echo "Dependencies updated"

# Check code quality
lint:
	@echo "Running linter..."
	cd $(SERVER_DIR) && go vet ./...
	@echo "Lint complete"

# Format code
fmt:
	@echo "Formatting code..."
	cd $(SERVER_DIR) && go fmt ./...
	@echo "Format complete"
