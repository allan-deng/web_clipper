# Web Clipper - Windows Build Script (PowerShell)
#
# 用法:
#   .\build.ps1                 # 构建所有组件
#   .\build.ps1 -Target server  # 仅构建 server
#   .\build.ps1 -Target ext     # 仅打包扩展
#   .\build.ps1 -Clean          # 清理构建产物

param(
    [string]$Target = "all",
    [switch]$Clean,
    [string]$Version = ""
)

# 配置
$AppName = "clipper-server"
$ServerDir = "server"
$ExtensionDir = "extension"
$BuildDir = "build"
$DistDir = "dist"

# 获取版本号
if ($Version -eq "") {
    try {
        $Version = git describe --tags --always --dirty 2>$null
        if (-not $Version) { $Version = "0.1.0" }
    } catch {
        $Version = "0.1.0"
    }
}

# 从 manifest.json 获取扩展版本
$ManifestPath = Join-Path $ExtensionDir "manifest.json"
$ExtVersion = "0.1.0"
if (Test-Path $ManifestPath) {
    $Manifest = Get-Content $ManifestPath | ConvertFrom-Json
    $ExtVersion = $Manifest.version
}

$BuildTime = Get-Date -Format "yyyy-MM-dd_HH:mm:ss"
$LdFlags = "-s -w -X main.Version=$Version -X main.BuildTime=$BuildTime"

# 颜色输出
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

# 清理
function Clean-Build {
    Write-Info "清理构建产物..."
    if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
    if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
    Write-Success "清理完成"
}

# 构建 Server
function Build-Server {
    param([string]$OS, [string]$Arch)
    
    $OutputDir = Join-Path $BuildDir "$OS-$Arch"
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    
    $BinaryName = if ($OS -eq "windows") { "$AppName.exe" } else { $AppName }
    $OutputPath = Join-Path $OutputDir $BinaryName
    
    Write-Info "构建 $OS/$Arch..."
    
    $env:GOOS = $OS
    $env:GOARCH = $Arch
    $env:CGO_ENABLED = "0"
    
    Push-Location $ServerDir
    try {
        go build -ldflags $LdFlags -o "../$OutputPath" .
        if ($LASTEXITCODE -ne 0) {
            Write-Err "构建失败: $OS/$Arch"
            return $false
        }
    } finally {
        Pop-Location
        Remove-Item Env:GOOS -ErrorAction SilentlyContinue
        Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
        Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
    }
    
    # 复制配置文件
    $ConfigExample = Join-Path $ServerDir "config.example.yaml"
    if (Test-Path $ConfigExample) {
        Copy-Item $ConfigExample $OutputDir
    }
    
    # 复制安装脚本
    $ScriptDir = Split-Path -Parent $MyInvocation.ScriptName
    if ($OS -eq "windows") {
        $InstallScript = Join-Path $ScriptDir "install-windows.ps1"
        if (Test-Path $InstallScript) {
            Copy-Item $InstallScript $OutputDir
        }
    } elseif ($OS -eq "darwin") {
        $InstallScript = Join-Path $ScriptDir "install-macos.sh"
        if (Test-Path $InstallScript) {
            Copy-Item $InstallScript $OutputDir
        }
    } elseif ($OS -eq "linux") {
        $InstallScript = Join-Path $ScriptDir "install-macos.sh"
        if (Test-Path $InstallScript) {
            Copy-Item $InstallScript (Join-Path $OutputDir "install.sh")
        }
    }
    
    Write-Success "构建完成: $OS/$Arch"
    return $true
}

# 构建所有平台 Server
function Build-AllServers {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  构建 Server (所有平台)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $Targets = @(
        @{OS="windows"; Arch="amd64"},
        @{OS="darwin"; Arch="amd64"},
        @{OS="darwin"; Arch="arm64"},
        @{OS="linux"; Arch="amd64"}
    )
    
    $Success = 0
    $Failed = 0
    
    foreach ($t in $Targets) {
        if (Build-Server -OS $t.OS -Arch $t.Arch) {
            $Success++
        } else {
            $Failed++
        }
    }
    
    Write-Host ""
    Write-Info "构建结果: $Success 成功, $Failed 失败"
}

