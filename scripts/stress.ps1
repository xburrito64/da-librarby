# Runs the stress test (src/perf) in the installed app and makes the report.
# Closes the app first; it closes itself when the test is done (about 15 minutes for everything).
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/stress.ps1 [-Label baseline] [-Big 1500]
#           [-Themes velvet,hollow] [-Only idle,grid] [-Out .debug\perf]
param(
    [string]$Label = "",
    [int]$Big = 0,
    [string]$Themes = "",
    [string]$Only = "",
    [string]$Out = ""
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $Out) { $Out = Join-Path $root ".debug\perf" }
New-Item -ItemType Directory -Force $Out | Out-Null
$Out = (Resolve-Path $Out).Path

$exe = Join-Path $env:LOCALAPPDATA "Da Librarby\da-librarby.exe"
if (-not (Test-Path $exe)) { throw "The app isn't installed (run scripts/install.ps1)." }

Get-Process da-librarby -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$arguments = @("--stress", "`"--stress-out=$Out`"")
if ($Label) { $arguments += "--stress-label=$Label" }
if ($Big -gt 0) { $arguments += "--stress-big=$Big" }
if ($Themes) { $arguments += "--stress-themes=$Themes" }
if ($Only) { $arguments += "--stress-only=$Only" }

# Started through Windows' process service (WMI), like a normal start: the app then uses its real
# library, not the private copy a sandboxed terminal (like the Claude desktop app) would give it.
$before = @(Get-ChildItem $Out -Filter "run-*.json" -ErrorAction SilentlyContinue).Count
$command = "`"$exe`" " + ($arguments -join " ")
$started = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $command }
if ($started.ReturnValue -ne 0) { throw "Could not start the app (code $($started.ReturnValue))." }
Write-Host "Stress test running (the app closes itself when it's done)..."

$deadline = (Get-Date).AddMinutes(45)
while (Get-Process -Id $started.ProcessId -ErrorAction SilentlyContinue) {
    if ((Get-Date) -gt $deadline) { throw "The stress test didn't finish within 45 minutes." }
    Start-Sleep -Seconds 5
}
if (@(Get-ChildItem $Out -Filter "run-*.json").Count -le $before) { throw "The app closed without saving results." }

node (Join-Path $root "scripts\perf-report.mjs") $Out

# The app back as usual.
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "`"$exe`"" } | Out-Null
