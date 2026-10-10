module.exports = {
  forbidden: [
    { name: 'no-core-to-shared-or-features', severity: 'error', from: { path: '^src/app/core' }, to: { path: '^src/app/(shared|features)' } },
    { name: 'no-feature-imports-outside-features', severity: 'error', from: { pathNot: ['^src/app/features', '^src/app/app\\.routes\\.ts$'] }, to: { path: '^src/app/features' } },
    { name: 'no-cross-feature-imports', severity: 'error', from: { path: '^src/app/features/([^/]+)/' }, to: { path: '^src/app/features/', pathNot: '^src/app/features/$1/' } },
    { name: 'no-folder-cycles', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsConfig: { fileName: 'tsconfig.json' } },
};
