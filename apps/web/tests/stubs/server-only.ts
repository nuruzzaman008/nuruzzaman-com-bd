/*
  Stands in for `server-only` under vitest.

  Next.js resolves `import 'server-only'` itself at build time, so the package
  is not installed; without this alias a test cannot import a server module
  such as lib/api/server.ts at all. In the real build the import still guards
  those modules from being bundled into the browser.
*/
export {};
