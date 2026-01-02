#
# Obsidian Web Clipper - Windows 安装脚本
#
# 功能:
#   - 安装 clipper-server 到用户目录
#   - 配置注册表实现开机自启动
#   - 创建默认配置文件
#
# 用法:
#   .\install-windows.ps1 [选项]
#
# 选项:
#   -NoAutoStart    不配置开机自启动
#   -Uninstall      卸载
#   -Status         查看服务状态
#   -Start          启动服务
#   -Stop           停止服务
#   -Help           显示帮助
#

param(
    [switch]$NoAutoStart,
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Start,
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Help
)

# ============================================
# 配置
# ============================================
$AppName = "clipper-server"
$DisplayName = "Obsidian Web Clipper"
$RegKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RegValueName = "ObsidianWebClipper"
$InstallDir = "$env:LOCALAPPDATA\ObsidianWebClipper"
$ConfigDir = "$env:APPDATA\ObsidianWebClipper"
$LogDir = "$ConfigDir\logs"

# ============================================
# 辅助函数
# ============================================
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

# ============================================
# 显示帮助
# ============================================
function Show-Help {
    Write-Host ""
    Write-Host "Obsidian Web Clipper - Windows 安装脚本" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "用法: .\install-windows.ps1 [选项]"
    Write-Host ""
    Write-Host "选项:"
    Write-Host "  -NoAutoStart    不配置开机自启动"
    Write-Host "  -Uninstall      卸载程序"
    Write-Host "  -Status         查看服务状态"
    Write-Host "  -Start          启动服务"
    Write-Host "  -Stop           停止服务"
    Write-Host "  -Restart        重启服务"
    Write-Host "  -Help           显示帮助"
    Write-Host ""
}

# ============================================
# 查找二进制文件
# ============================================
function Find-Binary {
    $ScriptDir = Split-Path -Parent $MyInvocation.ScriptName
    $SearchPaths = @(
        (Join-Path $ScriptDir "$AppName.exe"),
        (Join-Path $ScriptDir "..\$AppName.exe"),
        (Join-Path (Get-Location) "$AppName.exe"),
        (Join-Path $InstallDir "$AppName.exe")
    )
    
    foreach ($Path in $SearchPaths) {
        if (Test-Path $Path) {
            return (Resolve-Path $Path).Path
        }
    }
    
    return $null
}

# ============================================
# 创建配置文件
# ============================================
function Create-Config {
    $ConfigFile = Join-Path $ConfigDir "config.yaml"
    
    if (Test-Path $ConfigFile) {
        Write-Info "配置文件已存在: $ConfigFile"
        return
    }
    
    New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    
    $ConfigContent = @"
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
"@
    
    $ConfigContent | Out-File -FilePath $ConfigFile -Encoding UTF8
    
    Write-Success "已创建配置文件: $ConfigFile"
    Write-Warn "请编辑配置文件，设置你的 Obsidian 库路径和 token"
}

# ============================================
# 配置开机自启动
# ============================================
function Enable-AutoStart {
    $ExePath = Join-Path $InstallDir "$AppName.exe"
    $ConfigFile = Join-Path $ConfigDir "config.yaml"
    $Command = "`"$ExePath`" -config `"$ConfigFile`""
    
    # 写入注册表
    Set-ItemProperty -Path $RegKeyPath -Name $RegValueName -Value $Command
    
    Write-Success "已启用开机自启动"
}

function Disable-AutoStart {
    if (Get-ItemProperty -Path $RegKeyPath -Name $RegValueName -ErrorAction SilentlyContinue) {
        Remove-ItemProperty -Path $RegKeyPath -Name $RegValueName
        Write-Success "已禁用开机自启动"
    }
}

