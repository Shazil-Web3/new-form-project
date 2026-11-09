/* Copy non-compiled runtime assets (JSON templates) into dist after tsc. */
const fs = require('fs');
const path = require('path');

const pairs = [
  ['src/rbac/rbac-default-template.json', 'dist/rbac/rbac-default-template.json'],
];

for (const [from, to] of pairs) {
  const src = path.join(__dirname, '..', from);
  const dst = path.join(__dirname, '..', to);
  if (!fs.existsSync(src)) {
    console.warn(`copy-assets: missing ${from}, skipping`);
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`copy-assets: ${from} -> ${to}`);
}
