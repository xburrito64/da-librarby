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

# The install step is started through Windows' process service (WMI) rather than as a child
# of this shell. When this script runs inside a sandboxed/packaged terminal (like the Claude
# desktop app), files its children write to AppData are silently redirected to a private
# folder; starting the installer this way puts the app where Windows and its shortcuts expect it.
Write-Host "Installing $($installer.Name)..."
$step = Join-Path $PSScriptRoot "install-app.ps1"
$command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$step`" -Installer `"$($installer.FullName)`""
$started = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $command }
if ($started.ReturnValue -ne 0) { throw "Could not start the install step (code $($started.ReturnValue))." }
while (Get-Process -Id $started.ProcessId -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 300 }

$result = Get-Content "src-tauri\target\install.log" -Raw
Write-Host $result.Trim()
if ($result.Trim() -notmatch "^OK") { throw "Install failed." }

if ($Launch) {
    $exe = Join-Path $env:LOCALAPPDATA "Da Librarby\da-librarby.exe"
    Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "`"$exe`"" } | Out-Null
}
