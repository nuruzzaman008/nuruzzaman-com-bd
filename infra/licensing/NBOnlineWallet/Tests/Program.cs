using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Win32;
using NBOnlineWallet;

internal static class Program {
    private static int passed;
    private static void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
    private static void Throws(Action action) { try { action(); } catch { return; } throw new Exception("Expected rejection"); }
    private static void Test(string name, Action test) { test(); passed++; Console.WriteLine("PASS " + name); }
    private sealed class FakeClock : IClock {
        public DateTime Now = new DateTime(2026, 9, 19, 12, 0, 0, DateTimeKind.Utc);
        public long Tick;
        public DateTime UtcNow { get { return Now; } }
        public long MonotonicMilliseconds { get { return Tick; } }
    }
    private sealed class MemoryStore : IStore {
        private string text = Json.Write(new State());
        public bool Fail;
        public State Load() { return Json.Read<State>(text); }
        public void Save(State value) { if (Fail) throw new IOException("Disk full"); text = Json.Write(value); }
    }
    private sealed class FakeApi : IWalletApi, ICommandWalletApi, IDisposable {
        public readonly FakeClock Clock = new FakeClock();
        public readonly RSACryptoServiceProvider Rsa = new RSACryptoServiceProvider(2048);
        public bool Confirmed, Offline, DropReply, DropConnect, DropCommand;
        public int CommandCharges;
        private readonly Dictionary<string, string> commandRequests = new Dictionary<string, string>();
        public int Error, License = 12, Device = 9, Version, Remaining, Charges, Reservations;
        public string LicenseCode = "NB-2026-001";
        private readonly Dictionary<string, string> hashes = new Dictionary<string, string>();
        private readonly Dictionary<string, SyncResponse> responses = new Dictionary<string, SyncResponse>();
        private readonly Dictionary<string, Connection> connects = new Dictionary<string, Connection>();
        public FakeApi() { Rsa.PersistKeyInCsp = false; }
        public void Dispose() { Rsa.Dispose(); }
        private static string Encode(byte[] bytes) { return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_'); }
        public string Sign(Grant grant) {
            var a = Encode(Encoding.UTF8.GetBytes(Json.Write(new { alg = "RS256", typ = "JWT", kid = "test-key" })));
            var b = Encode(Encoding.UTF8.GetBytes(Json.Write(grant)));
            return a + "." + b + "." + Encode(Rsa.SignData(Encoding.ASCII.GetBytes(a + "." + b), "SHA256"));
        }
        private void Check() { if (Offline) throw new IOException("Network down"); if (Error != 0) throw new ApiException(Error); if (!Confirmed) throw new ApiException(401); }
        private Wallet Wallet() { return new Wallet { license_id = License, available_balance = 900 - CommandCharges, reserved_balance = Remaining, version = Version, status = "active" }; }
        public Pair Pair(string machine) { if (Offline) throw new IOException(); return new Pair { code = new string('a', 48), secret = "test-secret" }; }
        public Balance Balance(string secret) { Check(); return new Balance { wallet = Wallet(), identity = new Identity { email = "owner@example.test", device_id = Device, license_code = LicenseCode }, server_time = WalletEngine.Stamp(Clock.Now) }; }
        public Connection Connect(string secret, ConnectRequest input) {
            Check(); Connection prior; if (connects.TryGetValue(input.request_id, out prior)) { Assert(hashes[input.request_id] == Json.Write(input), "Changed connect retry"); return prior; }
            if (input.expected_version != Version) throw new ApiException(409);
            Remaining = input.requested_allowance; Version++; Reservations++;
            long now = (long)(Clock.Now - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
            var lease = new Lease { id = Guid.NewGuid().ToString(), device_id = Device, allowance = Remaining };
            lease.grant = Sign(new Grant { iss = "nuruzzaman.com.bd", aud = "nb-engineering-tools", iat = now, exp = now + 86400, sync_due_at = now + 21600, jti = lease.id, license_id = License, device_id = Device, allowance = Remaining, policy = new Snapshot { policy = new Policy { sync_interval_seconds = 21600 }, commands = new Dictionary<string, Price> { { "PCM", new Price { cost = 1 } }, { "RM", new Price { cost = 1, daily = true } } }, billing_day = "2026-09-19" } });
            var result = new Connection { wallet = Wallet(), lease = lease };
            connects[input.request_id] = result; hashes[input.request_id] = Json.Write(input);
            if (DropConnect) { DropConnect = false; throw new IOException("Reply lost after reserve commit"); }
            return result;
        }
        public SyncResponse Sync(string secret, SyncRequest input) {
            Check(); SyncResponse prior; if (responses.TryGetValue(input.request_id, out prior)) { Assert(hashes[input.request_id] == Json.Write(input), "Changed sync retry"); return prior; }
            if (input.expected_version != Version) throw new ApiException(409);
            int amount = input.transactions.Sum(x => x.units); Remaining -= amount; Charges += amount; Version++;
            var result = new SyncResponse { request_id = input.request_id, status = "accepted", accepted_transaction_ids = input.transactions.Select(x => x.transaction_id).ToArray(), last_sequence = input.transactions.Last().sequence, wallet = Wallet(), lease_remaining = Remaining, server_time = WalletEngine.Stamp(Clock.Now) };
            responses[input.request_id] = result; hashes[input.request_id] = Json.Write(input);
            if (DropReply) { DropReply = false; throw new IOException("Reply lost after commit"); }
            return result;
        }
        public CommandResult Command(string secret, CommandRequest input) {
            Check();
            bool replay = input.transaction_id != null && commandRequests.ContainsKey(input.transaction_id);
            if (replay) Assert(commandRequests[input.transaction_id] == Json.Write(input), "Changed command retry");
            if (input.transaction_id != null && !replay) {
                commandRequests[input.transaction_id] = Json.Write(input); CommandCharges += input.units; Version++;
                if (DropCommand) { DropCommand = false; throw new IOException("Command reply lost after commit"); }
            }
            return new CommandResult { wallet = Wallet(), required = input.units, transaction_id = input.transaction_id, replayed = replay };
        }
        public string History(string secret, string cursor) { Check(); return Json.Write(new { data = responses.Values.ToArray(), meta = new { next_cursor = (string)null } }); }
    }
    private sealed class Fixture : IDisposable {
        public readonly MemoryStore Store = new MemoryStore();
        public readonly FakeApi Api = new FakeApi();
        public WalletEngine Engine;
        public Fixture(bool activate = true) { Reload(); if (activate) { Engine.BeginPair("NBW-1234567890123456", "https://example.test/"); Api.Confirmed = true; Engine.SyncNow(100); Assert(Engine.Status == "ONLINE", Engine.Status); } }
        public void Reload() { Engine = new WalletEngine(Store, Api, Api.Clock, new GrantVerifier("test-key", Api.Rsa.ToXmlString(false))); }
        public string Spend(int units = 2) { var id = Guid.NewGuid().ToString(); Engine.RecordUsage("PCM", units, id); return id; }
        public void Dispose() { Api.Dispose(); }
    }
    public static int Main() {
        try {
            Test("online command quote does not charge or consume reserves", delegate { using (var f = new Fixture()) { Assert(f.Engine.QuoteCommand("PCM", 2) == 2 && f.Api.CommandCharges == 0 && f.Api.Remaining == 100, "Quote mutated funds"); } });
            Test("online command updates authoritative available balance", delegate { using (var f = new Fixture()) { f.Engine.CommitCommand("PCM", 2); Assert(f.Engine.View().wallet.available_balance == 898 && f.Api.Remaining == 100 && f.Engine.View().pending_command == null, "Shared wallet acknowledgement"); } });
            Test("lost command response survives restart and sync retries once", delegate { using (var f = new Fixture()) { f.Api.DropCommand = true; Throws(delegate { f.Engine.CommitCommand("PCM", 2); }); var id = f.Engine.View().pending_command.transaction_id; f.Reload(); Assert(f.Engine.View().pending_command.transaction_id == id && f.Engine.View().schema == 2, "Retry identity or protected journal version changed"); f.Engine.SyncNow(0); Assert(f.Api.CommandCharges == 2 && f.Engine.View().pending_command == null && f.Engine.View().wallet.available_balance == 898, "Duplicate charge"); } });
            Test("offline paid command fails without legacy or allowance fallback", delegate { using (var f = new Fixture()) { f.Api.Offline = true; Throws(delegate { f.Engine.QuoteCommand("PCM", 2); }); Assert(f.Api.CommandCharges == 0 && f.Engine.View().remaining == 100, "Offline fallback spent funds"); } });
            Test("command requires account activation", delegate { using (var f = new Fixture(false)) { Throws(delegate { f.Engine.QuoteCommand("PCM", 2); }); Assert(f.Api.CommandCharges == 0, "Unpaired charge"); } });
            Test("pending command blocks different work and account change", delegate { using (var f = new Fixture()) { f.Api.DropCommand = true; Throws(delegate { f.Engine.CommitCommand("PCM", 2); }); Throws(delegate { f.Engine.CommitCommand("PCM", 3); }); Assert(f.Engine.AccountChangeBlockReason().Contains("command"), "Pending charge must prevent account switch"); } });
            Test("command access rejection persists block and preserves allowance", delegate { using (var f = new Fixture()) { f.Api.Error = 403; Throws(delegate { f.Engine.QuoteCommand("PCM", 2); }); f.Reload(); Assert(f.Engine.View().blocked && f.Engine.View().remaining == 100, "Revocation must persist"); Throws(delegate { f.Spend(); }); } });
            Test("command completion and automatic sync serialize without losing charge", delegate { using (var f = new Fixture()) { Parallel.Invoke(delegate { f.Engine.SyncNow(0); }, delegate { f.Engine.CommitCommand("PCM", 2); }); f.Engine.SyncNow(0); Assert(f.Api.CommandCharges == 2 && f.Engine.View().pending_command == null && f.Engine.View().wallet.available_balance == 898, "Concurrent completion lost or duplicated charge"); } });
            Test("storage failure prevents sending charge", delegate { using (var f = new Fixture()) { f.Store.Fail = true; Throws(delegate { f.Engine.CommitCommand("PCM", 2); }); Assert(f.Api.CommandCharges == 0, "Unjournaled charge"); } });
            Test("offline display requires first activation", delegate { using (var f = new Fixture(false)) { Assert(f.Engine.OfflineAllowanceStatus().Contains("activation"), "Unpaired state must not claim usable allowance"); } });
            Test("offline display distinguishes usable from sync due", delegate { using (var f = new Fixture()) { Assert(f.Engine.OfflineAllowanceStatus().StartsWith("Usable"), "Valid grant"); f.Api.Clock.Now = f.Api.Clock.Now.AddHours(7); Assert(f.Engine.OfflineAllowanceStatus().Contains("periodic sync"), "Due grant"); } });
            Test("expired allowance display preserves journal and reserves", delegate { using (var f = new Fixture()) { f.Api.Clock.Now = f.Api.Clock.Now.AddDays(2); var before = Json.Write(f.Engine.View()); Assert(f.Engine.OfflineAllowanceStatus().StartsWith("Expired"), "Expired grant must be explicit"); Assert(Json.Write(f.Engine.View()) == before && f.Api.Reservations == 1, "Presentation must not mutate or reserve"); } });
            Test("offline display rejects blocked license", delegate { using (var f = new Fixture()) { f.Api.Error = 403; f.Engine.SyncNow(100); Assert(f.Engine.OfflineAllowanceStatus().Contains("blocked"), "Blocked grant"); } });
            Test("offline display detects clock rollback without recording usage", delegate { using (var f = new Fixture()) { f.Api.Clock.Tick += 60000; f.Api.Clock.Now = f.Api.Clock.Now.AddMinutes(-10); Assert(f.Engine.OfflineAllowanceStatus().Contains("clock"), "Clock rollback"); } });
            Test("missing trusted key cannot reserve funds", delegate { using (var f = new Fixture(false)) { f.Api.Confirmed = true; var engine = new WalletEngine(f.Store, f.Api, f.Api.Clock, new GrantVerifier("", "")); engine.BeginPair("NBW-1234567890123456", "https://example.test/"); engine.SyncNow(100); Assert(f.Api.Reservations == 0 && engine.View().suspicious, "Missing key must fail before reservation"); } });
            Test("automatic retry schedule uses monotonic time after clock rollback", delegate { using (var f = new Fixture()) { var schedule = new SyncSchedule(f.Api.Clock); Assert(schedule.Due, "First auto sync due"); f.Spend(); f.Api.Offline = true; f.Engine.SyncNow(100); schedule.AttemptCompleted(); f.Api.Clock.Now = f.Api.Clock.Now.AddHours(-1); Assert(!schedule.Due, "No immediate retry storm"); f.Api.Clock.Tick += 30000; Assert(schedule.Due, "Retry due despite rollback"); f.Api.Clock.Now = f.Api.Clock.Now.AddHours(1); f.Api.Offline = false; f.Engine.SyncNow(100); Assert(f.Api.Charges == 2, "Auto retry settled pending"); } });
            Test("suspended wallet fails closed without discarding usage", delegate { using (var f = new Fixture()) { f.Spend(); f.Api.Error = 403; f.Engine.SyncNow(100); Assert(f.Engine.View().blocked && f.Engine.View().journal[0].state == "pending", "Suspension state"); Throws(delegate { f.Spend(); }); } });
            Test("confirmed device mismatch requires verification", delegate { using (var f = new Fixture()) { f.Api.Device = 45; f.Engine.SyncNow(100); Assert(f.Engine.View().suspicious, "Device mismatch"); Throws(delegate { f.Spend(); }); } });
            Test("reinstall can pair a new authorized device without a local balance reset", delegate { using (var f = new Fixture(false)) { f.Api.Device = 45; f.Api.License = 12; f.Engine.BeginPair("NBW-NEW-WINDOWS-IDENTITY", "https://example.test/"); f.Api.Confirmed = true; f.Engine.SyncNow(100); Assert(f.Engine.View().identity.device_id == 45 && f.Engine.View().wallet.available_balance == 900, "Server balance on reinstall"); } });
            Test("account switch preserves reserved allowance and journal", delegate { using (var f = new Fixture()) { var before = Json.Write(f.Engine.View()); Assert(f.Engine.AccountChangeBlockReason() != null, "Reserved allowance must explain the block"); Throws(delegate { f.Engine.BeginPair("OTHER-PC", "https://example.test/"); }); Assert(Json.Write(f.Engine.View()) == before, "Blocked account switch mutated wallet"); } });
            Test("sync progress reports success only after server completion", delegate { using (var f = new Fixture()) { f.Engine.SyncNow(100); Assert(f.Engine.SyncStage == "Completed" && f.Engine.Status == "ONLINE", "Successful sync status"); f.Api.Offline = true; f.Engine.SyncNow(100); Assert(f.Engine.SyncStage != "Completed" && f.Engine.Status.StartsWith("OFFLINE"), "Network failure must not show success"); } });
            Test("pending usage gives account reconciliation reason without discard", delegate { using (var f = new Fixture()) { f.Spend(2); Assert(f.Engine.AccountChangeBlockReason().Contains("Unsettled"), "Explain pending journal"); Assert(f.Engine.View().journal.Count == 1 && f.Engine.View().remaining == 98, "Journal preserved"); } });
            Test("first activation requires online", delegate { using (var f = new Fixture(false)) { Throws(delegate { f.Spend(); }); Assert(f.Engine.View().lease == null, "No preactivation allowance"); } });
            Test("browser login link contains pairing code, never password or bearer", delegate { using (var f = new Fixture(false)) { string url = f.Engine.BeginPair("NBW-1234567890123456", "https://example.test/"); Assert(url.StartsWith("https://example.test/connect-autocad#code="), "Pair URL"); Assert(!url.Contains("test-secret"), "Secret leaked"); f.Engine.SyncNow(100); Assert(f.Engine.View().lease == null && !f.Engine.View().blocked, "Await website confirmation"); f.Api.Confirmed = true; f.Engine.SyncNow(100); Assert(f.Engine.View().identity.email == "owner@example.test", "Owner identity"); } });
            Test("multiple licenses use browser-selected license, never first account license", delegate { using (var f = new Fixture(false)) { f.Api.License = 88; f.Api.LicenseCode = "NB-SECOND"; f.Engine.BeginPair("NBW-1234567890123456", "https://example.test/"); f.Api.Confirmed = true; f.Engine.SyncNow(100); Assert(f.Engine.View().wallet.license_id == 88 && f.Engine.View().identity.license_code == "NB-SECOND", "Selected identity"); f.Api.License = 12; f.Engine.SyncNow(100); Throws(delegate { f.Spend(); }); } });
            Test("offline usage persists device license sequence and allowance", delegate { using (var f = new Fixture()) { f.Api.Offline = true; f.Spend(3); f.Reload(); var s = f.Engine.View(); Assert(s.remaining == 97 && s.journal[0].device_id == 9 && s.journal[0].license_id == 12 && s.sequence == 1, "Durable journal"); } });
            Test("reconnect settles pending and reads server balance", delegate { using (var f = new Fixture()) { f.Spend(); f.Spend(3); f.Engine.SyncNow(100); Assert(f.Api.Charges == 5 && f.Engine.View().journal.All(x => x.state == "acknowledged") && f.Engine.View().remaining == 95, "Settlement"); } });
            Test("duplicate transaction is locally idempotent and changed payload rejected", delegate { using (var f = new Fixture()) { var id = f.Spend(); f.Engine.RecordUsage("PCM", 2, id); Assert(f.Engine.View().remaining == 98 && f.Engine.View().journal.Count == 1, "Duplicate spend"); Throws(delegate { f.Engine.RecordUsage("PCM", 3, id); }); } });
            Test("lost sync response survives process restart and retries identical request", delegate { using (var f = new Fixture()) { f.Spend(); f.Api.DropReply = true; f.Engine.SyncNow(100); var id = f.Engine.View().in_flight.request_id; f.Reload(); Assert(f.Engine.View().in_flight.request_id == id, "Request preserved"); f.Engine.SyncNow(100); Assert(f.Api.Charges == 2 && f.Engine.View().in_flight == null, "No double debit"); } });
            Test("lost reservation response does not reserve twice", delegate { using (var f = new Fixture(false)) { f.Engine.BeginPair("NBW-1234567890123456", "https://example.test/"); f.Api.Confirmed = true; f.Api.DropConnect = true; f.Engine.SyncNow(100); f.Reload(); f.Engine.SyncNow(100); Assert(f.Api.Reservations == 1 && f.Engine.View().remaining == 100, "Reserve retry"); } });
            Test("server unavailable retains queue and permits remaining valid offline usage", delegate { using (var f = new Fixture()) { f.Spend(); f.Api.Error = 503; f.Engine.SyncNow(100); Assert(f.Engine.Status.StartsWith("OFFLINE") && f.Engine.View().journal[0].state == "pending", "Pending retained"); f.Spend(); } });
            Test("blocked license stops offline use and retains pending", delegate { using (var f = new Fixture()) { f.Spend(); f.Api.Error = 403; f.Engine.SyncNow(100); Throws(delegate { f.Spend(); }); Assert(f.Engine.View().journal[0].state == "pending", "Blocked queue retained"); } });
            Test("reinstall new device requires new activation, old signed lease rejected", delegate { using (var f = new Fixture()) { var s = f.Engine.View(); var other = new WalletEngine(new MemoryStore(), f.Api, f.Api.Clock, new GrantVerifier("test-key", f.Api.Rsa.ToXmlString(false))); Throws(delegate { other.RecordUsage("PCM", 1, Guid.NewGuid().ToString()); }); Throws(delegate { new GrantVerifier("test-key", f.Api.Rsa.ToXmlString(false)).Verify(s.lease, 12, 77); }); } });
            Test("clock rollback in same process and restart fails closed", delegate { using (var f = new Fixture()) { f.Spend(); f.Api.Clock.Tick += 60000; f.Api.Clock.Now = f.Api.Clock.Now.AddMinutes(-10); Throws(delegate { f.Spend(); }); f.Reload(); Assert(f.Engine.View().suspicious, "Rollback persisted"); } });
            Test("expired and periodic-sync-due lease cannot spend", delegate { using (var f = new Fixture()) { f.Api.Clock.Now = f.Api.Clock.Now.AddHours(7); Throws(delegate { f.Spend(); }); f.Engine.SyncNow(100); f.Spend(); f.Api.Clock.Now = f.Api.Clock.Now.AddDays(2); Throws(delegate { f.Spend(); }); } });
            Test("invalid signing key or tampered grant rejected", delegate { using (var f = new Fixture()) { var s = f.Engine.View(); s.lease.grant = s.lease.grant.Substring(0, s.lease.grant.Length - 10) + "aaaaaaaaaa"; Throws(delegate { new GrantVerifier("test-key", f.Api.Rsa.ToXmlString(false)).Verify(s.lease, 12, 9); }); Throws(delegate { new GrantVerifier("other-key", f.Api.Rsa.ToXmlString(false)).Verify(f.Engine.View().lease, 12, 9); }); } });
            Test("concurrent sync serialized, no duplicate charge", delegate { using (var f = new Fixture()) { f.Spend(); Parallel.For(0, 12, delegate(int i) { f.Engine.SyncNow(100); }); Assert(f.Api.Charges == 2 && f.Engine.View().journal.Count == 1, "Concurrent debit"); } });
            Test("wallet version conflict retains exact rejected batch for review", delegate { using (var f = new Fixture()) { f.Spend(); f.Api.DropReply = true; f.Api.Error = 409; f.Engine.SyncNow(100); Assert(f.Engine.View().review_required && f.Engine.View().journal[0].state == "pending", "Review retained"); Throws(delegate { f.Spend(); }); } });
            Test("durability failure stops usage, never silently resets", delegate { using (var f = new Fixture()) { f.Store.Fail = true; Throws(delegate { f.Spend(); }); Throws(delegate { f.Spend(); }); } });
            Test("transaction history reads selected wallet", delegate { using (var f = new Fixture()) { f.Spend(); f.Engine.SyncNow(100); Assert(f.Engine.History(null).Contains("accepted"), "History"); } });
            Test("DPAPI encrypted journal, process lock, rollback and corruption detection", delegate {
                string folder = Path.Combine(Path.GetTempPath(), "nb-wallet-test-" + Guid.NewGuid().ToString("N"));
                string key = @"Software\NBOnlineWalletTests\" + Guid.NewGuid().ToString("N");
                try {
                    using (var store = new EncryptedStore(folder, key)) { store.Save(new State { secret = "do-not-store-plaintext" }); Throws(delegate { using (var second = new EncryptedStore(folder, key)) { } }); }
                    string path = Path.Combine(folder, "wallet.dpapi"); var old = File.ReadAllBytes(path);
                    Assert(!Encoding.UTF8.GetString(old).Contains("do-not-store-plaintext"), "Plaintext secret");
                    using (var store = new EncryptedStore(folder, key)) { Assert(store.Load().secret == "do-not-store-plaintext", "DPAPI roundtrip"); store.Save(new State { secret = "new" }); }
                    File.WriteAllBytes(path, old);
                    using (var store = new EncryptedStore(folder, key)) Throws(delegate { store.Load(); });
                    File.WriteAllBytes(path, new byte[] { 1, 2, 3 });
                    using (var store = new EncryptedStore(folder, key)) Throws(delegate { store.Load(); });
                } finally { if (Directory.Exists(folder)) Directory.Delete(folder, true); Registry.CurrentUser.DeleteSubKeyTree(key, false); }
            });
            Test("encrypted store supports protected command journal schema and rejects unknown schema", delegate {
                string folder = Path.Combine(Path.GetTempPath(), "nb-wallet-test-" + Guid.NewGuid().ToString("N"));
                string key = @"Software\NBOnlineWalletTests\" + Guid.NewGuid().ToString("N");
                try {
                    using (var store = new EncryptedStore(folder, key)) {
                        store.Save(new State { schema = 2, pending_command = new CommandRequest { command = "PCM", units = 2, transaction_id = Guid.NewGuid().ToString() } });
                        Assert(store.Load().schema == 2 && store.Load().pending_command.units == 2, "Command journal was lost");
                        store.Save(new State { schema = 3 }); Throws(delegate { store.Load(); });
                    }
                } finally { if (Directory.Exists(folder)) Directory.Delete(folder, true); Registry.CurrentUser.DeleteSubKeyTree(key, false); }
            });
            Test("inaccessible journal is not treated as an empty wallet", delegate {
                string folder = Path.Combine(Path.GetTempPath(), "nb-wallet-test-" + Guid.NewGuid().ToString("N"));
                string key = @"Software\NBOnlineWalletTests\" + Guid.NewGuid().ToString("N");
                try {
                    using (var store = new EncryptedStore(folder, key)) {
                        Directory.CreateDirectory(Path.Combine(folder, "wallet.dpapi"));
                        bool denied = false;
                        try { store.Load(); } catch (UnauthorizedAccessException) { denied = true; }
                        Assert(denied, "Directory/access error must not become a missing-file or fresh-wallet result");
                    }
                } finally { if (Directory.Exists(folder)) Directory.Delete(folder, true); Registry.CurrentUser.DeleteSubKeyTree(key, false); }
            });
            Test("missing established journal remains blocked", delegate {
                string folder = Path.Combine(Path.GetTempPath(), "nb-wallet-test-" + Guid.NewGuid().ToString("N"));
                string key = @"Software\NBOnlineWalletTests\" + Guid.NewGuid().ToString("N");
                try {
                    using (var store = new EncryptedStore(folder, key)) {
                        Assert(store.Load().journal.Count == 0, "New profile starts empty");
                        store.Save(new State());
                        File.Delete(Path.Combine(folder, "wallet.dpapi"));
                        bool blocked = false;
                        try { store.Load(); } catch (InvalidDataException) { blocked = true; }
                        Assert(blocked, "Established journal must never reset");
                    }
                } finally { if (Directory.Exists(folder)) Directory.Delete(folder, true); Registry.CurrentUser.DeleteSubKeyTree(key, false); }
            });
            Console.WriteLine("RESULT: " + passed + " tests passed"); return 0;
        } catch (Exception ex) { Console.Error.WriteLine("FAILED after " + passed + " tests: " + ex); return 1; }
    }
}