# ============================================
# 安装
# ============================================
function Install-App {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Obsidian Web Clipper 安装程序" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 查找二进制文件
    Write-Info "查找 $AppName.exe..."
    $BinaryPath = Find-Binary
    
    if (-not $BinaryPath) {
        Write-Err "找不到 $AppName.exe，请确保它在当前目录或脚本同目录下"
        exit 1
    }
    Write-Info "找到: $BinaryPath"
    
    # 停止现有进程
    Stop-App -Silent
    
    # 创建安装目录
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    
    # 复制文件
    Write-Info "安装到 $InstallDir..."
    Copy-Item -Force $BinaryPath (Join-Path $InstallDir "$AppName.exe")
    Write-Success "已安装: $InstallDir\$AppName.exe"
    
    # 创建配置
    Create-Config
    
    # 配置开机自启动
    if (-not $NoAutoStart) {
        Write-Info "配置开机自启动..."
        Enable-AutoStart
        
        # 启动服务
        Write-Info "启动服务..."
        Start-App -Silent
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  安装完成!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "配置文件: $ConfigDir\config.yaml"
    Write-Host "日志目录: $LogDir\"
    Write-Host ""
    Write-Host "常用命令:"
    Write-Host "  .\install-windows.ps1 -Status     查看状态"
    Write-Host "  .\install-windows.ps1 -Start      启动服务"
    Write-Host "  .\install-windows.ps1 -Stop       停止服务"
    Write-Host "  .\install-windows.ps1 -Restart    重启服务"
    Write-Host "  .\install-windows.ps1 -Uninstall  卸载"
    Write-Host ""
}

# ============================================
# 卸载
# ============================================
function Uninstall-App {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Obsidian Web Clipper 卸载程序" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 停止服务
    Stop-App -Silent
    
    # 移除开机自启动
    Write-Info "移除开机自启动..."
    Disable-AutoStart
    
    # 删除程序文件
    if (Test-Path $InstallDir) {
        Write-Info "删除程序文件..."
        Remove-Item -Recurse -Force $InstallDir
        Write-Success "已删除: $InstallDir"
    }
    
    Write-Host ""
    Write-Host "卸载完成!" -ForegroundColor Green
    Write-Host ""
    Write-Host "以下文件已保留 (如需删除请手动操作):"
    Write-Host "  配置文件: $ConfigDir\"
    Write-Host ""
}

# ============================================
# 服务控制
# ============================================
function Get-AppStatus {
    Write-Host ""
    $Process = Get-Process -Name $AppName -ErrorAction SilentlyContinue
    if ($Process) {
        Write-Success "服务运行中 (PID: $($Process.Id))"
    } else {
        Write-Warn "服务未运行"
    }
    
    # 检查开机自启动
    $RegValue = Get-ItemProperty -Path $RegKeyPath -Name $RegValueName -ErrorAction SilentlyContinue
    if ($RegValue) {
        Write-Info "开机自启动: 已启用"
    } else {
        Write-Info "开机自启动: 未启用"
    }
    Write-Host ""
}

function Start-App {
    param([switch]$Silent)
    
    $ExePath = Join-Path $InstallDir "$AppName.exe"
    $ConfigFile = Join-Path $ConfigDir "config.yaml"
    
    if (-not (Test-Path $ExePath)) {
        if (-not $Silent) { Write-Err "程序未安装，请先运行安装" }
        return
    }
    
    # 检查是否已运行
    $Process = Get-Process -Name $AppName -ErrorAction SilentlyContinue
    if ($Process) {
        if (-not $Silent) { Write-Warn "服务已在运行" }
        return
    }
    
    if (-not $Silent) { Write-Info "启动服务..." }
    
    # 启动进程 (隐藏窗口)
    Start-Process -FilePath $ExePath -ArgumentList "-config", $ConfigFile -WindowStyle Hidden
    
    Start-Sleep -Seconds 1
    
    $Process = Get-Process -Name $AppName -ErrorAction SilentlyContinue
    if ($Process) {
        if (-not $Silent) { Write-Success "服务已启动 (PID: $($Process.Id))" }
    } else {
        if (-not $Silent) { Write-Warn "服务可能未正常启动，请检查配置文件" }
    }
}

function Stop-App {
    param([switch]$Silent)
    
    $Process = Get-Process -Name $AppName -ErrorAction SilentlyContinue
    if ($Process) {
        if (-not $Silent) { Write-Info "停止服务..." }
        Stop-Process -Name $AppName -Force
        if (-not $Silent) { Write-Success "服务已停止" }
    } else {
        if (-not $Silent) { Write-Info "服务未运行" }
    }
}

function Restart-App {
    Stop-App
    Start-Sleep -Seconds 1
    Start-App
}

# ============================================
# 主函数
# ============================================
function Main {
    if ($Help) {
        Show-Help
        return
    }
    
    if ($Uninstall) {
        Uninstall-App
        return
    }
    
    if ($Status) {
        Get-AppStatus
        return
    }
    
    if ($Start) {
        Start-App
        return
    }
    
    if ($Stop) {
        Stop-App
        return
    }
    
    if ($Restart) {
        Restart-App
        return
    }
    
    # 默认安装
    Install-App
}

Main
