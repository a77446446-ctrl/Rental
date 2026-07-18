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
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-func-assign': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-assignment': 'warn',
      'no-useless-escape': 'warn',
      'preserve-caught-error': 'warn',
    }
  },
  {
    // Отключаем строгие проверки для клиентского кода (он использует var и IIFE)
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
        Node: 'readonly',
        NodeFilter: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        self: 'readonly',
        caches: 'readonly',
        EcoApi: 'readonly',
        ymaps: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        navigator: 'readonly',
      }
    }
  }
];
