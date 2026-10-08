param([Parameter(Mandatory=$true)][string]$BuildDirectory,[Parameter(Mandatory=$true)][string]$LocalStagingConfig,[ValidateSet('staging','production')][string]$Environment='staging')
$ErrorActionPreference='Stop'
$installerSource=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'Setup.cs')).Path
$build=(Resolve-Path -LiteralPath $BuildDirectory).Path
$out=Join-Path $build 'installer'
if(Test-Path -LiteralPath $out){throw 'Choose a fresh build: installer artifact already exists.'}
$config=Get-Content -LiteralPath $LocalStagingConfig -Raw | ConvertFrom-Json
$approved=if($Environment -eq 'production'){'https://nuruzzaman.com.bd'}else{'https://localhost:13443'}
foreach($origin in @($config.api_origin,$config.website_origin)){if($origin.TrimEnd('/') -cne $approved){throw 'Configuration must match the explicitly selected environment.'}}
if($Environment -eq 'production' -and $config.allow_pilot_usage){throw 'Pilot usage must be disabled in production.'}
[xml]$key=$config.public_key_xml
if($key.RSAKeyValue.ChildNodes.Count -ne 2 -or !$key.RSAKeyValue.Modulus -or !$key.RSAKeyValue.Exponent){throw 'Public-only signing key required'}
$payload=Join-Path $out 'payload'
New-Item -ItemType Directory -Path $payload -Force | Out-Null
Copy-Item "$build/NBOnlineWallet.bundle/*" $payload -Recurse
[ordered]@{api_origin=$config.api_origin;website_origin=$config.website_origin;offline_allowance=[int]$config.offline_allowance;allow_pilot_usage=[bool]$config.allow_pilot_usage;signing_key_id=$config.signing_key_id;public_key_xml=$config.public_key_xml} | ConvertTo-Json | Set-Content "$payload/Contents/Win64/wallet.config.json" -Encoding UTF8
[xml]$manifest=Get-Content "$payload/PackageContents.xml"
if($manifest.ApplicationPackage.AppVersion -ne '0.6.3'){throw 'Installer and bundle must both be 0.6.3'}
$hashes=Get-ChildItem $payload -Recurse -File | Sort-Object FullName | ForEach-Object { (Get-FileHash $_.FullName -Algorithm SHA256).Hash + '  ' + $_.FullName.Substring($payload.Length+1).Replace('\','/') }
$hashes | Set-Content "$out/payload.sha256" -Encoding UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($payload,"$out/payload.zip")
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$exe=Join-Path $out 'NB_Online_Wallet_AutoCAD2024_v0.6.3_Setup.exe'
& $csc /nologo /target:winexe /platform:x64 /optimize+ /r:System.dll /r:System.Core.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Xml.dll /r:System.Web.Extensions.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll "/resource:$out/payload.zip,payload.zip" "/resource:$out/payload.sha256,payload.sha256" "/out:$exe" $installerSource
if($LASTEXITCODE -ne 0){throw 'Installer compiler failed'}
$p=Start-Process -FilePath $exe -ArgumentList '--verify-package','--quiet' -PassThru -Wait -WindowStyle Hidden
if($p.ExitCode -ne 0){throw 'Embedded installer payload verification failed'}
Get-FileHash $exe -Algorithm SHA256
