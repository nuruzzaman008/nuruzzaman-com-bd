param(
 [Parameter(Mandatory=$true)][string]$SecuritySource,
 [Parameter(Mandatory=$true)][string]$AddonDirectory,
 [Parameter(Mandatory=$true)][string]$OutputDirectory,
 [string]$AutoCADRoot='C:\Program Files\Autodesk\AutoCAD 2024'
)
$ErrorActionPreference='Stop'
$expected='D9794CCCC41C649BA82F4A19DBED1B1F1D45A3040761FE9A4D42230974B8A231'
if((Get-FileHash -LiteralPath $SecuritySource -Algorithm SHA256).Hash -ne $expected){throw 'Original source hash does not match reviewed source.'}
if(Test-Path -LiteralPath $OutputDirectory){throw 'Choose a new private build directory.'}
foreach($name in @('NBOnlineWallet.dll','NBOnlineWallet.Core.dll')) {
 if(!(Test-Path -LiteralPath (Join-Path $AddonDirectory $name))){throw "Missing candidate dependency: $name"}
}
$text=[IO.File]::ReadAllText($SecuritySource)
$start=$text.IndexOf('    internal static class WalletStore')
$end=$text.IndexOf('    internal static class MachineFingerprint')
if($start -lt 0 -or $end -le $start){throw 'Unexpected original source structure.'}
$text=$text.Remove($start,$end-$start)
$initializer=[regex]'public void Initialize\(\)\s*\{'
if($initializer.Matches($text).Count -ne 1){throw 'Unexpected initializer structure.'}
$text=$initializer.Replace($text,"public void Initialize() {`n            SharedWalletLoader.Start();",1)

$old='private static void ShowCenter(string focus) { AcApp.ShowModalDialog(new LicenseCenterForm(focus)); }'
if(!$text.Contains($old)){throw 'Unexpected license UI structure.'}
$text=$text.Replace($old,'private static void ShowCenter(string focus) { new NBOnlineWallet.Addon().Wallet(); }')
if($text.Contains('nb_wallet_v2.bin')){throw 'Legacy wallet path remains in replacement.'}
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
$patched=Join-Path $OutputDirectory 'NBCommercialSecurity.private.cs'
[IO.File]::WriteAllText($patched,$text)
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:library /platform:x64 /optimize+ "/out:$OutputDirectory\NBCommercialSecurity.dll" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll /r:System.Web.Extensions.dll "/r:$AutoCADRoot\AcCoreMgd.dll" "/r:$AutoCADRoot\AcDbMgd.dll" "/r:$AutoCADRoot\AcMgd.dll" "/r:$AddonDirectory\NBOnlineWallet.dll" "/r:$AddonDirectory\NBOnlineWallet.Core.dll" $patched "$PSScriptRoot\Bridge\WalletStore.cs" "$PSScriptRoot\Bridge\SharedWalletLoader.cs"
if($LASTEXITCODE -ne 0){throw 'Shared-wallet runtime compilation failed.'}
Get-FileHash -LiteralPath "$OutputDirectory\NBCommercialSecurity.dll" -Algorithm SHA256
Write-Output 'Candidate only: installation and audited migration have not been performed. Keep private source out of distribution.'
