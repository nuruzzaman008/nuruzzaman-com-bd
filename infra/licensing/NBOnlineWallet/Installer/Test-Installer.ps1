param([Parameter(Mandatory=$true)][string]$InstallerDirectory)
$ErrorActionPreference='Stop'
if ($PSVersionTable.PSEdition -eq 'Core') { throw 'Run this .NET Framework installer test using Windows PowerShell: powershell.exe -NoProfile -File Test-Installer.ps1 -InstallerDirectory <path>' }
$dir=(Resolve-Path $InstallerDirectory).Path
$assembly=[Reflection.Assembly]::LoadFile((Join-Path $dir 'NB_Online_Wallet_AutoCAD2024_v0.6.4_Setup.exe'))
$type=$assembly.GetType('NBOnlineWallet.Setup.Program')
$flags=[Reflection.BindingFlags]'NonPublic,Static'
$results=[Collections.Generic.List[object]]::new()
function Check([string]$name,[scriptblock]$action,[bool]$reject=$false){$failed=$false;try{& $action}catch{$failed=$true;if(!$reject){Write-Output $_.Exception.ToString()}};if($failed -ne $reject){throw "FAIL $name"};$results.Add([pscustomobject]@{test=$name;result='PASS'})}
$root=Join-Path $dir 'disposable-tests'
if(Test-Path $root){throw 'Preserve earlier tests: fresh installer directory required'}
New-Item -ItemType Directory $root | Out-Null
$safe=$type.GetMethod('Safe',$flags)
Check 'accept relative path with trailing root separator' { $null=$safe.Invoke($null,@(($root+'\'),'Contents/file.dll')) }
Check 'reject parent traversal' { $null=$safe.Invoke($null,@($root,'../outside')) } $true
Check 'reject absolute path' { $null=$safe.Invoke($null,@($root,'C:/outside')) } $true
Check 'reject alternate data stream' { $null=$safe.Invoke($null,@($root,'file:stream')) } $true
$null=$type.GetMethod('ReadHashes',$flags).Invoke($null,@())
$extract=$type.GetMethod('Extract',$flags)
$testPayload=Join-Path $root 'payload'
Check 'extract and verify embedded payload' { $null=$extract.Invoke($null,@([string]$testPayload)) }
$validate=$type.GetMethod('ValidateConfig',$flags)
$config=Join-Path $testPayload 'Contents/Win64/wallet.config.json'
Check 'accept approved public config' { $null=$validate.Invoke($null,@([string]$config)) }
$c=Get-Content $config -Raw | ConvertFrom-Json
$c.api_origin='https://example.invalid'
$c | ConvertTo-Json | Set-Content (Join-Path $root 'invalid-config.json')
Check 'reject unapproved origin' { $null=$validate.Invoke($null,@([string](Join-Path $root 'invalid-config.json'))) } $true
$c=Get-Content $config -Raw | ConvertFrom-Json
$c.api_origin='https://localhost:13443'; $c.website_origin='https://nuruzzaman.com.bd'
$c | ConvertTo-Json | Set-Content (Join-Path $root 'mixed-config.json')
Check 'reject mixed environments' { $null=$validate.Invoke($null,@([string](Join-Path $root 'mixed-config.json'))) } $true
$c=Get-Content $config -Raw | ConvertFrom-Json
$c.api_origin='https://nuruzzaman.com.bd'; $c.website_origin='https://nuruzzaman.com.bd'; $c.allow_pilot_usage=$true
$c | ConvertTo-Json | Set-Content (Join-Path $root 'pilot-config.json')
Check 'reject production pilot debit command' { $null=$validate.Invoke($null,@([string](Join-Path $root 'pilot-config.json'))) } $true
$c=Get-Content $config -Raw | ConvertFrom-Json
$c.public_key_xml='<RSAKeyValue><Modulus>AQ==</Modulus><Exponent>AQAB</Exponent><D>not-a-key</D></RSAKeyValue>'
$c | ConvertTo-Json | Set-Content (Join-Path $root 'private-config.json')
Check 'reject private key parameter' { $null=$validate.Invoke($null,@([string](Join-Path $root 'private-config.json'))) } $true
Add-Content (Join-Path $testPayload 'Contents/Win64/NBOnlineWallet.dll') 'tamper'
Check 'reject installed hash tamper' { $null=$type.GetMethod('Verify',$flags).Invoke($null,@([string]$testPayload,$null)) } $true
$results | ConvertTo-Json | Set-Content (Join-Path $dir 'installer-tests.json')
$results | Format-Table
