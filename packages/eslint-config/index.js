// Shared lint rules for every workspace in the monorepo.
//
// The rule that matters most here is no-restricted-globals: the session is a
// first-party HttpOnly cookie, and storing any auth state in localStorage would
// both break that model and expose it to XSS.
//
// Keeping server-only modules out of client bundles is enforced by the
// `server-only` package instead of a lint pattern: it fails the build precisely
// when such a module is pulled into a client graph, where a path-based rule
// could only guess.
export const sharedRules = {
  'no-restricted-globals': [
    'error',
    {
      name: 'localStorage',
      message:
        'Auth state lives in the first-party Sanctum session cookie. Do not store tokens in localStorage.',
    },
    {
      name: 'sessionStorage',
      message:
        'Auth state lives in the first-party Sanctum session cookie. Do not store tokens in sessionStorage.',
    },
  ],
  eqeqeq: ['error', 'smart'],
  'prefer-const': 'error',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
};

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    rules: sharedRules,
  },
];

export default config;
