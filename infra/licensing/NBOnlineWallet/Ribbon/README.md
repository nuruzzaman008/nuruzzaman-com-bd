# Separate NB ONLINE Ribbon

The addon creates a programmatic `NB ONLINE` tab, `ACCOUNT` and `WALLET & TOKENS` panels:

| Button | Command |
|---|---|
| Connect Account | NBWACCOUNT |
| Wallet | NBWWALLET |
| Sync Now | NBWSYNC |
| Transaction History | NBWHISTORY |

No existing CUIX/Ribbon file is edited; no separate CUIX is necessary. Load `NBOnlineWallet.dll` using bundle autoload or NETLOAD. Run RIBBON if hidden. If Ribbon is unavailable, the commands remain the fallback. The optional test command NBWPILOTUSAGE is deliberately not added to the panel.

The four BMP icons are embedded in the DLL. Do not import the reference ZIP CUIX. An existing tab with this addon ID is reused to avoid duplicates.
