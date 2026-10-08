using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Diagnostics;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyVersion("0.6.3.0")]
[assembly: AssemblyFileVersion("0.6.3.0")]
[assembly: AssemblyProduct("NB Online Wallet AutoCAD 2024 Setup")]
namespace NBOnlineWallet.Setup {
    internal static class Program {
        const string Bundle = "NBOnlineWallet.bundle";
        static string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Autodesk", "ApplicationPlugins");
        static string Target = Path.Combine(Root, Bundle);
        static string Data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NBOnlineWallet", "installer");
        const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\NBOnlineWallet";
        static Dictionary<string,string> Hashes;
        static string Hash(string path) { using(var sha=SHA256.Create()) using(var file=File.OpenRead(path)) return BitConverter.ToString(sha.ComputeHash(file)).Replace("-", ""); }
        static void Log(string text) { Directory.CreateDirectory(Data); File.AppendAllText(Path.Combine(Data,"install.log"),DateTime.UtcNow.ToString("o")+" "+text+Environment.NewLine); }
        static string Safe(string root,string relative) {
            if(Path.IsPathRooted(relative) || relative.Contains(":")) throw new IOException("Invalid package path");
            var result=Path.GetFullPath(Path.Combine(root,relative.Replace('/',Path.DirectorySeparatorChar)));
            if(!result.StartsWith(Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)) throw new IOException("Package path escapes destination");
            return result;
        }
        static void NoLinks(string path) {
            if(!Directory.Exists(path)) return;
            if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0) throw new IOException("Reparse-point installation paths are not supported: "+path);
            foreach(var item in Directory.GetFileSystemEntries(path)) {
                if((File.GetAttributes(item)&FileAttributes.ReparsePoint)!=0) throw new IOException("Reparse point inside installation: "+item);
                if(Directory.Exists(item)) NoLinks(item);
            }
        }
        static void Parents(string path) { for(var p=new DirectoryInfo(path);p!=null;p=p.Parent) if(p.Exists&&(p.Attributes&FileAttributes.ReparsePoint)!=0) throw new IOException("Reparse-point parent is not supported: "+p.FullName); }
        static void ReadHashes() {
            Hashes=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.sha256")) using(var reader=new StreamReader(stream)) {
                string line; while((line=reader.ReadLine())!=null) {if(line.Length<67)throw new IOException("Invalid package hash manifest"); var name=line.Substring(66); Safe(Path.GetTempPath(),name); Hashes.Add(name,line.Substring(0,64));}
            }
        }
        static void Extract(string stage) {
            Directory.CreateDirectory(stage);
            using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")) using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)) foreach(var entry in zip.Entries) {
                if(entry.FullName.EndsWith("/"))continue;
                if(!Hashes.ContainsKey(entry.FullName))throw new IOException("Unexpected package file: "+entry.FullName);
                var dest=Safe(stage,entry.FullName); Directory.CreateDirectory(Path.GetDirectoryName(dest));
                using(var source=entry.Open())using(var file=new FileStream(dest,FileMode.CreateNew)) source.CopyTo(file);
            }
            Verify(stage,null);
        }
        static void Verify(string dir,string preservedConfigHash) {
            foreach(var item in Hashes) {
                var expected=item.Key=="Contents/Win64/wallet.config.json" && preservedConfigHash!=null?preservedConfigHash:item.Value;
                if(!File.Exists(Safe(dir,item.Key)) || !Hash(Safe(dir,item.Key)).Equals(expected,StringComparison.OrdinalIgnoreCase))throw new IOException("Installed SHA256 mismatch: "+item.Key);
            }
            if(Directory.GetFiles(dir,"*",SearchOption.AllDirectories).Length!=Hashes.Count)throw new IOException("Unexpected installed files");
        }
        static void Preflight() {
            if(!Environment.Is64BitOperatingSystem)throw new IOException("Windows x64 required");
            if(Process.GetProcessesByName("acad").Length!=0)throw new IOException("Close every AutoCAD window before installing or uninstalling. No loaded DLL was replaced.");
            using(var baseKey=RegistryKey.OpenBaseKey(RegistryHive.LocalMachine,RegistryView.Registry64)) using(var cad=baseKey.OpenSubKey(@"SOFTWARE\Autodesk\AutoCAD\R24.3")) {
                if(cad==null || cad.GetSubKeyNames().Length==0)throw new IOException("AutoCAD 2024 (R24.3) was not detected.");
            }
            Parents(Root); Parents(Data); NoLinks(Target);
            // A second root must be resolved explicitly; never modify other Autodesk plugins.
            foreach(var root in new[]{Root,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"Autodesk","ApplicationPlugins"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Autodesk","ApplicationPlugins"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Autodesk","ApplicationPlugins")}) {
                if(!Directory.Exists(root))continue;
                foreach(var dir in Directory.GetDirectories(root)) {
                    if(dir.Equals(Target,StringComparison.OrdinalIgnoreCase))continue;
                    var manifest=Path.Combine(dir,"PackageContents.xml");
                    if(Path.GetFileName(dir).StartsWith("NBOnlineWallet",StringComparison.OrdinalIgnoreCase) || (File.Exists(manifest) && File.ReadAllText(manifest).Contains("Name=\"NBOnlineWallet\"")))throw new IOException("Duplicate/stale installation found. Move it outside ApplicationPlugins after review: "+dir);
                }
            }
            if(Directory.Exists(Target)) {
                var manifest=Path.Combine(Target,"PackageContents.xml");
                if(!File.Exists(manifest)||!File.ReadAllText(manifest).Contains("Name=\"NBOnlineWallet\""))throw new IOException("Existing target is not an identified NBOnlineWallet bundle; refusing replacement.");
                if(Directory.GetFiles(Target,"NBCommercialSecurity*",SearchOption.AllDirectories).Length!=0)throw new IOException("Legacy files found in target; refusing to touch them.");
            }
        }
        static void ValidateConfig(string file) {
            var json=new System.Web.Script.Serialization.JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(file));
            foreach(var name in new[]{"api_origin","website_origin"}) {
                Uri uri; if(!json.ContainsKey(name)||!Uri.TryCreate(Convert.ToString(json[name]),UriKind.Absolute,out uri)||(uri.AbsoluteUri.TrimEnd('/')!="https://localhost:13443" && uri.AbsoluteUri.TrimEnd('/')!="https://nuruzzaman.com.bd")||!string.IsNullOrEmpty(uri.UserInfo))throw new IOException("Only the approved staging or production origin is accepted.");
            }
            if(Convert.ToString(json["api_origin"]).TrimEnd('/') != Convert.ToString(json["website_origin"]).TrimEnd('/'))throw new IOException("Mixed environments are forbidden.");
            if(Convert.ToString(json["api_origin"]).TrimEnd('/')=="https://nuruzzaman.com.bd" && Convert.ToBoolean(json["allow_pilot_usage"]))throw new IOException("Pilot usage must be disabled in production.");
            var key=Convert.ToString(json["public_key_xml"]); var doc=new System.Xml.XmlDocument(); doc.XmlResolver=null; doc.LoadXml(key);
            if(doc.DocumentElement.Name!="RSAKeyValue" || doc.DocumentElement.ChildNodes.Count!=2 || doc.SelectSingleNode("/RSAKeyValue/Modulus")==null || doc.SelectSingleNode("/RSAKeyValue/Exponent")==null)throw new IOException("Only a public RSA signing key is permitted");
            using(var rsa=new RSACryptoServiceProvider()){rsa.PersistKeyInCsp=false;rsa.FromXmlString(key);if(rsa.KeySize<2048)throw new IOException("RSA key is too short");}
            if(string.IsNullOrWhiteSpace(Convert.ToString(json["signing_key_id"])))throw new IOException("Signing public key ID missing");
        }
        static string Install() {
            Preflight(); ReadHashes(); Directory.CreateDirectory(Root); Directory.CreateDirectory(Data);
            var id=DateTime.UtcNow.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N").Substring(0,8);
            var stage=Path.Combine(Data,"stage-"+id); var backup=Path.Combine(Data,"backups",id,Bundle);
            Extract(stage); string configHash=null;
            if(Directory.Exists(Target)) {
                var config=Path.Combine(Target,"Contents","Win64","wallet.config.json");
                if(File.Exists(config)) {
                    ValidateConfig(config);
                    var embedded=Path.Combine(stage,"Contents","Win64","wallet.config.json");
                    var serializer=new System.Web.Script.Serialization.JavaScriptSerializer();
                    var oldConfig=serializer.Deserialize<Dictionary<string,object>>(File.ReadAllText(config));
                    var newConfig=serializer.Deserialize<Dictionary<string,object>>(File.ReadAllText(embedded));
                    if(Convert.ToString(oldConfig["api_origin"]).TrimEnd('/')==Convert.ToString(newConfig["api_origin"]).TrimEnd('/')) {
                        if(Convert.ToString(oldConfig["public_key_xml"])!=Convert.ToString(newConfig["public_key_xml"]) || Convert.ToString(oldConfig["signing_key_id"])!=Convert.ToString(newConfig["signing_key_id"]))throw new IOException("Signing key change requires a separately reviewed migration; existing configuration retained.");
                        File.Copy(config,embedded,true);configHash=Hash(config);
                    } else {
                        if(!Environment.GetCommandLineArgs().Contains("--switch-environment"))throw new IOException("This package targets a different environment. Use --switch-environment explicitly. Existing bundle and journal were not changed.");
                        Log("Explicit environment switch; previous configuration retained in bundle backup. Origin-specific journals remain separate.");
                    }
                }
            }
            ValidateConfig(Path.Combine(stage,"Contents","Win64","wallet.config.json")); Verify(stage,configHash);
            bool moved=false, activated=false;
            try {
                if(Directory.Exists(Target)){Directory.CreateDirectory(Path.GetDirectoryName(backup));Directory.Move(Target,backup);moved=true;Log("Existing bundle backed up: "+backup);}
                Directory.Move(stage,Target);activated=true;Verify(Target,configHash);
                var setup=Path.Combine(Data,"NBOnlineWallet-0.6.3-Setup.exe");
                if(!Assembly.GetExecutingAssembly().Location.Equals(setup,StringComparison.OrdinalIgnoreCase)) File.Copy(Assembly.GetExecutingAssembly().Location,setup,true);
                using(var key=Registry.CurrentUser.CreateSubKey(UninstallKey)) {
                    key.SetValue("DisplayName","NB Online Wallet 0.6.3 (AutoCAD 2024)"); key.SetValue("DisplayVersion","0.6.3");key.SetValue("Publisher","NB Engineering Tools");key.SetValue("InstallLocation",Target);key.SetValue("UninstallString","\""+setup+"\" --uninstall");key.SetValue("NoModify",1);key.SetValue("NoRepair",1);
                }
                var report=string.Join(Environment.NewLine,Hashes.Keys.Select(p=>Hash(Safe(Target,p))+"  "+p));
                File.WriteAllText(Path.Combine(Data,"installed-sha256.txt"),report);Log("Installed 0.6.3 and verified all SHA256 hashes: "+Target);
                return "Installed successfully at:\n"+Target+"\n\nStart AutoCAD 2024 normally. NETLOAD is not required. Run NBWSTATUS to inspect startup.\n\nJournal and legacy NB Tools were not changed. Global security/autoload settings were not changed.\nBackup: "+(moved?backup:"Clean installation");
            } catch {
                if(activated&&Directory.Exists(Target)){var failed=Path.Combine(Data,"failed-"+id);Directory.Move(Target,failed);}
                if(moved&&!Directory.Exists(Target))Directory.Move(backup,Target);
                Log("Installation failed; bundle rollback attempted. No journal changes.");throw;
            }
        }
        static string Uninstall() {
            Preflight(); if(!Directory.Exists(Target))return "NBOnlineWallet is not installed.";
            Directory.CreateDirectory(Data);var backup=Path.Combine(Data,"uninstalled-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N"),Bundle);Directory.CreateDirectory(Path.GetDirectoryName(backup));Directory.Move(Target,backup);
            // Remove only this product's Add/Remove Programs registration; never Autodesk/legacy entries.
            Registry.CurrentUser.DeleteSubKeyTree(UninstallKey,false); Log("Uninstalled bundle retained at "+backup);
            return "Uninstalled NBOnlineWallet only. Journal, configuration backup and legacy tools retained.\n"+backup;
        }
        [STAThread] static int Main(string[] args) {
            Application.EnableVisualStyles(); bool quiet=args.Contains("--quiet");
            try {
                if(args.Contains("--verify-package")) {ReadHashes(); using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)) { if(zip.Entries.Count!=Hashes.Count)throw new IOException("Payload count mismatch"); foreach(var e in zip.Entries){using(var sha=SHA256.Create())using(var data=e.Open()){if(!Hashes.ContainsKey(e.FullName)||BitConverter.ToString(sha.ComputeHash(data)).Replace("-","")!=Hashes[e.FullName])throw new IOException("Payload hash mismatch");}}} return 0;}
                bool uninstall=args.Contains("--uninstall");
                if(!quiet && MessageBox.Show((uninstall?"Uninstall":"Install")+" NB Online Wallet 0.6.3 for this Windows user?\nClose AutoCAD first. Existing installation will be backed up. Local wallet journal and NB Engineering Tools will not be changed.","NB Online Wallet Setup",MessageBoxButtons.OKCancel,MessageBoxIcon.Information)!=DialogResult.OK)return 2;
                var result=uninstall?Uninstall():Install(); if(!quiet)MessageBox.Show(result,"NB Online Wallet Setup",MessageBoxButtons.OK,MessageBoxIcon.Information); return 0;
            } catch(Exception ex) {try{Log("FAILED: "+ex.GetType().Name+": "+ex.Message);}catch{} if(!quiet)MessageBox.Show(ex.Message,"NB Online Wallet Setup failed",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
        }
    }
}
