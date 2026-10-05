# Installs a built setup.exe for the current user: closes the running app, installs silently,
# and points the Start Menu and desktop shortcuts at the installed app.
# Called by install.ps1; writes its progress to src-tauri/target/install.log.
param([Parameter(Mandatory)][string]$Installer)
$ErrorActionPreference = "Stop"
$log = Join-Path $PSScriptRoot "..\src-tauri\target\install.log"
Remove-Item $log -ErrorAction SilentlyContinue

function Say($text) { $text | Add-Content $log }

try {
    # The installer can't replace the app while it's running.
    foreach ($p in Get-Process "da-librarby" -ErrorAction SilentlyContinue) {
        $p.CloseMainWindow() | Out-Null
        if (-not $p.WaitForExit(5000)) { $p.Kill() }
    }

    $proc = Start-Process $Installer -ArgumentList "/S" -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "Installer exited with code $($proc.ExitCode)." }

    $exe = Join-Path $env:LOCALAPPDATA "Da Librarby\da-librarby.exe"
    if (-not (Test-Path $exe)) { throw "Installed app not found at $exe" }

    $shell = New-Object -ComObject WScript.Shell
    foreach ($path in @(
            (Join-Path ([Environment]::GetFolderPath("Desktop")) "Da Librarby.lnk"),
            (Join-Path ([Environment]::GetFolderPath("Programs")) "Da Librarby.lnk"))) {
        $lnk = $shell.CreateShortcut($path)
        $lnk.TargetPath = $exe
        $lnk.WorkingDirectory = Split-Path $exe
        $lnk.Save()
    }
    Say "OK $exe"
} catch {
    Say "FAILED $_"
}
