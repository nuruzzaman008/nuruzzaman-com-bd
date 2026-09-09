using System;
using System.IO;
using System.Net;
using System.Text;
using System.Reflection;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using Autodesk.AutoCAD.Runtime;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;
[assembly: ExtensionApplication(typeof(NBOnline.Connector))]
[assembly: CommandClass(typeof(NBOnline.Connector))]
namespace NBOnline {
 public class Connector : IExtensionApplication {
  const string Api = "https://api.nuruzzaman.com.bd/api/v1/licensing/";
  const string Site = "https://nuruzzaman.com.bd/connect-autocad";
  static System.Windows.Forms.Timer timer;
  static bool busy;
  static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
  static string SecretPath { get {return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"NBEngineeringTools","online-device.dpapi");} }
  static Type Runtime(string name) {
   foreach(var assembly in AppDomain.CurrentDomain.GetAssemblies()) {
    if(assembly.GetName().Name == "NBCommercialSecurity") return assembly.GetType("NBEngineeringTools.Security."+name,true);
   }
   throw new InvalidOperationException("Load the installed NB Engineering Tools security runtime first.");
  }
  static object Call(string type,string method,params object[] args) {return Runtime(type).GetMethod(method,BindingFlags.Public|BindingFlags.Static).Invoke(null,args);}
  static string Secret() {return Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(SecretPath),null,DataProtectionScope.CurrentUser));}
  static Dictionary<string,object> Request(string route,object body,string secret) {
   using(var client=new BoundedClient()) {
    client.Encoding=Encoding.UTF8;
    client.Headers[HttpRequestHeader.Accept]="application/json";
    client.Headers[HttpRequestHeader.ContentType]="application/json";
    if(secret!=null) client.Headers[HttpRequestHeader.Authorization]="Bearer "+secret;
    var raw=body==null ? client.DownloadString(Api+route) : client.UploadString(Api+route,Json.Serialize(body));
    return Json.Deserialize<Dictionary<string,object>>(raw);
   }
  }
  public void Initialize() {
   ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
   timer=new System.Windows.Forms.Timer {Interval=15000};
   timer.Tick += delegate {if(File.Exists(SecretPath)) Sync();};
   timer.Start();
  }
  public void Terminate() {if(timer!=null) timer.Dispose();}
  [CommandMethod("NBONLINECONNECT")]
  public void Connect() {
   try {
    var machine=(string)Call("MachineFingerprint","GetMachineId");
    var data=(Dictionary<string,object>)Request("pair",new {machine_id=machine},null)["data"];
    Directory.CreateDirectory(Path.GetDirectoryName(SecretPath));
    if(File.Exists(SecretPath)) File.Copy(SecretPath,SecretPath+".backup."+DateTime.UtcNow.Ticks);
    File.WriteAllBytes(SecretPath,ProtectedData.Protect(Encoding.UTF8.GetBytes((string)data["secret"]),null,DataProtectionScope.CurrentUser));
    System.Diagnostics.Process.Start(Site+"#code="+Uri.EscapeDataString((string)data["code"]));
    Write("Sign in to your website account, select your purchased license and confirm this computer.");
   } catch {Write("Connection failed. Check the installed security runtime and website availability.");}
  }
  [CommandMethod("NBONLINESYNC")]
  public void Sync() {
   if(busy) return;
   busy=true;
   try {
    var secret=Secret();
    var data=(Dictionary<string,object>)Request("delivery",null,secret)["data"];
    foreach(var entry in (System.Collections.IEnumerable)data["issues"]) {
     var issue=(Dictionary<string,object>)entry;
     var token=(string)issue["token"];
     var parts=token.Split('.');
     var encoded=parts[1].Replace('-','+').Replace('_','/');
     encoded=encoded.PadRight((encoded.Length+3)/4*4,'=');
     var payload=Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Convert.FromBase64String(encoded)));
     Call("WalletStore","EnsureLoaded");
     var wallet=Runtime("WalletStore").GetProperty("Current").GetValue(null,null);
     bool activated=(bool)wallet.GetType().GetProperty("Activated").GetValue(wallet,null);
     string license=(string)wallet.GetType().GetProperty("LicenseId").GetValue(wallet,null);
     bool applied=false;
     if(parts[0]=="NB2A" && activated) {
      if(license!=(string)payload["lic"]) throw new InvalidOperationException("Existing offline license requires an owner-approved migration.");
      applied=true; // Never reapply activation and reset an existing balance.
     } else if(parts[0]=="NB2T") {
      var ids=(IEnumerable<string>)wallet.GetType().GetProperty("AppliedRefillIds").GetValue(wallet,null);
      foreach(var id in ids) if(id==(string)payload["rid"]) applied=true;
     }
     if(!applied) {
      object[] args={token,null};
      applied=(bool)Call("WalletStore",parts[0]=="NB2A" ? "Activate" : "ApplyRefill",args);
     }
     if(!applied) throw new InvalidOperationException("Security runtime rejected the token.");
     Request("acknowledge",new {id=issue["id"]},secret);
     Write("Purchased license/tokens synchronized.");
    }
   } catch { /* Never log tokens or machine identifiers. Retry on the next timer tick. */ }
   finally {busy=false;}
  }
  static void Write(string text) {var doc=AcApp.DocumentManager.MdiActiveDocument;if(doc!=null) doc.Editor.WriteMessage("\nNB Online: "+text);}
  sealed class BoundedClient : WebClient {
   protected override WebRequest GetWebRequest(Uri address) {
    var request=base.GetWebRequest(address); request.Timeout=5000;
    var http=request as HttpWebRequest; if(http!=null) http.ReadWriteTimeout=5000;
    return request;
   }
  }
 }
}
