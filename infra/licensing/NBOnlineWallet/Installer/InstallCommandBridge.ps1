param(
 [Parameter(Mandatory=$true)][string]$AddonBundle,
 [Parameter(Mandatory=$true)][string]$BridgeDll,
 [Parameter(Mandatory=$true)][string]$BridgeSha256,
 [Parameter(Mandatory=$true)][string]$ExpectedWalletSha256,
 [Parameter(Mandatory=$true)][string]$BackupDirectory
)
$ErrorActionPreference='Stop'
if(Get-Process acad -ErrorAction SilentlyContinue){throw 'Close AutoCAD before cutover.'}
$plugins=Join-Path $env:APPDATA 'Autodesk/ApplicationPlugins'
$tools=Join-Path $plugins 'NBEngineeringToolsPhase2.bundle'
$online=Join-Path $plugins 'NBOnlineWallet.bundle'
$wallet=Join-Path $env:LOCALAPPDATA 'NBEngineeringTools/ClientSecurity/nb_wallet_v2.bin'
foreach($path in @($plugins,$tools,$online)) {
 if(!(Test-Path -LiteralPath $path -PathType Container)){throw 'Expected installed bundle missing.'}
 if((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse point installation is not supported.'}
}
$oldDll=Join-Path $tools 'Contents/Win64/NBCommercialSecurity.dll'
if((Get-FileHash -LiteralPath $oldDll).Hash -ne 'D6D23A23F277E195BDA57169D598E21E163703875A8F0E367A9AB8F5D76FA691'){throw 'Installed legacy runtime differs from audited version.'}
if((Get-FileHash -LiteralPath $wallet).Hash -ne $ExpectedWalletSha256){throw 'Legacy wallet changed; re-audit before cutover.'}
if((Get-FileHash -LiteralPath $BridgeDll).Hash -ne $BridgeSha256){throw 'Candidate bridge checksum mismatch.'}
foreach($dll in @('NBOnlineWallet.dll','NBOnlineWallet.Core.dll')) {
 $source=Join-Path $AddonBundle "Contents/Win64/$dll"
 if([Reflection.AssemblyName]::GetAssemblyName($source).Version.ToString() -ne '0.6.4.0'){throw 'Candidate addon version mismatch.'}
}
[xml]$manifest=Get-Content -LiteralPath (Join-Path $AddonBundle 'PackageContents.xml') -Raw
if($manifest.ApplicationPackage.AppVersion -ne '0.6.4'){throw 'Manifest version mismatch.'}
if(Test-Path -LiteralPath $BackupDirectory){throw 'Use a new backup directory.'}
New-Item -ItemType Directory -Path $BackupDirectory | Out-Null
Copy-Item -LiteralPath $tools -Destination $BackupDirectory -Recurse
Copy-Item -LiteralPath $online -Destination $BackupDirectory -Recurse
Copy-Item -LiteralPath (Split-Path $wallet) -Destination $BackupDirectory -Recurse
$journal=Join-Path $env:LOCALAPPDATA 'NBOnlineWallet'
if(Test-Path -LiteralPath $journal){Copy-Item -LiteralPath $journal -Destination (Join-Path $BackupDirectory 'NBOnlineWallet-user-data') -Recurse}
if(Test-Path 'HKCU:/Software/NBOnlineWallet') {
 & reg.exe export 'HKCU\Software\NBOnlineWallet' (Join-Path $BackupDirectory 'journal-checkpoints.reg') /y | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Journal checkpoint backup failed.'}
}
if(Get-Process acad -ErrorAction SilentlyContinue){throw 'AutoCAD started during backup; no runtime files changed.'}
$pairs=@(
 @($BridgeDll,$oldDll),
 @((Join-Path $AddonBundle 'Contents/Win64/NBOnlineWallet.dll'),(Join-Path $online 'Contents/Win64/NBOnlineWallet.dll')),
 @((Join-Path $AddonBundle 'Contents/Win64/NBOnlineWallet.Core.dll'),(Join-Path $online 'Contents/Win64/NBOnlineWallet.Core.dll')),
 @((Join-Path $AddonBundle 'PackageContents.xml'),(Join-Path $online 'PackageContents.xml'))
)
$configPath=Join-Path $online 'Contents/Win64/wallet.config.json'
try {
 foreach($pair in $pairs){Copy-Item -LiteralPath $pair[0] -Destination $pair[1] -Force}
 $config=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
 $config | Add-Member -NotePropertyName online_commands_only -NotePropertyValue $true -Force
 $config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding utf8
 foreach($pair in $pairs){if((Get-FileHash -LiteralPath $pair[0]).Hash -ne (Get-FileHash -LiteralPath $pair[1]).Hash){throw 'Installed checksum mismatch.'}}
 if((Get-FileHash -LiteralPath $wallet).Hash -ne $ExpectedWalletSha256){throw 'Unexpected wallet modification detected.'}
 [pscustomobject]@{InstalledAtUtc=[DateTime]::UtcNow.ToString('o');Version='0.6.4';BridgeSHA256=$BridgeSha256;LegacyWalletSHA256=$ExpectedWalletSha256;BackupDirectory=$BackupDirectory;MigrationApplied=$false;RequiresAutoCADVerification=$true} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $BackupDirectory 'cutover-receipt.json')
 Write-Output "Runtime installed; no tokens credited. Backup: $BackupDirectory"
} catch {
 foreach($pair in $pairs){$relative=$pair[1].Substring($plugins.Length+1); Copy-Item -LiteralPath (Join-Path $BackupDirectory $relative) -Destination $pair[1] -Force}
 Copy-Item -LiteralPath (Join-Path $BackupDirectory 'NBOnlineWallet.bundle/Contents/Win64/wallet.config.json') -Destination $configPath -Force
 throw
}
