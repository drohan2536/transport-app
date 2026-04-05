# ═══════════════════════════════════════════════════════════
#  Transport App — IIS Deployment Script
#  Run this in PowerShell to create a ready-to-host folder
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DeployDir = Join-Path $ProjectDir "iis-deploy"

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Transport App — IIS Deploy Builder     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build frontend
Write-Host "[1/5] Building frontend..." -ForegroundColor Yellow
Set-Location $ProjectDir
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Build failed!" -ForegroundColor Red; exit 1 }
Write-Host "  ✅ Frontend built" -ForegroundColor Green

# Step 2: Clean old deploy folder
Write-Host "[2/5] Preparing deploy folder..." -ForegroundColor Yellow
if (Test-Path $DeployDir) { Remove-Item $DeployDir -Recurse -Force }
New-Item -ItemType Directory -Path $DeployDir | Out-Null
Write-Host "  ✅ Deploy folder ready: $DeployDir" -ForegroundColor Green

# Step 3: Copy files
Write-Host "[3/5] Copying files..." -ForegroundColor Yellow

# Copy server
Copy-Item -Path "$ProjectDir\server" -Destination "$DeployDir\server" -Recurse
# Remove SQLite DB from deploy (fresh start) but keep the data folder
$deployDataDir = Join-Path $DeployDir "data"
New-Item -ItemType Directory -Path $deployDataDir -Force | Out-Null
# Copy existing DB if present
$srcDb = Join-Path $ProjectDir "data\transport.db"
if (Test-Path $srcDb) { Copy-Item $srcDb -Destination "$deployDataDir\transport.db" }

# Copy dist (built frontend)
Copy-Item -Path "$ProjectDir\dist" -Destination "$DeployDir\dist" -Recurse

# Copy node_modules
Copy-Item -Path "$ProjectDir\node_modules" -Destination "$DeployDir\node_modules" -Recurse

# Copy config files
Copy-Item -Path "$ProjectDir\package.json" -Destination "$DeployDir\package.json"
Copy-Item -Path "$ProjectDir\web.config" -Destination "$DeployDir\web.config"

# Create logs folder (for IIS stdout logging)
New-Item -ItemType Directory -Path "$DeployDir\logs" -Force | Out-Null

# Create uploads folder
New-Item -ItemType Directory -Path "$DeployDir\server\uploads" -Force | Out-Null

Write-Host "  ✅ All files copied" -ForegroundColor Green

# Step 4: Create IIS setup script
Write-Host "[4/5] Creating IIS setup helper..." -ForegroundColor Yellow

$iisSetupScript = @'
# ═══════════════════════════════════════════════════
#  RUN THIS AS ADMINISTRATOR to create the IIS site
# ═══════════════════════════════════════════════════

param(
    [string]$SiteName = "TransportApp",
    [int]$Port = 8080
)

$DeployPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "Setting up IIS site: $SiteName on port $Port" -ForegroundColor Cyan
Write-Host "Path: $DeployPath" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run this script as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell → Run as Administrator" -ForegroundColor Yellow
    pause
    exit 1
}

# Check if IIS is installed
if (-not (Test-Path "C:\Windows\System32\inetsrv\appcmd.exe")) {
    Write-Host "IIS is not installed. Installing now..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-ManagementConsole, IIS-HttpRedirect -All -NoRestart
    Write-Host "  ✅ IIS installed" -ForegroundColor Green
}

# Check HttpPlatformHandler
$hph = Get-WebGlobalModule -Name "httpPlatformHandler" -ErrorAction SilentlyContinue
if (-not $hph) {
    Write-Host ""
    Write-Host "⚠️  HttpPlatformHandler not found!" -ForegroundColor Yellow
    Write-Host "    Download from: https://www.iis.net/downloads/microsoft/httpplatformhandler" -ForegroundColor Yellow
    Write-Host "    Install it, then run this script again." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Set folder permissions
Write-Host "Setting permissions..." -ForegroundColor Yellow
icacls $DeployPath /grant "IIS_IUSRS:(OI)(CI)F" /T /Q
icacls $DeployPath /grant "IUSR:(OI)(CI)F" /T /Q
Write-Host "  ✅ Permissions set" -ForegroundColor Green

# Remove existing site if present
$existing = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing site '$SiteName'..." -ForegroundColor Yellow
    Remove-Website -Name $SiteName
}

# Remove existing app pool if present
$existingPool = Get-IISAppPool -Name $SiteName -ErrorAction SilentlyContinue
if ($existingPool) {
    Remove-WebAppPool -Name $SiteName
}

# Create app pool
Write-Host "Creating app pool..." -ForegroundColor Yellow
$pool = New-WebAppPool -Name $SiteName
$pool.processModel.idleTimeout = [TimeSpan]::FromMinutes(0)  # Never idle timeout
$pool | Set-Item
Write-Host "  ✅ App pool created (no idle timeout)" -ForegroundColor Green

# Create website
Write-Host "Creating website..." -ForegroundColor Yellow
New-Website -Name $SiteName -Port $Port -PhysicalPath $DeployPath -ApplicationPool $SiteName
Write-Host "  ✅ Website created" -ForegroundColor Green

# Start the site
Start-Website -Name $SiteName

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          DEPLOYMENT COMPLETE! ✅          ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Open: http://localhost:$Port              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Logs folder: $DeployPath\logs" -ForegroundColor Gray
Write-Host ""
pause
'@

Set-Content -Path "$DeployDir\setup-iis.ps1" -Value $iisSetupScript -Encoding UTF8
Write-Host "  ✅ IIS setup script created" -ForegroundColor Green

# Step 5: Create README
Write-Host "[5/5] Creating README..." -ForegroundColor Yellow

$readme = @"
# Transport App — IIS Deployment Package
==========================================

## How to Host on IIS

1. Copy this entire 'iis-deploy' folder to your server
   (e.g., C:\inetpub\TransportApp)

2. Right-click 'setup-iis.ps1' → Run with PowerShell (as Administrator)

3. Open http://localhost:8080

That's it!

## Prerequisites
- Windows 10/11 or Windows Server 2016+
- Node.js installed (https://nodejs.org)
- HttpPlatformHandler for IIS
  Download: https://www.iis.net/downloads/microsoft/httpplatformhandler

## Manual IIS Setup (if script doesn't work)

1. Open IIS Manager
2. Right-click 'Sites' → Add Website
   - Site name: TransportApp
   - Physical path: this folder
   - Port: 8080
3. Set folder permissions:
   icacls "C:\path\to\this\folder" /grant "IIS_IUSRS:(OI)(CI)F" /T

## Troubleshooting
- Check logs in the 'logs' folder
- Check server\server_errors.log
- Make sure Node.js is in PATH
- Make sure HttpPlatformHandler is installed
"@

Set-Content -Path "$DeployDir\README.txt" -Value $readme -Encoding UTF8
Write-Host "  ✅ README created" -ForegroundColor Green

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║        DEPLOY PACKAGE READY! ✅           ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Folder: iis-deploy                      ║" -ForegroundColor Green
Write-Host "║                                          ║" -ForegroundColor Green
Write-Host "║  To host on IIS:                         ║" -ForegroundColor Green
Write-Host "║  1. Copy iis-deploy to your server       ║" -ForegroundColor Green
Write-Host "║  2. Run setup-iis.ps1 as Admin           ║" -ForegroundColor Green
Write-Host "║  3. Open http://localhost:8080            ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