# 打包浏览器扩展
function Package-Extension {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  打包浏览器扩展" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    
    $ZipName = "web-clipper-extension-v$ExtVersion.zip"
    $ZipPath = Join-Path $DistDir $ZipName
    
    if (Test-Path $ZipPath) { Remove-Item $ZipPath }
    
    Write-Info "打包扩展..."
    
    # 创建临时目录
    $TempDir = Join-Path $env:TEMP "owc-ext-$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    
    # 复制文件
    $Items = @(
        "manifest.json",
        "background.js",
        "content.js",
        "popup",
        "options",
        "services",
        "utils",
        "lib",
        "styles",
        "icons"
    )
    
    foreach ($Item in $Items) {
        $Source = Join-Path $ExtensionDir $Item
        if (Test-Path $Source) {
            Copy-Item -Recurse -Force $Source $TempDir
        }
    }
    
    # 创建 zip
    Compress-Archive -Path "$TempDir\*" -DestinationPath $ZipPath -Force
    
    # 清理临时目录
    Remove-Item -Recurse -Force $TempDir
    
    Write-Success "扩展打包完成: $ZipPath"
}

# 打包 Server
function Package-Servers {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  打包 Server" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    
    $Platforms = @(
        @{Dir="windows-amd64"; Ext=".zip"},
        @{Dir="darwin-amd64"; Ext=".tar.gz"},
        @{Dir="darwin-arm64"; Ext=".tar.gz"},
        @{Dir="linux-amd64"; Ext=".tar.gz"}
    )
    
    foreach ($p in $Platforms) {
        $SourceDir = Join-Path $BuildDir $p.Dir
        if (-not (Test-Path $SourceDir)) {
            Write-Warn "跳过 $($p.Dir) (未构建)"
            continue
        }
        
        $ArchiveName = "clipper-server-$($p.Dir)-v$Version$($p.Ext)"
        $ArchivePath = Join-Path $DistDir $ArchiveName
        
        Write-Info "打包 $($p.Dir)..."
        
        if ($p.Ext -eq ".zip") {
            Compress-Archive -Path "$SourceDir\*" -DestinationPath $ArchivePath -Force
        } else {
            # 使用 tar (Windows 10+ 内置)
            Push-Location $BuildDir
            tar -czf "../$ArchivePath" $p.Dir
            Pop-Location
        }
        
        Write-Success "打包完成: $ArchiveName"
    }
    
    # 生成校验和
    Write-Info "生成校验和..."
    $ChecksumFile = Join-Path $DistDir "checksums.sha256"
    $Checksums = @()
    Get-ChildItem -Path $DistDir -Filter "clipper-server-*" | ForEach-Object {
        $Hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash.ToLower()
        $Checksums += "$Hash  $($_.Name)"
    }
    $Checksums | Out-File -FilePath $ChecksumFile -Encoding UTF8
    Write-Success "校验和已生成"
}

# 显示帮助
function Show-Help {
    Write-Host ""
    Write-Host "Web Clipper - Windows 构建脚本" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "用法:"
    Write-Host "  .\build.ps1                    # 构建并打包所有组件"
    Write-Host "  .\build.ps1 -Target server     # 仅构建 server"
    Write-Host "  .\build.ps1 -Target ext        # 仅打包扩展"
    Write-Host "  .\build.ps1 -Target package    # 仅打包 (不构建)"
    Write-Host "  .\build.ps1 -Clean             # 清理构建产物"
    Write-Host "  .\build.ps1 -Version 1.0.0     # 指定版本号"
    Write-Host ""
    Write-Host "版本信息:"
    Write-Host "  Server:    v$Version"
    Write-Host "  Extension: v$ExtVersion"
    Write-Host ""
}

# 主函数
function Main {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Web Clipper Build" -ForegroundColor Cyan
    Write-Host "  Version: $Version" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    if ($Clean) {
        Clean-Build
        return
    }
    
    # 检查 Go
    try {
        $GoVersion = go version
        Write-Info "使用 $GoVersion"
    } catch {
        Write-Err "Go 未安装，请先安装 Go 1.21+"
        exit 1
    }
    
    switch ($Target.ToLower()) {
        "all" {
            Build-AllServers
            Package-Extension
            Package-Servers
        }
        "server" {
            Build-AllServers
        }
        "ext" {
            Package-Extension
        }
        "extension" {
            Package-Extension
        }
        "package" {
            Package-Extension
            Package-Servers
        }
        "help" {
            Show-Help
        }
        default {
            Write-Err "未知目标: $Target"
            Show-Help
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  构建完成!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    if (Test-Path $DistDir) {
        Write-Host "输出文件:" -ForegroundColor Cyan
        Get-ChildItem $DistDir | ForEach-Object {
            $Size = "{0:N2} MB" -f ($_.Length / 1MB)
            Write-Host "  $($_.Name) ($Size)"
        }
        Write-Host ""
    }
}

# 运行
Main
