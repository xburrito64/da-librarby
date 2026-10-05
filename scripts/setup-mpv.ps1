# Downloads libmpv-2.dll (shinchiro's Windows build, listed on mpv.io) into src-tauri/lib.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/setup-mpv.ps1 [-Release 20261005]
param(
    # Pinned to the build the app was tested with. Pass "latest" to take the newest.
    [string]$Release = "20261005"
)
$ErrorActionPreference = "Stop"

$repo = "shinchiro/mpv-winbuild-cmake"
$api = if ($Release -eq "latest") { "https://api.github.com/repos/$repo/releases/latest" }
       else { "https://api.github.com/repos/$repo/releases/tags/$Release" }
$asset = (Invoke-RestMethod $api).assets |
    Where-Object { $_.name -match '^mpv-dev-x86_64-\d{8}-git-.*\.7z$' } |
    Select-Object -First 1
if (-not $asset) { throw "No mpv-dev-x86_64 build found in release '$Release'." }

$libDir = Join-Path $PSScriptRoot "..\src-tauri\lib"
$tmp = Join-Path ([IO.Path]::GetTempPath()) "mpv-dev-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force $libDir, $tmp | Out-Null
try {
    $archive = Join-Path $tmp $asset.name
    Write-Host "Downloading $($asset.name) ..."
    Invoke-WebRequest $asset.browser_download_url -OutFile $archive
    # Windows' built-in tar (libarchive) can read .7z archives.
    & "$env:SystemRoot\System32\tar.exe" -xf $archive -C $tmp libmpv-2.dll
    if ($LASTEXITCODE -ne 0) { throw "Extracting $archive failed." }
    Copy-Item (Join-Path $tmp "libmpv-2.dll") $libDir -Force
    Write-Host "Installed libmpv-2.dll into $((Resolve-Path $libDir).Path)"
} finally {
    Remove-Item -Recurse -Force $tmp
}
