using System;
using System.IO;
using System.Text;
using System.Security.Cryptography;
using Microsoft.Win32;

namespace NBOnlineWallet {
    // One process owns a profile. A separately protected checkpoint detects an old journal file.
    public sealed class EncryptedStore : IStore, IDisposable {
        private readonly string path;
        private readonly string anchor;
        private readonly FileStream processLock;
        public EncryptedStore(string folder, string anchorName) {
            Directory.CreateDirectory(folder);
            path = Path.Combine(folder, "wallet.dpapi"); anchor = anchorName;
            processLock = new FileStream(Path.Combine(folder, "wallet.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        }
        private static byte[] Protect(byte[] bytes) { return ProtectedData.Protect(bytes, Encoding.UTF8.GetBytes("NBOnlineWallet/v1"), DataProtectionScope.CurrentUser); }
        private static byte[] Unprotect(byte[] bytes) { return ProtectedData.Unprotect(bytes, Encoding.UTF8.GetBytes("NBOnlineWallet/v1"), DataProtectionScope.CurrentUser); }
        private static string Hash(byte[] bytes) { using (var sha = SHA256.Create()) return Convert.ToBase64String(sha.ComputeHash(bytes)); }
        public State Load() {
            using (var key = Registry.CurrentUser.CreateSubKey(anchor)) {
                var checkpoint = key.GetValue("Checkpoint") as byte[];
                byte[] bytes;
                try { bytes = File.ReadAllBytes(path); }
                catch (FileNotFoundException) {
                    if (checkpoint != null) throw new InvalidDataException("Wallet file missing. Restore the original file or request reconciliation; do not reset the wallet.");
                    return new State();
                }
                if (checkpoint == null || Encoding.UTF8.GetString(Unprotect(checkpoint)) != Hash(bytes)) throw new InvalidDataException("Wallet checkpoint mismatch. Online reconciliation required.");
                var state = Json.Read<State>(Encoding.UTF8.GetString(Unprotect(bytes)));
                if (state == null || state.schema != 1 || state.journal == null) throw new InvalidDataException("Invalid wallet journal.");
                return state;
            }
        }
        public void Save(State value) {
            var bytes = Protect(Encoding.UTF8.GetBytes(Json.Write(value)));
            string temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            using (var file = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough)) { file.Write(bytes, 0, bytes.Length); file.Flush(true); }
            if (File.Exists(path)) File.Replace(temp, path, path + ".previous"); else File.Move(temp, path);
            // Crash between file and checkpoint is fail-closed, never a silent reset/refund.
            using (var key = Registry.CurrentUser.CreateSubKey(anchor)) { key.SetValue("Checkpoint", Protect(Encoding.UTF8.GetBytes(Hash(bytes))), RegistryValueKind.Binary); key.Flush(); }
        }
        public void Dispose() { processLock.Dispose(); }
    }
    public sealed class GrantVerifier {
        private readonly string keyId;
        private readonly string publicXml;
        public GrantVerifier(string keyId, string publicXml) { this.keyId = keyId; this.publicXml = publicXml; }
        public void EnsureConfigured() {
            if (string.IsNullOrWhiteSpace(publicXml) || string.IsNullOrWhiteSpace(keyId)) throw new InvalidDataException("Trusted server public key is not configured. No reservation or offline spending allowed.");
            if (publicXml.Contains("<D>") || publicXml.Contains("<P>")) throw new InvalidDataException("Only the public signing key may be installed in the addon.");
            using (var rsa = new RSACryptoServiceProvider()) { rsa.PersistKeyInCsp = false; rsa.FromXmlString(publicXml); if (rsa.KeySize < 2048) throw new InvalidDataException("RSA public key must be at least 2048 bits."); }
        }
        private static byte[] Decode(string value) { value = value.Replace('-', '+').Replace('_', '/'); return Convert.FromBase64String(value.PadRight((value.Length + 3) / 4 * 4, '=')); }
        public Grant Verify(Lease lease, int license, int device) {
            EnsureConfigured();
            var parts = lease.grant.Split('.');
            if (parts.Length != 3) throw new InvalidDataException("Invalid lease signature.");
            var header = Json.Read<System.Collections.Generic.Dictionary<string, string>>(Encoding.UTF8.GetString(Decode(parts[0])));
            if (header["alg"] != "RS256" || header["typ"] != "JWT" || header["kid"] != keyId) throw new InvalidDataException("Untrusted lease signing key.");
            using (var rsa = new RSACryptoServiceProvider()) {
                rsa.PersistKeyInCsp = false; rsa.FromXmlString(publicXml);
                if (rsa.KeySize < 2048 || !rsa.VerifyData(Encoding.ASCII.GetBytes(parts[0] + "." + parts[1]), "SHA256", Decode(parts[2]))) throw new InvalidDataException("Lease signature verification failed.");
            }
            var grant = Json.Read<Grant>(Encoding.UTF8.GetString(Decode(parts[1])));
            if (grant.iss != "nuruzzaman.com.bd" || grant.aud != "nb-engineering-tools" || grant.license_id != license || grant.device_id != device || grant.device_id != lease.device_id || grant.jti != lease.id || grant.allowance != lease.allowance || grant.allowance < 1 || grant.policy == null || grant.policy.commands == null || grant.policy.policy == null || grant.policy.policy.sync_interval_seconds < 1 || grant.exp <= grant.iat || grant.sync_due_at > grant.exp) throw new InvalidDataException("Lease identity/policy mismatch.");
            return grant;
        }
    }
}
