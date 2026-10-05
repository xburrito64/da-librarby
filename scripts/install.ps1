# Builds the release app and (re)installs it for the current user, without prompts.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/install.ps1 [-Launch]
param([switch]$Launch)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not (Test-Path "src-tauri\lib\libmpv-2.dll")) {
    & (Join-Path $PSScriptRoot "setup-mpv.ps1")
}

Write-Host "Building release..."
npm run tauri build -- --bundles nsis
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

$installer = Get-ChildItem "src-tauri\target\release\bundle\nsis\*-setup.exe" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw "No installer found after build." }

# The installer can't replace the app while it's running.
$running = Get-Process "da-librarby" -ErrorAction SilentlyContinue
foreach ($p in $running) {
    $p.CloseMainWindow() | Out-Null
    if (-not $p.WaitForExit(5000)) { $p.Kill() }
}

Write-Host "Installing $($installer.Name)..."
$proc = Start-Process $installer.FullName -ArgumentList "/S" -Wait -PassThru
if ($proc.ExitCode -ne 0) { throw "Installer exited with code $($proc.ExitCode)." }

$exe = Join-Path $env:LOCALAPPDATA "Da Librarby\da-librarby.exe"
if (-not (Test-Path $exe)) { throw "Installed app not found at $exe" }

# Silent installs don't always create shortcuts; make sure both exist.
$shell = New-Object -ComObject WScript.Shell
$shortcuts = @(
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Da Librarby.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Programs")) "Da Librarby.lnk")
)
foreach ($path in $shortcuts) {
    if (-not (Test-Path $path)) {
        $lnk = $shell.CreateShortcut($path)
        $lnk.TargetPath = $exe
        $lnk.WorkingDirectory = Split-Path $exe
        $lnk.Save()
    }
}

Write-Host "Installed: $exe"
if ($Launch) { Start-Process $exe }
