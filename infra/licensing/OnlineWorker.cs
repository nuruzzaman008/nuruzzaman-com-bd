// Compile alongside the owner's original NBKG.cs. Never ship this worker to customers.
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Threading;
namespace NBEngineeringTools.VendorKeyGenerator {
  internal static class OnlineWorker {
    public static int Main(string[] args) {
      if(args.Length != 1) { Console.Error.WriteLine("Supply a private worker config JSON file."); return 1; }
      var js = new JavaScriptSerializer();
      var config = js.Deserialize<Dictionary<string,string>>(File.ReadAllText(args[0]));
      var endpoint = new Uri(config["api"]);
      if(endpoint.Scheme != "https" || endpoint.Host != "api.nuruzzaman.com.bd") throw new Exception("Only the production HTTPS API is allowed.");
      ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
      while(true) {
        try {
          using(var client = new WebClient()) {
            client.Encoding = Encoding.UTF8;
            client.Headers[HttpRequestHeader.Authorization] = "Bearer " + config["credential"];
            client.Headers[HttpRequestHeader.Accept] = "application/json";
            var response = js.Deserialize<QueueResponse>(client.DownloadString(config["api"].TrimEnd('/') + "/licensing/worker/pending"));
            foreach(var job in response.data) {
              var p = job.payload;
              if(p.v != 2 || p.tokens < 1 || p.tokens > 1000000 || (p.type != "ACTIVATION" && p.type != "TOKEN_REFILL")) throw new Exception("Invalid signing job.");
              string token;
              // Existing DPAPI identity only: never initialize, rotate or export the signing key.
              using(var key = CryptoStore.LoadPrivate()) token = CryptoStore.SignPayload(p.type == "ACTIVATION" ? "NB2A" : "NB2T", p, key);
              client.Headers[HttpRequestHeader.ContentType] = "application/json";
              client.UploadString(config["api"].TrimEnd('/') + "/licensing/worker/complete", js.Serialize(new {id=job.id,token=token}));
              Console.WriteLine("Signing job completed: " + job.id);
            }
          }
        } catch { Console.Error.WriteLine("Worker request failed; retrying. Inspect private configuration. No secrets logged."); }
        Thread.Sleep(10000);
      }
    }
    public sealed class QueueResponse { public List<Job> data {get;set;} }
    public sealed class Job { public long id {get;set;} public SignedPayload payload {get;set;} }
  }
}
