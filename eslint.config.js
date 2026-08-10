const js = require('@eslint/js');

module.exports = [
  {
    ignores: ['node_modules/**', 'public/js/lucide.min.js', 'public/js/supabase.js'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly', process: 'readonly', require: 'readonly', module: 'readonly',
        __dirname: 'readonly', __filename: 'readonly', Buffer: 'readonly', URL: 'readonly',
        AbortSignal: 'readonly', AbortController: 'readonly', Blob: 'readonly', FormData: 'readonly',
        Request: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-func-assign': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'preserve-caught-error': 'off',
      'no-useless-catch': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { Response: 'readonly' } },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        window: 'readonly', history: 'readonly', document: 'readonly', fetch: 'readonly',
        Headers: 'readonly', Request: 'readonly', Response: 'readonly', URL: 'readonly',
        AbortSignal: 'readonly', AbortController: 'readonly', Blob: 'readonly', FormData: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly', URLSearchParams: 'readonly',
        Node: 'readonly', NodeFilter: 'readonly', MutationObserver: 'readonly',
        IntersectionObserver: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly', self: 'readonly', caches: 'readonly',
        EcoApi: 'readonly', ymaps: 'readonly', alert: 'readonly', confirm: 'readonly', navigator: 'readonly',
      },
    },
  },
];