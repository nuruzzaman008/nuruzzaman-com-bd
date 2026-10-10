using System;
using System.IO;
using System.Linq;

namespace NBOnlineWallet {
    public sealed class WalletEngine {
        private readonly object gate = new object();
        private readonly IStore store;
        private readonly IWalletApi api;
        private readonly IClock clock;
        private readonly GrantVerifier verifier;
        private State state;
        private bool storageFailed;
        private DateTime anchorUtc;
        private long anchorTick;
        public string Status { get; private set; }
        private volatile string syncStage = "Idle";
        public string SyncStage { get { return syncStage; } }
        public string AccountChangeBlockReason() {
            lock (gate) {
                if (state.pending_command != null) return "An engineering command charge is awaiting server acknowledgement.";
                if (state.review_required || state.suspicious || storageFailed) return "Wallet verification/reconciliation is required before changing accounts.";
                if (Pending() != 0 || state.in_flight != null || state.connect_request != null) return "Unsettled transactions must be acknowledged before changing accounts.";
                if ((state.lease != null && state.remaining > 0) || (state.wallet != null && state.wallet.reserved_balance > 0)) return "Reserved/offline allowance remains assigned to this license. Sync can settle pending usage, but cannot release unused reserves; administrator reconciliation is required.";
                return null;
            }
        }
        public WalletEngine(IStore store, IWalletApi api, IClock clock, GrantVerifier verifier) {
            this.store = store; this.api = api; this.clock = clock; this.verifier = verifier;
            state = store.Load(); Status = "OFFLINE"; anchorUtc = clock.UtcNow; anchorTick = clock.MonotonicMilliseconds;
            if (state.last_local_time != null && clock.UtcNow < Parse(state.last_local_time).AddSeconds(-5)) { state.suspicious = true; Persist(); }
        }
        public static string Stamp(DateTime time) { return time.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"); }
        private static DateTime Parse(string text) { return DateTime.Parse(text, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal); }
        private static DateTime Unix(long seconds) { return new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddSeconds(seconds); }
        private void Persist() {
            try { state.last_local_time = Stamp(clock.UtcNow); store.Save(state); }
            catch { storageFailed = true; Status = "STORAGE ERROR — usage stopped; preserve journal"; throw; }
        }
        private void CheckStorage() { if (storageFailed) throw new IOException("Wallet storage failed. Restart after resolving storage; do not delete the journal."); }
        public State View() { lock (gate) return Json.Read<State>(Json.Write(state)); }
        private CommandResult SendCommand(CommandRequest request) {
            CheckStorage();
            if (state.secret == null || state.identity == null || state.wallet == null || state.blocked || state.suspicious || state.review_required) throw new InvalidOperationException("Connect and verify this wallet before running tools.");
            var commands = api as ICommandWalletApi;
            if (commands == null) throw new InvalidOperationException("Command billing is unavailable.");
            CommandResult result;
            try { result = commands.Command(state.secret, request); }
            catch (ApiException ex) {
                if (ex.Status == 401 || ex.Status == 403) { state.blocked = true; Status = "ACCESS BLOCKED / DEVICE REVOKED � command stopped"; Persist(); }
                throw;
            }
            if (result == null || result.wallet == null || result.wallet.license_id != state.wallet.license_id || result.wallet.status != "active" || result.wallet.available_balance < 0 || result.wallet.reserved_balance < 0 || result.required < 0 || result.transaction_id != request.transaction_id) throw new InvalidDataException("Invalid command acknowledgement; pending charge retained.");
            state.wallet = result.wallet;
            return result;
        }
        private void ReplayCommand() {
            if (state.pending_command == null) return;
            SendCommand(state.pending_command);
            state.pending_command = null;
            Persist();
        }
        public int QuoteCommand(string command, int units) {
            lock (gate) {
                ReplayCommand();
                if (Pending() != 0 || state.in_flight != null || state.connect_request != null) throw new InvalidOperationException("Sync pending offline usage before starting an online command.");
                var result = SendCommand(new CommandRequest { command = command.ToUpperInvariant(), units = units });
                Persist();
                return result.required;
            }
        }
        public void CommitCommand(string command, int units) {
            lock (gate) {
                CheckStorage();
                command = command.ToUpperInvariant();
                if (state.pending_command != null && (state.pending_command.command != command || state.pending_command.units != units)) throw new InvalidOperationException("Sync the pending command before charging different work.");
                if (state.pending_command == null) {
                    state.schema = 2; // Older addons must reject journals containing online command charges.
                    state.pending_command = new CommandRequest { command = command, units = units, transaction_id = Guid.NewGuid().ToString() };
                    Persist();
                }
                ReplayCommand();
            }
        }
        private int Pending() { return state.journal.Count(x => x.state == "pending"); }
        public string BeginPair(string machine, string website) {
            lock (gate) {
                CheckStorage();
                var blockedChange = AccountChangeBlockReason();
                if (blockedChange != null) throw new InvalidOperationException(blockedChange);
                if (Pending() != 0 || state.in_flight != null || state.connect_request != null || (state.lease != null && state.remaining > 0)) throw new InvalidOperationException("Settle or reconcile the current allowance before changing accounts/licenses.");
                var site = new Uri(website); if (site.Scheme != "https" || !string.IsNullOrEmpty(site.UserInfo)) throw new ArgumentException("HTTPS website required.");
                // Retrying browser launch reuses the pairing secret until its ten-minute expiry.
                if (state.pairing_code == null || clock.UtcNow > Parse(state.pairing_started).AddMinutes(9)) {
                    var pair = api.Pair(machine);
                    state.secret = pair.secret; state.pairing_code = pair.code; state.pairing_started = Stamp(clock.UtcNow);
                    state.identity = null; state.wallet = null; state.lease = null; state.sequence = 0; state.blocked = false;
                    Persist();
                }
                Status = "AWAITING WEBSITE LOGIN / LICENSE SELECTION";
                return new Uri(site, "/connect-autocad").AbsoluteUri + "#code=" + Uri.EscapeDataString(state.pairing_code);
            }
        }
        private void ApplyBalance(Balance result) {
            if (result == null || result.wallet == null || result.identity == null || result.identity.device_id < 1 || string.IsNullOrWhiteSpace(result.identity.email) || string.IsNullOrWhiteSpace(result.identity.license_code)) throw new InvalidDataException("Server identity response is unavailable. Update the reviewed API before connecting.");
            if (state.identity != null && (state.identity.device_id != result.identity.device_id || state.wallet.license_id != result.wallet.license_id || state.identity.license_code != result.identity.license_code)) throw new InvalidDataException("Paired license changed unexpectedly.");
            if (result.wallet.status != "active") throw new ApiException(403);
            state.identity = result.identity; state.wallet = result.wallet; state.last_server_time = result.server_time;
            state.pairing_code = null;
            // A wrong clock is not trusted just because an HTTPS request succeeded.
            state.suspicious = Math.Abs((clock.UtcNow - Parse(result.server_time)).TotalSeconds) > 120;
            state.blocked = false; anchorUtc = clock.UtcNow; anchorTick = clock.MonotonicMilliseconds;
        }
        private void ApplyConnection(Connection result) {
            if (result.wallet.license_id != state.wallet.license_id) throw new InvalidDataException("Wrong license in lease response.");
            var grant = verifier.Verify(result.lease, state.wallet.license_id, state.identity.device_id);
            if (Unix(grant.exp) <= Parse(state.last_server_time)) throw new InvalidDataException("Expired grant.");
            state.wallet = result.wallet; state.lease = result.lease; state.remaining = grant.allowance;
            state.sequence = 0; state.sync_due = Stamp(Unix(grant.sync_due_at)); state.connect_request = null;
            Persist();
        }
        public void SyncNow(int requestedAllowance) {
            lock (gate) {
                CheckStorage();
                if (state.secret == null) { Status = "Connect Account first"; syncStage = Status; return; }
                if (state.review_required) { Status = "RECONCILIATION REQUIRED — pending journal retained"; syncStage = Status; return; }
                try {
                    syncStage = "Connecting / replaying unacknowledged requests";
                    ReplayCommand();
                    // Always replay the exact persisted request before any newer network operation.
                    if (state.in_flight != null) SendBatch();
                    if (state.connect_request != null) ApplyConnection(api.Connect(state.secret, state.connect_request));
                    syncStage = "Reading authenticated server wallet";
                    ApplyBalance(api.Balance(state.secret)); Persist();
                    syncStage = "Reconciling pending journal";
                    while (Pending() > 0) {
                        // One item per batch works with every valid server max_batch_size.
                        var usage = state.journal.First(x => x.state == "pending").usage;
                        state.in_flight = new SyncRequest { request_id = Guid.NewGuid().ToString(), lease_id = state.lease.id, expected_version = state.wallet.version, transactions = new[] { usage } };
                        Persist(); SendBatch();
                    }
                    if ((state.lease == null || state.remaining == 0) && requestedAllowance > 0 && state.wallet.available_balance > 0) {
                        syncStage = "Requesting signed offline allowance";
                        verifier.EnsureConfigured();
                        state.connect_request = new ConnectRequest { request_id = Guid.NewGuid().ToString(), expected_version = state.wallet.version, requested_allowance = Math.Min(requestedAllowance, state.wallet.available_balance) };
                        Persist(); ApplyConnection(api.Connect(state.secret, state.connect_request));
                    }
                    syncStage = "Updating verified local wallet";
                    state.last_sync = state.last_server_time;
                    if (state.lease != null) {
                        var grant = verifier.Verify(state.lease, state.wallet.license_id, state.identity.device_id);
                        var next = Parse(state.last_server_time).AddSeconds(grant.policy.policy.sync_interval_seconds);
                        state.sync_due = Stamp(next < Unix(grant.exp) ? next : Unix(grant.exp));
                    }
                    Persist(); Status = state.suspicious ? "CLOCK MISMATCH — correct Windows time and sync" : "ONLINE";
                } catch (ApiException ex) {
                    if (ex.Status == 401 && state.identity == null && state.pairing_code != null) Status = "AWAITING WEBSITE CONFIRMATION (pairing expires in 10 minutes)";
                    else if (ex.Status == 401 || ex.Status == 403) { state.blocked = true; Persist(); Status = "ACCESS BLOCKED / DEVICE REVOKED — offline usage stopped"; }
                    else if (ex.Status == 409 || ex.Status == 422 || ex.Status == 410) { state.review_required = true; Persist(); Status = "RECONCILIATION REQUIRED (HTTP " + ex.Status + ") — journal retained"; }
                    else Status = "OFFLINE — " + Pending() + " transactions pending (HTTP " + ex.Status + ")";
                } catch (InvalidDataException) { state.suspicious = true; Persist(); Status = "VERIFICATION FAILED — offline usage stopped; journal retained"; }
                catch (IOException) { Status = "OFFLINE — " + Pending() + " transactions pending; retry scheduled"; if (storageFailed) throw; }
                catch (Exception) { state.suspicious = true; Persist(); Status = "VERIFICATION FAILED — offline usage stopped; journal retained"; }
                finally { syncStage = Status == "ONLINE" ? "Completed" : Status; }
            }
        }
        private void SendBatch() {
            var request = state.in_flight;
            var result = api.Sync(state.secret, request);
            if (result == null || result.status != "accepted" || result.request_id != request.request_id || result.wallet == null || result.wallet.license_id != state.wallet.license_id || result.accepted_transaction_ids == null || !result.accepted_transaction_ids.SequenceEqual(request.transactions.Select(x => x.transaction_id)) || result.last_sequence != request.transactions.Last().sequence || result.lease_remaining < 0 || result.lease_remaining > state.lease.allowance) throw new InvalidDataException("Invalid sync acknowledgement.");
            int unsent = state.journal.Where(x => x.state == "pending" && !result.accepted_transaction_ids.Contains(x.usage.transaction_id)).Sum(x => x.token_amount);
            if (result.lease_remaining - unsent < 0) throw new InvalidDataException("Allowance reconciliation required.");
            foreach (var usage in request.transactions) state.journal.Single(x => x.usage.transaction_id == usage.transaction_id).state = "acknowledged";
            // Keep unsent conservative costs deducted from server-confirmed remaining allowance.
            state.remaining = result.lease_remaining - state.journal.Where(x => x.state == "pending").Sum(x => x.token_amount);
            if (state.remaining < 0) throw new InvalidDataException("Allowance reconciliation required.");
            state.wallet = result.wallet; state.last_server_time = result.server_time; state.last_sync = result.server_time; state.in_flight = null; Persist();
        }
        public string RecordUsage(string command, int units, string transactionId) {
            lock (gate) {
                CheckStorage();
                Guid parsed; if (!Guid.TryParse(transactionId, out parsed)) throw new ArgumentException("Unique transaction UUID required.");
                command = command.ToUpperInvariant();
                var duplicate = state.journal.SingleOrDefault(x => x.usage.transaction_id == transactionId);
                if (duplicate != null) { if (duplicate.usage.command != command || duplicate.usage.units != units) throw new InvalidOperationException("Transaction ID reused with different usage."); return transactionId; }
                var monotonicExpected = anchorUtc.AddMilliseconds(clock.MonotonicMilliseconds - anchorTick);
                if (clock.UtcNow < monotonicExpected.AddSeconds(-5) || (state.last_local_time != null && clock.UtcNow < Parse(state.last_local_time).AddSeconds(-5))) { state.suspicious = true; Persist(); }
                if (state.suspicious || state.blocked || state.review_required || state.lease == null || state.in_flight != null || state.connect_request != null) throw new InvalidOperationException("Online verification required before usage.");
                var grant = verifier.Verify(state.lease, state.wallet.license_id, state.identity.device_id);
                if (clock.UtcNow >= Unix(grant.exp) || clock.UtcNow >= Parse(state.sync_due)) throw new InvalidOperationException("Offline allowance expired or periodic sync is due.");
                Price price; if (units < 1 || units > 10000 || !grant.policy.commands.TryGetValue(command, out price) || price.cost < 0) throw new InvalidOperationException("Command is not in the signed pricing policy.");
                // Daily fees are conservatively reserved every time; server refunds the estimate via lease_remaining.
                int amount = checked(price.cost * (price.daily ? 1 : units));
                if (amount > state.remaining) throw new InvalidOperationException("Offline allowance exhausted. Sync or purchase tokens.");
                var usage = new Usage { transaction_id = transactionId, sequence = checked(state.sequence + 1), command = command, units = units, occurred_at = Stamp(clock.UtcNow) };
                state.journal.Add(new JournalEntry { usage = usage, device_id = state.identity.device_id, license_id = state.wallet.license_id, token_amount = amount, state = "pending", lease_id = state.lease.id });
                state.sequence = usage.sequence; state.remaining -= amount;
                Persist(); Status = "OFFLINE — " + Pending() + " transactions pending"; return transactionId;
            }
        }
        // Presentation only: reading status must never renew a lease or release reserves.
        public string OfflineAllowanceStatus() {
            lock (gate) {
                if (storageFailed || state.review_required) return "Unavailable - reconciliation required";
                if (state.blocked) return "Unavailable - access blocked";
                var expected = anchorUtc.AddMilliseconds(clock.MonotonicMilliseconds - anchorTick);
                if (state.suspicious || clock.UtcNow < expected.AddSeconds(-5) || (state.last_local_time != null && clock.UtcNow < Parse(state.last_local_time).AddSeconds(-5))) return "Unavailable - clock verification required";
                if (state.lease == null || state.wallet == null || state.identity == null) return "Unavailable - online activation required";
                if (state.in_flight != null || state.connect_request != null) return "Unavailable - pending sync must complete";
                try {
                    var grant = verifier.Verify(state.lease, state.wallet.license_id, state.identity.device_id);
                    if (clock.UtcNow >= Unix(grant.exp)) return "Expired - reserved tokens retained for reconciliation";
                    if (state.sync_due == null || clock.UtcNow >= Parse(state.sync_due)) return "Unavailable - periodic sync required";
                    return state.remaining > 0 ? "Usable under signed policy" : "Exhausted - sync required";
                } catch (System.Exception) { return "Unavailable - lease verification required"; }
            }
        }
        public string History(string cursor) {
            lock (gate) {
                CheckStorage(); if (state.identity == null) throw new InvalidOperationException("Connect account first.");
                try { return api.History(state.secret, cursor); }
                catch (ApiException ex) { if (ex.Status == 401 || ex.Status == 403) { state.blocked = true; Persist(); Status = "ACCESS BLOCKED — offline usage stopped"; } throw; }
            }
        }
    }
}
