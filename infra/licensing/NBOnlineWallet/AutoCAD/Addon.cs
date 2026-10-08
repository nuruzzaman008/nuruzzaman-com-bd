using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Windows.Forms;
using Autodesk.AutoCAD.Runtime;
using Autodesk.Windows;
using Microsoft.Win32;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

[assembly: ExtensionApplication(typeof(NBOnlineWallet.Addon))]
[assembly: CommandClass(typeof(NBOnlineWallet.Addon))]
namespace NBOnlineWallet {
    public class Settings {
        public string api_origin { get; set; }
        public string website_origin { get; set; }
        public string signing_key_id { get; set; }
        public string public_key_xml { get; set; }
        public int offline_allowance { get; set; }
        public bool allow_pilot_usage { get; set; }
    }
    public sealed class Addon : IExtensionApplication {
        private static WalletEngine engine;
        private static EncryptedStore store;
        private static Settings settings;
        private static Timer timer;
        private static bool busy;
        private static Task operation;
        private static Action completion;
        private static SyncSchedule schedule;
        private static Form window;
        private static Label summary;
        private static Label activity;
        private static ProgressBar progress;
        private static Button syncButton;
        private static string operationName;
        private static string activityText = "Ready";
        private static RibbonTab tab;
        private static string failure = "Initialization has not completed";
        private static string journalFolder = "Not resolved";
        private static string logFailure;
        private static string ConfigPath { get { return Path.Combine(Path.GetDirectoryName(typeof(Addon).Assembly.Location), "wallet.config.json"); } }
        private static string LogFolder { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NBOnlineWallet", "logs"); } }
        private static void Log(string message) {
            try { Directory.CreateDirectory(LogFolder); File.AppendAllText(Path.Combine(LogFolder, "startup-" + DateTime.UtcNow.ToString("yyyyMMdd") + ".log"), DateTime.UtcNow.ToString("o") + " pid=" + System.Diagnostics.Process.GetCurrentProcess().Id + " " + message + Environment.NewLine); logFailure = null; } catch (System.Exception ex) { logFailure = SafeError(ex); /* Report via NBWSTATUS without changing the journal. */ }
        }
        private static string SafeError(System.Exception ex) {
            var message = ex.GetType().Name + ": " + ex.Message;
            if (settings != null) foreach (var value in new[] { settings.public_key_xml, settings.signing_key_id }) if (!string.IsNullOrEmpty(value)) message = message.Replace(value, "[redacted]");
            return System.Text.RegularExpressions.Regex.Replace(message, @"(?i)(password|secret|token|authorization)\s*[:=]\s*\S+", "$1=[redacted]");
        }
        private static string Origin() { Uri uri; return settings != null && Uri.TryCreate(settings.api_origin, UriKind.Absolute, out uri) ? uri.GetLeftPart(UriPartial.Authority) : "not configured"; }
        public void Initialize() {
            Log("Initialization started; AutoCAD=" + typeof(AcApp).Assembly.GetName().Version + "; DLL version=" + typeof(Addon).Assembly.GetName().Version + "; DLL=" + typeof(Addon).Assembly.Location + "; bundle=" + Path.GetFullPath(Path.Combine(Path.GetDirectoryName(typeof(Addon).Assembly.Location), "../..")) + "; config=" + ConfigPath);
            AcApp.Idle -= Idle; AcApp.Idle += Idle;
            if (engine != null) { Log("Already initialized; reused"); return; }
            try {
                var path = ConfigPath;
                if (!File.Exists(path)) throw new InvalidOperationException("Configure wallet.config.json from the supplied example before loading.");
                settings = Json.Read<Settings>(File.ReadAllText(path));
                Log("Configuration loaded; API origin=" + Origin());
                var verifier = new GrantVerifier(settings.signing_key_id, settings.public_key_xml);
                verifier.EnsureConfigured(); Log("Signing public key loaded (value omitted)");
                if (settings.offline_allowance < 1 || settings.offline_allowance > 1000000) throw new InvalidOperationException("Invalid configured allowance.");
                string profile;
                using (var sha = SHA256.Create()) profile = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(new Uri(settings.api_origin).GetLeftPart(UriPartial.Authority).ToLowerInvariant()))).Replace("-", "").Substring(0, 16);
                var localData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                if (string.IsNullOrWhiteSpace(localData) || !Path.IsPathRooted(localData)) throw new InvalidOperationException("Local application data folder is unavailable; no relative wallet path is allowed.");
                journalFolder = Path.Combine(localData, "NBOnlineWallet", profile);
                Log("Journal folder=" + journalFolder);
                store = new EncryptedStore(journalFolder, @"Software\NBOnlineWallet\" + profile);
                engine = new WalletEngine(store, new ApiClient(settings.api_origin), new Clock(), verifier);
                failure = null; Log("Wallet engine initialized");
                schedule = new SyncSchedule(new Clock());
                timer = new Timer { Interval = 500 };
                timer.Tick += delegate {
                    // All Autodesk/UI calls stay on AutoCAD's UI thread, even when it has no async context.
                    if (operation != null && operation.IsCompleted) {
                        var finished = operation; operation = null; busy = false;
                        if (finished.IsFaulted) { activityText = "Operation failed. " + SafeError(finished.Exception.GetBaseException()) + " Journal retained."; Write(activityText); Log(operationName + " failed: " + SafeError(finished.Exception.GetBaseException())); }
                        else if (completion != null) { try { completion(); } catch (System.Exception ex) { Write("Window update failed: " + ex.Message); } }
                        completion = null; Refresh();
                        schedule.AttemptCompleted();
                    }
                    if (busy && activity != null && !activity.IsDisposed) activity.Text = operationName + " — " + (operationName.Contains("sync") ? engine.SyncStage : "Please wait…");
                    if (!busy && schedule.Due) { schedule.AttemptCompleted(); StartSync(false); }
                };
                timer.Start();
                Write("NB Online Wallet loaded. NBWACCOUNT connects; NBWWALLET opens wallet. Existing tool commands are unchanged.");
            } catch (System.Exception ex) { engine = null; if (store != null) { store.Dispose(); store = null; } failure = SafeError(ex); Log("Initialization failed: " + failure); Write("Addon not initialized. Reason: " + failure + ". Preserve journal. See: " + LogFolder); }
        }
        private static void Idle(object sender, EventArgs args) {
            try { EnsureRibbon(); } catch (System.Exception ex) { var reason = SafeError(ex); if (reason != ribbonFailure) { ribbonFailure = reason; Log("Ribbon initialization failed: " + reason); } }
        }
        private static string ribbonFailure;
        private static void EnsureRibbon() {
            if (ComponentManager.Ribbon == null) return;
            if (tab != null && ComponentManager.Ribbon.Tabs.Contains(tab) && tab.Panels.Sum(p => p.Source.Items.OfType<RibbonButton>().Count()) == 4) return;
            // Workspace reloads must reuse our existing tab, never another vendor's tab.
            var existing = ComponentManager.Ribbon.Tabs.FirstOrDefault(x => x.Id == "NB_ONLINE_WALLET_V1");
            
            Log("Ribbon initialization started");
            tab = existing ?? new RibbonTab { Id = "NB_ONLINE_WALLET_V1", Title = "NB ONLINE" };
            var account = tab.Panels.Select(p => p.Source).FirstOrDefault(p => p.Id == "NBW_ACCOUNT" || p.Title == "ACCOUNT") ?? new RibbonPanelSource { Id = "NBW_ACCOUNT", Title = "ACCOUNT" };
            var wallet = tab.Panels.Select(p => p.Source).FirstOrDefault(p => p.Id == "NBW_WALLET" || p.Title == "WALLET & TOKENS") ?? new RibbonPanelSource { Id = "NBW_WALLET", Title = "WALLET & TOKENS" };
            foreach (var item in new[] { new[] { "Connect\nAccount", "NBWACCOUNT", "account" }, new[] { "Wallet", "NBWWALLET", "wallet" }, new[] { "Sync Now", "NBWSYNC", "sync" }, new[] { "Transaction\nHistory", "NBWHISTORY", "history" } }) {
                var panel = item[1] == "NBWACCOUNT" ? account : wallet;
                if (panel.Items.OfType<RibbonButton>().Any(b => Convert.ToString(b.CommandParameter) == item[1])) continue;
                var icon = Icon(item[2]);
                (item[1] == "NBWACCOUNT" ? account : wallet).Items.Add(new RibbonButton {
                    Text = item[0], ShowText = true, ShowImage = true, Image = icon, LargeImage = icon,
                    Size = RibbonItemSize.Large, Orientation = System.Windows.Controls.Orientation.Vertical,
                    CommandParameter = item[1], CommandHandler = new RibbonCommand(),
                    ToolTip = item[0].Replace('\n', ' ') + " — NB Online Wallet"
                });
            }
            if (!tab.Panels.Any(p => p.Source == account)) tab.Panels.Add(new RibbonPanel { Source = account });
            if (!tab.Panels.Any(p => p.Source == wallet)) tab.Panels.Add(new RibbonPanel { Source = wallet });
            if (existing == null) ComponentManager.Ribbon.Tabs.Add(tab);
            ribbonFailure = null; Log("Ribbon initialization completed");
        }
        private static System.Windows.Media.ImageSource Icon(string name) {
            using (var stream = typeof(Addon).Assembly.GetManifestResourceStream("NBOnlineWallet.Ribbon." + name + ".bmp")) {
                if (stream == null) return null;
                var image = new System.Windows.Media.Imaging.BitmapImage();
                image.BeginInit(); image.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                image.StreamSource = stream; image.EndInit(); image.Freeze(); return image;
            }
        }
        public void Terminate() {
            Log("Addon terminating");
            AcApp.Idle -= Idle; if (timer != null) timer.Dispose();
            if (tab != null && ComponentManager.Ribbon != null) ComponentManager.Ribbon.Tabs.Remove(tab);
            if (window != null) window.Dispose();
            // The OS releases the profile lock on exit; do not race an in-flight durable write.
            if (!busy && store != null) store.Dispose();
        }
        [CommandMethod("NBWACCOUNT", CommandFlags.Session)]
        public void Account() {
            if (engine == null) { Wallet(); return; }
            if (busy) { Wallet(); return; }
            var state = engine.View();
            if (state.identity != null || engine.AccountChangeBlockReason() != null) {
                var dialog = new Form { Text = "NB ONLINE — Account connection", Width = 640, Height = 300, Font = new System.Drawing.Font("Segoe UI", 10.5f), StartPosition = FormStartPosition.CenterParent };
                var reason = engine.AccountChangeBlockReason();
                dialog.Controls.Add(new Label { Dock = DockStyle.Fill, Padding = new Padding(16), Text = (state.identity == null ? "Existing wallet state" : "Connected: " + state.identity.email + "\r\nLicense: " + state.identity.license_code) + "\r\n\r\n" + (reason ?? "You may sign in to the website again or explicitly change the paired account.") + "\r\n\r\nWebsite sign-in does not switch the device's wallet. No reserved tokens or journal entries will be discarded." });
                var actions = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 85, Padding = new Padding(10) };
                // A sync never releases reservations. Account changes require server reconciliation.
                AddButton(actions, "Sync Now", delegate { dialog.Tag = "sync"; dialog.Close(); });
                AddButton(actions, new Uri(settings.website_origin).IsLoopback ? "Staging website sign-in" : "Website sign-in", delegate { OpenWebsite(new Uri(new Uri(settings.website_origin), "/login?next=%2Faccount%2Fwallets").AbsoluteUri); });
                if (reason == null) AddButton(actions, "Change account", delegate { dialog.Close(); BeginAccountPair(); });
                AddButton(actions, "Cancel", delegate { dialog.Close(); });
                dialog.Controls.Add(actions); AcApp.ShowModalDialog(dialog);
                // Show the modeless wallet only after AutoCAD has exited the modal dialog.
                if (Equals(dialog.Tag, "sync")) Sync();
                return;
            }
            BeginAccountPair();
        }
        private static void OpenWebsite(string url) {
            try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true }); }
            catch (System.Exception ex) { MessageBox.Show("Unable to open the browser. " + SafeError(ex), "NB ONLINE"); }
        }
        private static void BeginAccountPair() {
            new Addon().Wallet();
            string url = null;
            Run(delegate {
                url = engine.BeginPair(Machine(), settings.website_origin);
            }, delegate { OpenWebsite(url); activityText = "Complete existing website login and select a license, then use Sync Now. Automatic sync also checks confirmation."; Refresh(); Write(activityText); }, "Account connection");
        }
        [CommandMethod("NBWSYNC", CommandFlags.Session)]
        public void Sync() { Wallet(); StartSync(true); }
        private static void StartSync(bool requested) {
            Run(delegate { engine.SyncNow(settings.offline_allowance); }, delegate {
                var successful = engine.Status == "ONLINE";
                activityText = successful ? "Sync completed successfully. Available/reserved values below are from the server." : "Sync not completed: " + engine.Status + ". Journal retained; safe to retry.";
                Log("Sync ended: " + engine.Status); if (requested) Write(activityText);
                if (successful && engine.AccountChangeBlockReason() != null) activityText += " Account change still requires reserve reconciliation.";
            }, requested ? "Wallet sync" : "Automatic sync");
        }
        [CommandMethod("NBWWALLET", CommandFlags.Session)]
        public void Wallet() {
            if (engine == null) { MessageBox.Show("Addon not initialized. Reason: " + failure + ". Preserve journal. See: " + LogFolder, "NB ONLINE"); return; }
            if (window != null && !window.IsDisposed) { if (window.WindowState == FormWindowState.Minimized) window.WindowState = FormWindowState.Normal; window.Show(); window.BringToFront(); window.Activate(); return; }
            window = new Form { Text = "NB Online Wallet — License wallet", Width = 780, Height = 700, MinimumSize = new System.Drawing.Size(780, 700), Font = new System.Drawing.Font("Segoe UI", 10.5f), AutoScaleMode = AutoScaleMode.Dpi };
            summary = new Label { Dock = DockStyle.Fill, Padding = new Padding(20), AutoSize = false };
            activity = new Label { Dock = DockStyle.Top, Height = 70, Padding = new Padding(16, 8, 16, 4), Text = activityText };
            progress = new ProgressBar { Dock = DockStyle.Top, Height = 12, Style = ProgressBarStyle.Marquee, Visible = busy };
            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 60, Padding = new Padding(16, 6, 16, 6) };
            AddButton(buttons, "Connect Account", delegate { Account(); });
            syncButton = new Button { Text = "Sync Now", AutoSize = true, Enabled = !busy }; syncButton.Click += delegate { Sync(); }; buttons.Controls.Add(syncButton);
            AddButton(buttons, "Transaction History", delegate { History(); });
            window.Controls.Add(summary); window.Controls.Add(progress); window.Controls.Add(activity); window.Controls.Add(buttons); Refresh(); AcApp.ShowModelessDialog(window);
        }
        private static void AddButton(FlowLayoutPanel panel, string text, Action action) { var button = new Button { Text = text, AutoSize = true }; button.Click += delegate { action(); }; panel.Controls.Add(button); }
        [CommandMethod("NBWSTATUS", CommandFlags.Session)]
        public void Status() {
            var s = engine == null ? null : engine.View();
            var ribbon = ComponentManager.Ribbon != null && ComponentManager.Ribbon.Tabs.Any(x => x.Id == "NB_ONLINE_WALLET_V1");
            var value = "Addon initialized: " + (engine != null ? "YES" : "NO") + "\nDLL version: " + typeof(Addon).Assembly.GetName().Version + "\nDLL: " + typeof(Addon).Assembly.Location + "\nConfiguration: " + ConfigPath + "\nAPI origin: " + Origin() + "\nAutoCAD: " + AcApp.GetSystemVariable("ACADVER") + "\nAPPAUTOLOAD: " + AcApp.GetSystemVariable("APPAUTOLOAD") + "\nSECURELOAD: " + AcApp.GetSystemVariable("SECURELOAD") + "\nRibbon initialized: " + (ribbon ? "YES" : "NO") + "\nAccount: " + (s != null && s.identity != null ? "Connected" : "Not connected") + "\nLicense status: " + (s == null ? "Unknown" : s.blocked ? "Blocked (last known)" : "Not blocked (last known)") + "\nDevice status: " + (s == null || s.identity == null ? "Unpaired" : s.blocked ? "Blocked/revoked" : "Paired (last verified)") + "\nSync state: " + (busy ? engine.SyncStage : engine == null ? "Unavailable" : engine.Status) + "\nLast sync: " + (s == null ? "Never" : s.last_sync ?? "Never") + "\nReason: " + (failure ?? "None") + "\nLogs: " + LogFolder;
            value += "\nJournal folder: " + journalFolder + "\nDiagnostic log error: " + (logFailure ?? "None");
            Write(value); Log("NBWSTATUS: " + value.Replace('\n', ' '));
        }
        [CommandMethod("NBWHISTORY", CommandFlags.Session)]
        public void History() {
            if (engine == null) { Wallet(); return; }
            if (busy) { MessageBox.Show("A wallet operation is running. Wait for it to finish, then open Transaction History.", "NB ONLINE"); return; }
            var history = new Form { Text = "NB Wallet — Transaction History", Width = 1000, Height = 600 };
            var tabs = new TabControl { Dock = DockStyle.Fill };
            var local = new TabPage("Local journal"); var server = new TabPage("Server ledger");
            var state = engine.View();
            local.Controls.Add(Grid(state.journal.Select(x => new { TimeUTC = x.usage.occurred_at, Command = x.usage.command, TokensEstimated = x.token_amount, State = x.state, Sequence = x.usage.sequence, License = x.license_id, Device = x.device_id, TransactionID = x.usage.transaction_id }).ToArray()));
            if (state.journal.Count == 0) local.Controls.Add(new Label { Dock = DockStyle.Top, Height = 35, Text = "No local transactions found. Server ledger is shown in the other tab." });
            var remoteGrid = Grid(null); server.Controls.Add(remoteGrid);
            var message = new Label { Dock = DockStyle.Top, Height = 48, Text = "Loading transaction history…" };
            var loading = new ProgressBar { Dock = DockStyle.Top, Height = 12, Style = ProgressBarStyle.Marquee };
            var refresh = new Button { Dock = DockStyle.Bottom, Text = "Refresh server history", Height = 35, Enabled = false };
            var older = new Button { Dock = DockStyle.Bottom, Text = "Load older server entries", Enabled = false, Height = 35 };
            tabs.TabPages.Add(local); tabs.TabPages.Add(server); tabs.SelectedTab = server; history.Controls.Add(tabs); history.Controls.Add(loading); history.Controls.Add(message); history.Controls.Add(older); history.Controls.Add(refresh);
            AcApp.ShowModelessDialog(history);
            string cursor = null;
            var rows = new System.Collections.Generic.List<HistoryRow>();
            Action load = delegate {
                refresh.Enabled = false; older.Enabled = false; loading.Visible = true; message.Text = "Loading transaction history…";
                HistoryPage page = null; string error = null;
                Run(delegate { try { page = Json.Read<HistoryPage>(engine.History(cursor)); if (page == null || page.data == null || page.meta == null) throw new InvalidDataException("Invalid history response"); } catch (System.Exception ex) { page = null; Log("History request failed: " + SafeError(ex)); error = "Unable to load transaction history. " + SafeError(ex) + ". Use Refresh to retry; journal retained. Diagnostics: NBWSTATUS."; } }, delegate {
                    if (history.IsDisposed) return;
                    loading.Visible = false; refresh.Enabled = true;
                    if (page == null) { message.Text = error; return; }
                    rows.AddRange(page.data); remoteGrid.DataSource = rows.Select(x => new { DateUTC = x.created_at, TransactionType = x.source + " / " + x.type, Amount = x.amount, License = state.identity == null ? "Unknown" : state.identity.license_code, TransactionID = x.transaction_id }).ToArray(); cursor = page.meta.next_cursor;
                    older.Enabled = cursor != null; message.Text = rows.Count == 0 ? "No transactions found." : "Server ledger: " + rows.Count + " entries. Balances/reasons are not supplied by this history endpoint.";
                    Log("History request completed; rows=" + page.data.Length);
                }, "Transaction history");
            };
            refresh.Click += delegate { if (!busy) { cursor = null; rows.Clear(); load(); } };
            older.Click += delegate { if (!busy) load(); }; load();
        }
        private static DataGridView Grid(object data) { return new DataGridView { DataSource = data, ReadOnly = true, AllowUserToAddRows = false, AllowUserToDeleteRows = false, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.DisplayedCells, Dock = DockStyle.Fill }; }
        [CommandMethod("NBWPILOTUSAGE", CommandFlags.Session)]
        public void PilotUsage() {
            if (engine == null || busy) return;
            var host = new Uri(settings.api_origin).DnsSafeHost;
            if (!settings.allow_pilot_usage || host.Equals("nuruzzaman.com.bd", StringComparison.OrdinalIgnoreCase) || host.EndsWith(".nuruzzaman.com.bd", StringComparison.OrdinalIgnoreCase)) { Write("Pilot usage is disabled. Use only a separate HTTPS test server with disposable test wallets."); return; }
            var doc = AcApp.DocumentManager.MdiActiveDocument; if (doc == null) return;
            var answer = doc.Editor.GetString("\nThis records a real 1-token PCM test debit on the test server. Type YES: ");
            if (answer.Status != Autodesk.AutoCAD.EditorInput.PromptStatus.OK || answer.StringResult != "YES") return;
            Run(delegate { engine.RecordUsage("PCM", 1, Guid.NewGuid().ToString()); });
        }
        private static void Run(Action action, Action completed = null, string name = "Wallet operation") {
            if (engine == null || busy) return;
            busy = true;
            operationName = name; activityText = name + " — Please wait…"; Log(name + " started");
            Refresh();
            completion = completed; operation = Task.Run(action);
        }
        private static void Refresh() {
            if (summary == null || summary.IsDisposed || engine == null) return;
            if (activity != null && !activity.IsDisposed) activity.Text = activityText;
            if (progress != null && !progress.IsDisposed) progress.Visible = busy;
            if (syncButton != null && !syncButton.IsDisposed) syncButton.Enabled = !busy;
            if (busy) { summary.Text = "Synchronizing… Pending transactions remain saved locally."; return; }
            var s = engine.View();
            summary.Text = "Account: " + (s.identity == null ? "Not connected" : s.identity.email) + "\r\nLicense: " + (s.identity == null ? "Select in website after login" : s.identity.license_code) + "\r\nLicense status: " + (s.blocked ? "Access blocked (last verified)" : "Eligible at last successful API check; exact license status not supplied") + "\r\nDevice: " + (s.identity == null ? "Unpaired" : s.identity.device_id + (s.blocked ? " — BLOCKED/REVOKED" : " — paired (last verified)")) + "\r\nStatus: " + engine.Status + "\r\n\r\nAvailable (last server): " + (s.wallet == null ? "—" : s.wallet.available_balance.ToString()) + " tokens\r\nReserved (last server): " + (s.wallet == null ? "—" : s.wallet.reserved_balance.ToString()) + " tokens\r\nRecorded offline allowance: " + s.remaining + " tokens\r\nOffline use: " + engine.OfflineAllowanceStatus() + "\r\nPending: " + s.journal.Count(x => x.state == "pending") + "\r\nLast Sync (UTC): " + (s.last_sync ?? "Never") + "\r\nSync due (UTC): " + (s.sync_due ?? "—") + "\r\n\r\nThis separate addon does not charge existing NB Tools commands.\r\nAccount/license selection uses the existing website login.";
        }
        private static string Machine() {
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography")) {
                var id = key == null ? null : key.GetValue("MachineGuid") as string;
                if (string.IsNullOrWhiteSpace(id)) throw new InvalidOperationException("Windows device identity unavailable.");
                using (var sha = SHA256.Create()) return "NBW-" + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes("NBOnlineWallet/v1/" + id))).Replace("-", "");
            }
        }
        private static void Write(string message) { var doc = AcApp.DocumentManager.MdiActiveDocument; if (doc != null) doc.Editor.WriteMessage("\nNB Wallet: " + message); }
        private sealed class RibbonCommand : System.Windows.Input.ICommand {
            public bool CanExecute(object parameter) { return true; }
            public event EventHandler CanExecuteChanged { add { } remove { } }
            public void Execute(object parameter) {
                var button = parameter as RibbonButton;
                if (button == null) return;
                // These application-level actions do not need a drawing or command-line queue.
                // SendStringToExecute silently did nothing on AutoCAD's Start screen.
                var command = Convert.ToString(button.CommandParameter);
                Log("Ribbon action: " + command);
                try {
                    var addon = new Addon();
                    switch (command) {
                        case "NBWACCOUNT": addon.Account(); break;
                        case "NBWWALLET": addon.Wallet(); break;
                        case "NBWSYNC": addon.Sync(); break;
                        case "NBWHISTORY": addon.History(); break;
                    }
                } catch (System.Exception ex) {
                    Log("Ribbon action failed: " + SafeError(ex));
                    MessageBox.Show("Unable to complete " + command + ". " + SafeError(ex) + "\r\nJournal preserved. See: " + LogFolder, "NB ONLINE");
                }
            }
        }
    }
}


