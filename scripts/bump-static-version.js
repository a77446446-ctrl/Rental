const fs = require('node:fs');
const path = require('node:path');

const version = process.argv[2];
if (!version || !/^[A-Za-z0-9._-]+$/.test(version)) {
  console.error('Использование: node scripts/bump-static-version.js <version>');
  process.exit(1);
}

const publicDir = path.join(__dirname, '..', 'public');
let changed = 0;

function visit(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return visit(filePath);
    if (!entry.name.endsWith('.html')) return;
    const source = fs.readFileSync(filePath, 'utf8');
    const updated = source.replace(/(["']\/(?:css|js)\/[^"'?]+\?v=)[^"']+/g, `$1${version}`);
    if (updated !== source) {
      fs.writeFileSync(filePath, updated);
      changed += 1;
    }
  });
}

visit(publicDir);
console.log(`[assets] Версия ${version}: обновлено HTML-файлов — ${changed}`);
