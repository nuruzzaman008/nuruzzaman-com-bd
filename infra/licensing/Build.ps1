param(
 [Parameter(Mandatory=$true)][string]$VendorSource,
 [string]$AutoCADRoot='C:\Program Files\Autodesk\AutoCAD 2024',
 [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference='Stop'
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$worker=Join-Path $OutputDirectory 'NBOnlineWorker.exe'
$connector=Join-Path $OutputDirectory 'NBOnlineConnector.dll'
if((Test-Path -LiteralPath $worker) -or (Test-Path -LiteralPath $connector)){throw 'Choose a fresh output directory; existing builds will not be overwritten.'}
& $csc /nologo /target:exe /main:NBEngineeringTools.VendorKeyGenerator.OnlineWorker "/out:$worker" /r:System.Web.Extensions.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:System.Security.dll $VendorSource "$PSScriptRoot\OnlineWorker.cs"
if($LASTEXITCODE -ne 0){throw 'Worker build failed'}
& $csc /nologo /target:library "/out:$connector" /r:System.Web.Extensions.dll /r:System.Windows.Forms.dll /r:System.Security.dll "/r:$AutoCADRoot\AcMgd.dll" "/r:$AutoCADRoot\AcCoreMgd.dll" "/r:$AutoCADRoot\AcDbMgd.dll" "$PSScriptRoot\AutoCadConnector.cs"
if($LASTEXITCODE -ne 0){throw 'Connector build failed'}
$bundle=Join-Path $OutputDirectory 'NBOnlineConnector.bundle'
New-Item -ItemType Directory -Path "$bundle\Contents\Win64" -Force | Out-Null
Copy-Item -LiteralPath $connector -Destination "$bundle\Contents\Win64\NBOnlineConnector.dll"
Copy-Item -LiteralPath "$PSScriptRoot\PackageContents.xml" -Destination "$bundle\PackageContents.xml"
Compress-Archive -LiteralPath $bundle -DestinationPath (Join-Path $OutputDirectory 'NBOnlineConnector-AutoCAD2024.zip')
Write-Output 'Compiled. Worker is vendor-only. Connector requires AutoCAD 2024 and the installed NB security runtime.'
