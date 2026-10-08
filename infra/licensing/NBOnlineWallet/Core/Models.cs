using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace NBOnlineWallet {
    public static class Json {
        public static string Write(object value) { return new JavaScriptSerializer().Serialize(value); }
        public static T Read<T>(string value) { return new JavaScriptSerializer().Deserialize<T>(value); }
    }
    public class Envelope<T> { public T data { get; set; } }
    public class Identity { public string email { get; set; } public string license_code { get; set; } public int device_id { get; set; } }
    public class Wallet { public int license_id { get; set; } public int available_balance { get; set; } public int reserved_balance { get; set; } public int version { get; set; } public string status { get; set; } }
    public class Balance { public Wallet wallet { get; set; } public Identity identity { get; set; } public string server_time { get; set; } public string last_sync_at { get; set; } }
    public class Price { public int cost { get; set; } public bool daily { get; set; } }
    public class Policy { public int sync_interval_seconds { get; set; } }
    public class Snapshot { public Policy policy { get; set; } public Dictionary<string, Price> commands { get; set; } public string billing_day { get; set; } }
    public class Grant { public string iss { get; set; } public string aud { get; set; } public long iat { get; set; } public long exp { get; set; } public long sync_due_at { get; set; } public string jti { get; set; } public int license_id { get; set; } public int device_id { get; set; } public int allowance { get; set; } public Snapshot policy { get; set; } }
    public class Lease { public string id { get; set; } public int device_id { get; set; } public int allowance { get; set; } public string grant { get; set; } }
    public class Connection { public Wallet wallet { get; set; } public Lease lease { get; set; } }
    public class ConnectRequest { public string request_id { get; set; } public int expected_version { get; set; } public int requested_allowance { get; set; } }
    public class Usage { public string transaction_id { get; set; } public int sequence { get; set; } public string command { get; set; } public int units { get; set; } public string occurred_at { get; set; } }
    public class JournalEntry { public Usage usage { get; set; } public int device_id { get; set; } public int license_id { get; set; } public int token_amount { get; set; } public string state { get; set; } public string lease_id { get; set; } }
    public class SyncRequest { public string request_id { get; set; } public string lease_id { get; set; } public int expected_version { get; set; } public Usage[] transactions { get; set; } }
    public class SyncResponse { public string request_id { get; set; } public string status { get; set; } public string[] accepted_transaction_ids { get; set; } public int last_sequence { get; set; } public Wallet wallet { get; set; } public int lease_remaining { get; set; } public string server_time { get; set; } }
    public class Pair { public string secret { get; set; } public string code { get; set; } }
    public class HistoryRow { public string transaction_id { get; set; } public string type { get; set; } public int amount { get; set; } public string source { get; set; } public string created_at { get; set; } }
    public class HistoryMeta { public string next_cursor { get; set; } }
    public class HistoryPage { public HistoryRow[] data { get; set; } public HistoryMeta meta { get; set; } }
    public class State {
        public int schema { get; set; }
        public string installation_id { get; set; }
        public string secret { get; set; }
        public string pairing_code { get; set; }
        public string pairing_started { get; set; }
        public Identity identity { get; set; }
        public Wallet wallet { get; set; }
        public Lease lease { get; set; }
        public ConnectRequest connect_request { get; set; }
        public SyncRequest in_flight { get; set; }
        public List<JournalEntry> journal { get; set; }
        public int remaining { get; set; }
        public int sequence { get; set; }
        public string last_server_time { get; set; }
        public string last_sync { get; set; }
        public string last_local_time { get; set; }
        public string sync_due { get; set; }
        public bool suspicious { get; set; }
        public bool blocked { get; set; }
        public bool review_required { get; set; }
        public State() { schema = 1; installation_id = Guid.NewGuid().ToString("N"); journal = new List<JournalEntry>(); }
    }
    public interface IStore { State Load(); void Save(State value); }
    public interface IClock { DateTime UtcNow { get; } long MonotonicMilliseconds { get; } }
    public class Clock : IClock {
        private readonly System.Diagnostics.Stopwatch watch = System.Diagnostics.Stopwatch.StartNew();
        public DateTime UtcNow { get { return DateTime.UtcNow; } }
        public long MonotonicMilliseconds { get { return watch.ElapsedMilliseconds; } }
    }
}
