# VowVault PostgreSQL Backup (PowerShell)
# Run from local-server/ directory: .\scripts\backup.ps1

param(
    [int]$KeepLast = 10
)

# Load DATABASE_URL from .env
$envFile = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), 'Process')
        }
    }
}

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    Write-Error "DATABASE_URL is not set in .env"
    exit 1
}

# Create backups directory
$backupsDir = Join-Path $PSScriptRoot ".." "backups"
if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

# Timestamped filename
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$filename = "vowvault_$timestamp.sql"
$filepath = Join-Path $backupsDir $filename

Write-Host "`n📦 VowVault Database Backup" -ForegroundColor Cyan
Write-Host "   Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "   Output:    $filepath`n"

try {
    pg_dump "$databaseUrl" --file="$filepath" --format=plain --no-owner --no-acl
    
    $size = (Get-Item $filepath).Length / 1MB
    Write-Host "`n✅ Backup complete: $filename ($([math]::Round($size, 2)) MB)" -ForegroundColor Green

    # Keep only last N backups
    $files = Get-ChildItem $backupsDir -Filter "vowvault_*.sql" | Sort-Object Name -Descending
    if ($files.Count -gt $KeepLast) {
        $toDelete = $files | Select-Object -Skip $KeepLast
        foreach ($f in $toDelete) {
            Remove-Item $f.FullName
            Write-Host "   Removed old backup: $($f.Name)" -ForegroundColor Yellow
        }
    }

    Write-Host "`n📁 Total backups: $([Math]::Min($files.Count, $KeepLast))`n" -ForegroundColor Cyan
}
catch {
    Write-Error "`n❌ Backup FAILED: $_"
    Write-Host "Make sure pg_dump is in your PATH (comes with PostgreSQL installation)." -ForegroundColor Red
    exit 1
}
