import js from '@eslint/js';
import globals from 'globals';

export default [
  // ------------------------------------------------------------------
  // Files in scope
  // ------------------------------------------------------------------
  {
    files: ['src/**/*.js'],
    ignores: [
      'node_modules/**',
      'src/backup/**',          // legacy backup copy — not active code
    ],

    languageOptions: {
      ecmaVersion: 2022,        // async/await, optional chaining, nullish coalescing
      sourceType: 'commonjs',   // require / module.exports throughout
      globals: {
        ...globals.node,        // process, __dirname, __filename, Buffer, etc.
      },
    },

    rules: {
      // ----------------------------------------------------------------
      // Possible errors / correctness
      // ----------------------------------------------------------------
      'no-undef':               'error',   // catch missing requires early
      'no-unused-vars': ['warn', {          // dead variables = noise / memory waste
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_',           // allow _unused convention
      }],
      'no-unreachable':         'error',   // code after return/throw
      'no-constant-condition':  'warn',    // while(true) without a break
      'no-dupe-keys':           'error',   // duplicate object keys silently overwrite
      'no-duplicate-case':      'error',
      'no-empty':               'warn',    // empty catch blocks hide errors
      'no-ex-assign':           'error',   // overwriting a caught error object
      'use-isnan':              'error',   // x === NaN is always false
      'valid-typeof':           'error',   // typeof x === 'strng' typos

      // ----------------------------------------------------------------
      // Async / promise hygiene
      // ----------------------------------------------------------------
      'no-async-promise-executor': 'error', // async inside new Promise() is an anti-pattern
      'no-await-in-loop':          'warn',  // sequential awaits in loops — usually a perf issue
      'require-atomic-updates':    'error', // race condition in async assignments

      // ----------------------------------------------------------------
      // Security-relevant
      // ----------------------------------------------------------------
      'no-eval':                'error',   // eval() is a security hole
      'no-implied-eval':        'error',   // setTimeout('code') same risk
      'no-new-func':            'error',   // new Function('code') same risk

      // ----------------------------------------------------------------
      // Code quality / maintainability
      // ----------------------------------------------------------------
      'eqeqeq': ['error', 'always', {      // == coercion causes subtle bugs
        null: 'ignore',                    // allow x == null (catches both null/undefined)
      }],
      'no-var':                 'error',   // const/let only — var has function scope surprises
      'prefer-const':           'warn',    // signal intent; catches accidental reassignment
      'no-console':             'off',     // console.log is intentional in a Node server
      'no-shadow':              'warn',    // inner variable hiding outer with same name
      'no-throw-literal':       'error',   // throw must be an Error, not a plain string/object
      'no-return-assign':       'error',   // return x = y is almost always a typo
      'no-self-compare':        'error',   // x === x is always true (usually a copy-paste bug)
      'curly':   ['warn', 'multi-line'],   // braces required for multi-line if blocks
      'dot-notation':           'warn',    // prefer obj.foo over obj['foo'] where possible
    },
  },
];
