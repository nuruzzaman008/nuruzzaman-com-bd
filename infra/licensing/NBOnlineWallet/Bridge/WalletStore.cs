using System;
using NBOnlineWallet;

namespace NBEngineeringTools.Security {
    // Source-built replacement. Never reads, writes or falls back to the legacy wallet.
    internal static class WalletStore {
        private static bool subscribed;
        public static Wallet Current {
            get {
                EnsureLoaded();
                var state = Addon.ToolWallet();
                return new Wallet {
                    Activated = state.identity != null && state.wallet != null && state.wallet.status == "active" && !state.blocked && !state.suspicious && !state.review_required,
                    LicenseId = state.identity == null ? "" : state.identity.license_code,
                    Customer = state.identity == null ? "" : state.identity.email,
                    Balance = state.wallet == null ? 0 : state.wallet.available_balance
                };
            }
        }
        public static void EnsureLoaded() {
            if (!subscribed) { Addon.ToolWalletUpdated += RibbonBridge.QueueBalanceRefresh; subscribed = true; }
            Addon.ToolWallet();
        }
        public static bool CanStart(string command, int units, out string reason, out int required) {
            required = 0;
            try { required = Addon.ToolQuote(command, units); reason = ""; RibbonBridge.UpdateBalanceLabel(); return true; }
            catch (Exception) { reason = "Online wallet verification failed. Internet and an active paired license are required. Open NB ONLINE and Sync Now."; return false; }
        }
        public static bool Commit(string command, int units, out string message) {
            try { Addon.ToolCharge(command, units); RibbonBridge.UpdateBalanceLabel(); message = "Server wallet charge acknowledged."; return true; }
            catch (Exception) { message = "Charge not acknowledged. Check NB ONLINE status and Sync Now before further work. Preserve the wallet journal; resolve storage errors before retrying."; return false; }
        }
        public static bool Activate(string key, out string message) { message = "Use NB ONLINE Connect Account."; return false; }
        public static bool ApplyRefill(string key, out string message) { message = "Purchase tokens for this license on the website, then Sync Now."; return false; }
    }
}
