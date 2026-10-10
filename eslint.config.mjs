import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-plugin-prettier';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

import localRules from './eslint-local-rules/index.js';

const ERROR = 'error';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'cypress-out/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: { $localize: 'readonly' },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      import: importPlugin,
      jsdoc,
      '@stylistic': stylistic,
      'local-rules': localRules,
    },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      // Angular's Validators are static and safe to pass unbound.
      '@typescript-eslint/unbound-method': [ERROR, { ignoreStatic: true }],
      '@angular-eslint/component-selector': [ERROR, { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': [ERROR, { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/no-output-native': ERROR,
      '@angular-eslint/prefer-inject': ERROR,
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
      '@angular-eslint/prefer-output-emitter-ref': ERROR,
      '@angular-eslint/prefer-signals': ERROR,
      '@angular-eslint/prefer-standalone': ERROR,
      '@typescript-eslint/consistent-type-definitions': [ERROR, 'interface'],
      '@typescript-eslint/explicit-member-accessibility': [ERROR, { accessibility: 'explicit', overrides: { constructors: 'no-public' } }],
      '@stylistic/member-delimiter-style': [ERROR, { multiline: { delimiter: 'semi', requireLast: true }, singleline: { delimiter: 'semi', requireLast: false } }],
      '@typescript-eslint/naming-convention': [
        ERROR,
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'snake_case', 'PascalCase'], leadingUnderscore: 'allow' },
      ],
      '@typescript-eslint/no-empty-function': ERROR,
      '@typescript-eslint/no-explicit-any': ERROR,
      '@typescript-eslint/no-floating-promises': ERROR,
      '@typescript-eslint/no-misused-promises': ERROR,
      '@typescript-eslint/no-non-null-asserted-optional-chain': ERROR,
      '@typescript-eslint/no-shadow': [ERROR, { hoist: 'all' }],
      '@typescript-eslint/no-unused-vars': [ERROR, { args: 'all', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
      '@typescript-eslint/prefer-function-type': ERROR,
      '@stylistic/semi': [ERROR, 'always'],
      '@stylistic/type-annotation-spacing': ERROR,
      '@typescript-eslint/unified-signatures': ERROR,
      'arrow-body-style': ERROR,
      curly: ERROR,
      eqeqeq: [ERROR, 'smart'],
      'guard-for-in': ERROR,
      indent: [ERROR, 2, { SwitchCase: 1 }],
      'lines-between-class-members': [ERROR, 'always', { exceptAfterSingleLine: true }],
      'max-len': [ERROR, { code: 120, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      'newline-per-chained-call': [ERROR, { ignoreChainWithDepth: 1 }],
      'no-bitwise': ERROR,
      'no-caller': ERROR,
      'no-console': [ERROR, { allow: ['dir', 'timeLog', 'assert', 'clear', 'count', 'countReset', 'group', 'groupEnd', 'table', 'dirxml', 'groupCollapsed', 'profile', 'profileEnd', 'timeStamp', 'context'] }],
      'no-eval': ERROR,
      'no-irregular-whitespace': [ERROR, { skipStrings: true, skipTemplates: true }],
      'no-new-wrappers': ERROR,
      'no-throw-literal': ERROR,
      'no-trailing-spaces': ERROR,
      'object-curly-spacing': [ERROR, 'always'],
      'padding-line-between-statements': [ERROR, { blankLine: 'always', prev: '*', next: ['return', 'if', 'for', 'while'] }],
      'prefer-const': ERROR,
      quotes: [ERROR, 'single', { avoidEscape: true }],
      radix: ERROR,
      'sort-imports': [ERROR, { ignoreDeclarationSort: true, ignoreCase: false, allowSeparatedGroups: true }],
      'spaced-comment': [ERROR, 'always', { markers: ['/'] }],
      'import/no-deprecated': ERROR,
      'import/order': [ERROR, { groups: ['builtin', 'external', 'internal', ['sibling', 'parent'], 'index', 'unknown'], 'newlines-between': 'always', alphabetize: { order: 'asc', caseInsensitive: true } }],
      'jsdoc/no-types': ERROR,
      'local-rules/no-ng-module': ERROR,
      'local-rules/no-non-standalone-component': ERROR,
      'no-restricted-imports': [ERROR, { paths: [
        { name: 'rxjs/Rx' }, { name: 'lodash' }, { name: 'lodash-es', message: 'Import a lodash-es function directly.' },
      ], patterns: [{ group: ['app/features/*'], message: 'Feature code is private to its feature.' }] }],
      'no-restricted-syntax': [ERROR, { selector: 'PropertyDefinition[readonly!=true] > CallExpression.value[callee.name="inject"]', message: 'Injected fields must be readonly' }],
    },
  },
  {
    files: ['src/app/**/*.routes.ts'],
    rules: { 'local-rules/route-param-has-breadcrumb-label': ERROR },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    plugins: { prettier, 'local-rules': localRules },
    rules: {
      '@angular-eslint/template/no-call-expression': 'off',
      '@angular-eslint/template/prefer-control-flow': ERROR,
      '@angular-eslint/template/no-negated-async': ERROR,
      '@angular-eslint/template/no-positive-tabindex': ERROR,
      '@angular-eslint/template/no-autofocus': ERROR,
      '@angular-eslint/template/mouse-events-have-key-events': ERROR,
      '@angular-eslint/template/click-events-have-key-events': ERROR,
      '@angular-eslint/template/interactive-supports-focus': ERROR,
      '@angular-eslint/template/valid-aria': ERROR,
      '@angular-eslint/template/role-has-required-aria': ERROR,
      '@angular-eslint/template/alt-text': ERROR,
      '@angular-eslint/template/elements-content': ERROR,
      '@angular-eslint/template/label-has-associated-control': ERROR,
      '@angular-eslint/template/table-scope': ERROR,
      '@angular-eslint/template/no-distracting-elements': ERROR,
      '@angular-eslint/template/button-has-type': ERROR,
      'local-rules/interactive-element-has-aria-label': ERROR,
      'local-rules/icon-has-aria-hidden': ERROR,
      'local-rules/no-button-router-link': ERROR,
      'prettier/prettier': ERROR,
    },
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: { globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', vi: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' } },
    rules: {
      '@typescript-eslint/no-empty-function': 'off', '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off', '@typescript-eslint/no-floating-promises': 'off', '@typescript-eslint/no-misused-promises': 'off',
      'no-restricted-imports': [ERROR, { paths: [{ name: '@angular/core', importNames: ['CUSTOM_ELEMENTS_SCHEMA', 'NO_ERRORS_SCHEMA'] }] }],
      'no-restricted-syntax': [ERROR, { selector: 'CallExpression[callee.name=/^(fdescribe|fit)$/]', message: 'Focused tests must not be committed.' }],
    },
  },
  {
    files: ['**/*.e2e-spec-cy.ts'],
    languageOptions: { globals: { browser: 'readonly', mocha: 'readonly', cy: 'readonly', Cypress: 'readonly' } },
    rules: { 'no-unused-expressions': 'off' },
  },
  { files: ['scripts/**/*.ts'], languageOptions: { globals: { process: 'readonly', __dirname: 'readonly' } } },
);
