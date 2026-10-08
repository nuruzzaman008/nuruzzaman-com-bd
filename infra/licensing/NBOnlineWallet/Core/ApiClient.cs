using System;
using System.IO;
using System.Net;
using System.Text;

namespace NBOnlineWallet {
    public interface IWalletApi {
        Pair Pair(string machine);
        Balance Balance(string secret);
        Connection Connect(string secret, ConnectRequest request);
        SyncResponse Sync(string secret, SyncRequest request);
        string History(string secret, string cursor);
    }
    public class ApiException : Exception {
        public readonly int Status;
        public ApiException(int status) : base("Wallet server returned HTTP " + status) { Status = status; }
    }
    public sealed class ApiClient : IWalletApi {
        private readonly Uri origin;
        public ApiClient(string origin) {
            this.origin = new Uri(origin);
            if (this.origin.Scheme != "https" || !string.IsNullOrEmpty(this.origin.UserInfo) || this.origin.AbsolutePath != "/") throw new ArgumentException("API origin must be an HTTPS origin.");
        }
        private string Request(string path, string secret, object body) {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            var request = (HttpWebRequest)WebRequest.Create(new Uri(origin, path));
            request.AllowAutoRedirect = false; request.Timeout = 12000; request.ReadWriteTimeout = 12000;
            request.Accept = "application/json";
            if (secret != null) request.Headers[HttpRequestHeader.Authorization] = "Bearer " + secret;
            if (body != null) {
                request.Method = "POST"; request.ContentType = "application/json";
                var bytes = Encoding.UTF8.GetBytes(Json.Write(body)); request.ContentLength = bytes.Length;
                using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
            }
            try {
                using (var response = (HttpWebResponse)request.GetResponse()) {
                    if ((int)response.StatusCode != 200) throw new ApiException((int)response.StatusCode);
                    using (var reader = new StreamReader(response.GetResponseStream())) {
                        var buffer = new char[4096]; var text = new StringBuilder(); int n;
                        while ((n = reader.Read(buffer, 0, buffer.Length)) > 0) { text.Append(buffer, 0, n); if (text.Length > 2000000) throw new InvalidDataException("Response too large."); }
                        return text.ToString();
                    }
                }
            } catch (WebException ex) { var response = ex.Response as HttpWebResponse; if (response != null) { int status = (int)response.StatusCode; response.Dispose(); throw new ApiException(status); } throw new IOException("Server unavailable; pending usage is retained.", ex); }
        }
        public Pair Pair(string machine) { return Json.Read<Envelope<Pair>>(Request("/api/v1/licensing/pair", null, new { machine_id = machine })).data; }
        public Balance Balance(string secret) { return Json.Read<Envelope<Balance>>(Request("/api/wallet/balance", secret, null)).data; }
        public Connection Connect(string secret, ConnectRequest request) { return Json.Read<Envelope<Connection>>(Request("/api/wallet/connect", secret, request)).data; }
        public SyncResponse Sync(string secret, SyncRequest request) { return Json.Read<Envelope<SyncResponse>>(Request("/api/wallet/sync", secret, request)).data; }
        public string History(string secret, string cursor) { return Request("/api/wallet/history?limit=100" + (cursor == null ? "" : "&cursor=" + Uri.EscapeDataString(cursor)), secret, null); }
    }
}
