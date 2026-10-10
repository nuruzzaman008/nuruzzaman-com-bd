using System;
using System.IO;
using System.Reflection;

namespace NBEngineeringTools.Security {
    internal static class SharedWalletLoader {
        private static bool registered;
        public static void Start() {
            if (registered) return;
            AppDomain.CurrentDomain.AssemblyResolve += Resolve;
            registered = true;
        }
        private static Assembly Resolve(object sender, ResolveEventArgs args) {
            var requested = new AssemblyName(args.Name);
            if (requested.Name != "NBOnlineWallet" && requested.Name != "NBOnlineWallet.Core") return null;
            var own = Path.GetDirectoryName(typeof(SharedWalletLoader).Assembly.Location);
            var path = Path.GetFullPath(Path.Combine(own, "../../../NBOnlineWallet.bundle/Contents/Win64", requested.Name + ".dll"));
            if (!File.Exists(path)) throw new FileNotFoundException("NB ONLINE dependency is missing. Repair the paired bundle installation.", requested.Name);
            var actual = AssemblyName.GetAssemblyName(path);
            if (actual.Name != requested.Name || actual.Version != requested.Version) throw new InvalidOperationException("NB ONLINE dependency version mismatch. Install matching reviewed bundles.");
            return Assembly.LoadFrom(path);
        }
    }
}
