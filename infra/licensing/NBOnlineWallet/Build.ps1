param(
    [string]$AutoCADRoot = 'C:\Program Files\Autodesk\AutoCAD 2024',
    [string]$OutputDirectory = (Join-Path $PSScriptRoot ('artifacts\build-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Choose a fresh output directory; existing builds are preserved.' }
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$csc = Join-Path $framework 'csc.exe'
foreach ($dll in @('AcMgd.dll','AcCoreMgd.dll','AcDbMgd.dll','AdWindows.dll')) {
    if (!(Test-Path -LiteralPath (Join-Path $AutoCADRoot $dll))) { throw "Required AutoCAD 2024 reference missing: $dll" }
}
$bundle = Join-Path $OutputDirectory 'NBOnlineWallet.bundle'
$contents = Join-Path $bundle 'Contents\Win64'
New-Item -ItemType Directory -Path $contents -Force | Out-Null
$core = @(Get-ChildItem -LiteralPath "$PSScriptRoot\Core" -Filter '*.cs' | ForEach-Object FullName)
$common = @('/nologo','/optimize+','/platform:x64','/r:System.dll','/r:System.Core.dll','/r:System.Security.dll','/r:System.Web.Extensions.dll')
$icons = @('account','wallet','sync','history') | ForEach-Object { "/resource:$PSScriptRoot\Ribbon\$_.bmp,NBOnlineWallet.Ribbon.$_.bmp" }
$addonSources = @(Get-ChildItem -LiteralPath "$PSScriptRoot\AutoCAD" -Filter '*.cs' | ForEach-Object FullName)
& $csc @common /target:library "/out:$contents\NBOnlineWallet.Core.dll" @core
if ($LASTEXITCODE -ne 0) { throw 'Core build failed' }
& $csc @common @icons /target:library "/out:$contents\NBOnlineWallet.dll" "/r:$contents\NBOnlineWallet.Core.dll" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Xaml.dll "/r:$framework\WPF\WindowsBase.dll" "/r:$framework\WPF\PresentationCore.dll" "/r:$framework\WPF\PresentationFramework.dll" "/r:$AutoCADRoot\AcMgd.dll" "/r:$AutoCADRoot\AcCoreMgd.dll" "/r:$AutoCADRoot\AcDbMgd.dll" "/r:$AutoCADRoot\AdWindows.dll" @addonSources
if ($LASTEXITCODE -ne 0) { throw 'AutoCAD addon build failed' }
Copy-Item -LiteralPath "$PSScriptRoot\PackageContents.xml" -Destination $bundle
Copy-Item -LiteralPath "$PSScriptRoot\wallet.config.example.json" -Destination $contents
& $csc @common /target:exe "/out:$OutputDirectory\NBOnlineWallet.Tests.exe" "/r:$contents\NBOnlineWallet.Core.dll" "$PSScriptRoot\Tests\Program.cs"
if ($LASTEXITCODE -ne 0) { throw 'Test build failed' }
Copy-Item -LiteralPath "$contents\NBOnlineWallet.Core.dll" -Destination $OutputDirectory
$results = & "$OutputDirectory\NBOnlineWallet.Tests.exe"
$results | Set-Content -LiteralPath "$OutputDirectory\client-test-results.txt" -Encoding UTF8
$results | Write-Output
if ($LASTEXITCODE -ne 0) { throw 'Wallet tests failed' }
Compress-Archive -LiteralPath $bundle -DestinationPath "$OutputDirectory\NBOnlineWallet-AutoCAD2024.zip"
Write-Output "Build and tests complete: $OutputDirectory"

