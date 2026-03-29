/**
 * fix-imports.js
 * Rewrites deep relative imports (3+ levels of ../) to TypeScript path aliases.
 * Run: node scripts/fix-imports.js
 * Safe to run multiple times (idempotent).
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcApp = path.join(root, 'src', 'app');
const src = path.join(root, 'src');

const aliases = [
  { prefix: '@core/', dir: path.join(srcApp, 'core') },
  { prefix: '@shared/', dir: path.join(srcApp, 'shared') },
  { prefix: '@features/', dir: path.join(srcApp, 'features') },
  { prefix: '@env/', dir: path.join(src, 'environments') },
];

function findTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

let changed = 0;

for (const file of findTsFiles(srcApp)) {
  const content = fs.readFileSync(file, 'utf8');

  const newContent = content.replace(/from '(\.\.\/[^']+)'/g, (match, importPath) => {
    const depth = (importPath.match(/\.\.\//g) || []).length;
    if (depth < 3) return match;

    const resolved = path.resolve(path.dirname(file), importPath);

    for (const { prefix, dir } of aliases) {
      if (resolved.startsWith(dir + path.sep) || resolved === dir) {
        const rel = resolved.slice(dir.length + 1).split(path.sep).join('/');
        return `from '${prefix}${rel}'`;
      }
    }
    return match;
  });

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(' ', path.relative(root, file));
    changed++;
  }
}

console.log(`\nDone: ${changed} files updated`);
